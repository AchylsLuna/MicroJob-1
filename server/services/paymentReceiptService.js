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

const getReceiptRows = (transaction, user) => {
  const payout = transaction.payoutRequest;
  const destination = payout?.destinationSnapshot;
  const rows = [
    ['Account holder', `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Not available'],
    ['Account ID', String(user._id)],
    ['Receipt number', transaction.reference || String(transaction._id)],
    ['Transaction ID', String(transaction._id)],
    ['Transaction status', formatStatus(transaction)],
    ['Amount', formatMoney(transaction.amount)],
    ['Transaction date and time', formatDate(transaction.createdAt)],
  ];

  if (transaction.label) rows.push(['Description', transaction.label]);
  if (transaction.type === 'TOP_UP' || transaction.provider) {
    rows.push(['Payment method', formatPaymentMethod(transaction.provider)]);
  }
  if (transaction.providerReference && transaction.providerReference !== transaction.reference) {
    rows.push(['Provider reference', transaction.providerReference]);
  }
  if (transaction.balanceTarget) rows.push(['Wallet', transaction.balanceTarget]);
  if (transaction.jobReference?.title) rows.push(['Related job', transaction.jobReference.title]);
  if (destination) {
    rows.push(['Withdrawal method', destination.institutionName || destination.methodType || 'Not available']);
    if (destination.accountName) rows.push(['Account name', destination.accountName]);
    if (destination.accountNumberMasked) rows.push(['Account number', destination.accountNumberMasked]);
  }

  return rows;
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
  const rows = getReceiptRows(transaction, user);
  const textRows = rows.map(([label, value]) => `${label}: ${value}`).join('\n');
  const htmlRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding: 9px 0; color: #52606d; width: 42%;">${escapeHtml(label)}</td>
      <td style="padding: 9px 0; color: #102a43; font-weight: 600; word-break: break-word;">${escapeHtml(value)}</td>
    </tr>`).join('');
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
          <p>Here is the breakdown for your transaction. Keep this email for your records.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tbody>${htmlRows}</tbody>
          </table>
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
