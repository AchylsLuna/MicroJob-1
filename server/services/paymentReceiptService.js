import crypto from 'node:crypto';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { getEmailTransporter, getMailFrom } from '../lib/emailTransporter.js';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatMoney = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
}).format(Number(value || 0));

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(date);
};

const formatPaymentMethod = (provider) => {
  const normalized = String(provider || '').trim().toLowerCase();
  if (normalized === 'paymongo') return 'PayMongo';
  if (normalized === 'xendit') return 'Xendit';
  if (normalized === 'xendit-link') return 'Xendit Payment Link';
  if (normalized === 'dev-webhook') return 'Development payment simulator';
  return provider || 'Online payment';
};

const formatStatus = (transaction) =>
  transaction.type === 'TOP_UP' && transaction.status === 'COMPLETED'
    ? 'Successful'
    : transaction.status || 'COMPLETED';

const formatWalletType = (target) => {
  const labels = {
    EMPLOYER: 'Employer wallet',
    WORKER: 'Worker wallet',
    ESCROW: 'Escrow wallet',
    SYSTEM: 'System wallet',
  };
  return labels[String(target || '').toUpperCase()] || 'Wallet';
};

/**
 * Retains enough of an identifier for a recipient to recognize it without
 * exposing a reusable provider token or database identifier in an email.
 */
export const maskReceiptIdentifier = (value, { visibleStart = 8, visibleEnd = 6 } = {}) => {
  const identifier = String(value || '').trim();
  if (!identifier) return 'Not available';
  if (identifier.length <= 8) return '****';
  const prefixLength = Math.min(visibleStart, Math.max(2, identifier.length - visibleEnd - 4));
  const suffixLength = Math.min(visibleEnd, Math.max(2, identifier.length - prefixLength - 4));
  return `${identifier.slice(0, prefixLength)}****${identifier.slice(-suffixLength)}`;
};

const receiptDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '00000000';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || '00';
  return `${part('year')}${part('month')}${part('day')}`;
};

// This is an outward-facing reference, deliberately distinct from a database
// id or payment-provider reference. Its six-digit suffix is deterministic so
// the same transaction always receives the same receipt number.
export const getPublicReceiptNumber = (transaction) => {
  const source = `${transaction._id || ''}:${transaction.createdAt || ''}`;
  const digest = crypto.createHash('sha256').update(source).digest('hex');
  const serial = (Number.parseInt(digest.slice(0, 8), 16) % 1_000_000).toString().padStart(6, '0');
  const type = transaction.type === 'TOP_UP' ? 'TOPUP' : String(transaction.type || 'PAYMENT').replace(/[^A-Z]/gi, '').toUpperCase();
  return `MJ-${type}-${receiptDate(transaction.createdAt)}-${serial}`;
};

const isRetryableEmailError = (error) => {
  const statusCode = Number(error?.statusCode || error?.responseCode || 0);
  if (statusCode === 429 || statusCode >= 500) return true;
  return [
    'ECONNRESET',
    'ECONNREFUSED',
    'ECONNABORTED',
    'ETIMEDOUT',
    'EAI_AGAIN',
    'ENOTFOUND',
    'ESOCKET',
  ].includes(error?.code);
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const getReceiptTitle = (transaction) => {
  if (transaction.type === 'TOP_UP') return 'Wallet top-up receipt';
  if (transaction.type === 'PAYOUT' && transaction.status === 'PENDING') return 'Withdrawal request receipt';
  if (transaction.type === 'PAYOUT') return 'Withdrawal receipt';
  if (transaction.type === 'ESCROW') return 'Escrow payment receipt';
  if (transaction.type === 'REFUND') return 'Refund receipt';
  return 'Payment receipt';
};

export const getReceiptSections = (transaction, user) => {
  const payout = transaction.payoutRequest;
  const destination = payout?.destinationSnapshot;
  const transactionDetails = [
    ['Account Holder', `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Not available'],
    ['Account ID', maskReceiptIdentifier(user._id)],
    ['Wallet Type', formatWalletType(transaction.balanceTarget)],
    ['Amount', formatMoney(transaction.amount)],
    ['Payment Method', formatPaymentMethod(transaction.provider)],
    ['Transaction Status', formatStatus(transaction)],
    ['Transaction Date and Time', formatDate(transaction.createdAt)],
  ];
  const paymentReference = [
    ['Receipt Number', getPublicReceiptNumber(transaction)],
  ];

  if (transaction.providerReference && transaction.providerReference !== transaction.reference) {
    paymentReference.push(['Provider Reference', maskReceiptIdentifier(transaction.providerReference, { visibleStart: 11, visibleEnd: 5 })]);
  }
  if (transaction.label) transactionDetails.push(['Description', transaction.label]);
  if (transaction.jobReference?.title) transactionDetails.push(['Related Job', transaction.jobReference.title]);
  if (destination) {
    transactionDetails.push(['Withdrawal Method', destination.institutionName || destination.methodType || 'Not available']);
    if (destination.accountName) transactionDetails.push(['Account Name', destination.accountName]);
    if (destination.accountNumberMasked) transactionDetails.push(['Account Number', destination.accountNumberMasked]);
  }

  return [
    { title: 'Transaction Details', rows: transactionDetails },
    { title: 'Payment Reference', rows: paymentReference },
  ];
};

const findReceiptTransaction = (transactionId, userId) =>
  Transaction.findOne({
    _id: transactionId,
    $or: [{ sender: userId }, { receiver: userId }],
  })
    .populate('jobReference', 'title')
    .populate('payoutRequest', 'status destinationSnapshot createdAt reviewedAt paidAt');

export async function sendPaymentReceiptEmail({ transactionId, userId }) {
  const [user, transaction] = await Promise.all([
    User.findById(userId).select('firstName lastName email'),
    findReceiptTransaction(transactionId, userId),
  ]);

  if (!user || !transaction) return { sent: false, reason: 'not_found' };

  const transporter = getEmailTransporter();
  if (!transporter) return { sent: false, reason: 'smtp_unconfigured' };

  const title = getReceiptTitle(transaction);
  const recipientName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'there';
  const sections = getReceiptSections(transaction, user);
  const textRows = sections.map(({ title: sectionTitle, rows }) => (
    `${sectionTitle.toUpperCase()}\n${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}`
  )).join('\n\n');
  const htmlSections = sections.map(({ title: sectionTitle, rows }) => `
    <section style="margin: 24px 0;">
      <h2 style="margin: 0 0 10px; color: #1c4d8d; font-size: 14px; letter-spacing: 0.04em; text-transform: uppercase;">${escapeHtml(sectionTitle)}</h2>
      <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #d9e2ec;">
        <tbody>${rows.map(([label, value]) => `
    <tr>
      <td style="padding: 10px 0; color: #52606d; width: 42%; border-bottom: 1px solid #eef2f6;">${escapeHtml(label)}</td>
      <td style="padding: 9px 0; color: #102a43; font-weight: 600; word-break: break-word;">${escapeHtml(value)}</td>
    </tr>`).join('')}</tbody>
      </table>
    </section>`).join('');
  const fromAddress = getMailFrom();

  const message = {
    from: `MicroJobs <${fromAddress}>`,
    to: user.email,
    subject: `MicroJobs ${title}`,
    text: `Hi ${recipientName},\n\nYour ${title.toLowerCase()} is below.\n\n${textRows}\n\nKeep this email for your records.`,
    html: `
      <div style="max-width: 620px; margin: 0 auto; font-family: Arial, sans-serif; color: #102a43;">
        <div style="padding: 24px; background: #1c4d8d; color: #ffffff;">
          <div style="font-size: 20px; font-weight: 700;">MicroJobs</div>
          <div style="margin-top: 6px; font-size: 16px;">${escapeHtml(title)}</div>
        </div>
        <div style="padding: 24px; border: 1px solid #d9e2ec; border-top: 0;">
          <p>Hi ${escapeHtml(recipientName)},</p>
          <p>Here is the breakdown for your transaction. Sensitive identifiers are masked for your protection.</p>
          ${htmlSections}
          <p style="margin: 0; color: #52606d; font-size: 13px;">This is an automatically generated receipt from MicroJobs.</p>
        </div>
      </div>`,
  };

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await transporter.sendMail(message);
      return { sent: true, transaction, attempts: attempt };
    } catch (error) {
      const retryable = isRetryableEmailError(error);
      if (!retryable || attempt === maxAttempts) {
        error.receiptAttempts = attempt;
        throw error;
      }
      // Short exponential backoff for temporary provider/network failures. The
      // payment has already committed and will not be rolled back if this fails.
      await wait(250 * (2 ** (attempt - 1)));
    }
  }

  return { sent: false, reason: 'delivery_failed' };
}
