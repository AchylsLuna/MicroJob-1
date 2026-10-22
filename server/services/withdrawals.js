import axios from 'axios';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import PayoutRequest from '../models/PayoutRequest.js';
import Transaction from '../models/Transaction.js';
import { httpError, money } from '../lib/lifecyclePolicy.js';
import { queueNotification } from './notificationOutbox.js';
import { validateWithdrawalAmount } from '../lib/withdrawalPolicy.js';

const BASE = 'https://api.paymongo.com/v2';
const options = () => ({ auth: { username: process.env.PAYMONGO_SECRET_KEY, password: '' }, timeout: 15000 });
const signingKey = () => process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'development-withdrawal-preview-key' : (() => { throw httpError(503, 'Withdrawal previews are unavailable.'); })());
export const automaticWithdrawalsEnabled = () => process.env.AUTOMATIC_WITHDRAWALS_ENABLED === 'true' && Boolean(process.env.PAYMONGO_SECRET_KEY && process.env.PAYMONGO_WALLET_ID && process.env.PAYMONGO_TRANSFER_CALLBACK_URL && process.env.PAYMONGO_TRANSFER_WEBHOOK_SECRET);
export const maskAccount = (value) => `•••• ${String(value).slice(-4)}`;
export async function receivingInstitutions() {
  if (!automaticWithdrawalsEnabled()) throw httpError(503, 'Automatic withdrawals are not configured yet.');
  const response = await axios.get(`${BASE}/transfers/receiving_institutions`, { ...options(), params: { provider: 'instapay' } });
  const rows = response.data?.data;
  if (!Array.isArray(rows)) throw httpError(502, 'Unable to load supported destinations.');
  return rows.map((row) => ({ bic: row.bic || row.provider_code || row.attributes?.bic || row.attributes?.provider_code, name: row.name || row.attributes?.name, rail: 'instapay' })).filter((row) => row.bic && row.name);
}

export async function previewWithdrawal(userId, body) {
  const user = await User.findById(userId).select('role status employerBalance workerBalance');
  if (!user || user.status !== 'active') throw httpError(403, 'An active account is required.');
  const sourceWallet = body.sourceWallet === 'EMPLOYER' ? 'EMPLOYER' : 'WORKER';
  const employer = sourceWallet === 'EMPLOYER';
  if (!(employer ? ['hire', 'both'] : ['work', 'both']).includes(user.role)) throw httpError(403, 'This wallet is unavailable for your account.');
  const amount = money(body.amount);
  const policy = validateWithdrawalAmount(Number(body.amount), sourceWallet);
  const balance = Number(employer ? user.employerBalance : user.workerBalance);
  if (amount > balance) throw httpError(409, 'The amount exceeds your available wallet balance.');
  const input = body.destinationSnapshot || {};
  const destination = Object.fromEntries(['methodType', 'institutionName', 'accountName', 'accountNumber', 'bic'].map((key) => [key, String(input[key] || '').trim()]));
  if (!destination.methodType || !destination.institutionName || !destination.accountName || !destination.accountNumber || destination.accountName.length > 120 || destination.institutionName.length > 120 || destination.accountNumber.length > 64 || destination.methodType.length > 50) throw httpError(400, 'Complete valid destination details are required.');
  if (employer && policy.processingMode === 'automatic') {
    const supported = (await receivingInstitutions()).find((item) => item.bic === destination.bic);
    if (!supported) throw httpError(400, 'Choose a supported receiving institution.');
    destination.institutionName = supported.name; destination.rail = supported.rail;
  }
  destination.accountNumberMasked = maskAccount(destination.accountNumber);
  // Provider charges are absorbed by the platform. No unquoted fee is debited.
  const fee = 0;
  const payload = { purpose: 'withdrawal-preview', userId: String(userId), sourceWallet, amount, fee, destination, processingMode: policy.processingMode, jti: crypto.randomUUID() };
  return { previewToken: jwt.sign(payload, signingKey(), { expiresIn: '5m' }), sourceWallet, amount, fee, totalDebit: amount, remainingBalance: money(balance - amount), destination: { ...destination, accountNumber: undefined }, ...policy };
}

export async function confirmWithdrawal(userId, body) {
  if (body.detailsConfirmed !== true) throw httpError(400, 'Verify and confirm the withdrawal details.');
  let preview;
  try { preview = jwt.verify(body.previewToken, signingKey()); } catch { throw httpError(400, 'The withdrawal preview expired. Review the details again.'); }
  if (preview.purpose !== 'withdrawal-preview' || preview.userId !== String(userId)) throw httpError(403, 'Invalid withdrawal preview.');
  const employer = preview.sourceWallet === 'EMPLOYER';
  const session = await mongoose.startSession(); let payout; let created = false;
  try {
    await session.withTransaction(async () => {
      created = false;
      payout = await PayoutRequest.findOne({ user: userId, idempotencyKey: preview.jti }).session(session);
      if (payout) return;
      const policy = validateWithdrawalAmount(preview.amount, preview.sourceWallet);
      if (preview.processingMode && preview.processingMode !== policy.processingMode) throw httpError(409, 'Withdrawal policy changed. Review the withdrawal again.');
      const automatic = policy.processingMode === 'automatic';
      if (automatic && !automaticWithdrawalsEnabled()) throw httpError(503, 'Automatic withdrawals are unavailable.');
      const field = employer ? 'employerBalance' : 'workerBalance';
      const debited = await User.updateOne({ _id: userId, status: 'active', role: { $in: employer ? ['hire', 'both'] : ['work', 'both'] }, [field]: { $gte: preview.amount } }, { $inc: { [field]: -preview.amount } }, { session });
      if (!debited.modifiedCount) throw httpError(409, 'Your balance or account changed. Review the withdrawal again.');
      [payout] = await PayoutRequest.create([{ user: userId, amount: preview.amount, fee: preview.fee, totalDebit: preview.amount, sourceWallet: preview.sourceWallet, balanceTarget: preview.sourceWallet, processingMode: policy.processingMode, reviewReason: policy.reviewReason, policySnapshot: policy, destinationSnapshot: preview.destination, status: automatic ? 'processing' : 'requested', idempotencyKey: preview.jti, events: [{ status: automatic ? 'processing' : 'requested', actor: userId, note: policy.reviewReason || 'User confirmed amount and destination.' }] }], { session });
      const [transaction] = await Transaction.create([{ sender: userId, amount: preview.amount, type: 'PAYOUT', status: 'PENDING', balanceTarget: preview.sourceWallet, payoutRequest: payout._id, reference: `PAYOUT-${payout._id}`, provider: automatic ? 'paymongo_transfer' : 'manual_admin_review', label: 'Withdrawal', relatedEntityType: 'payout_request', relatedEntityId: String(payout._id), actor: userId }], { session });
      payout.transaction = transaction._id; await payout.save({ session }); created = true;
      await queueNotification(`withdrawal-request:${payout._id}`, { userId: String(userId), audience: employer ? 'employer' : 'worker', type: 'payout', title: automatic ? 'Withdrawal processing' : 'Withdrawal under review', message: `PHP ${preview.amount.toFixed(2)} is reserved for your withdrawal. ${policy.reviewReason || ''}`, entityType: 'payout_request', entityId: String(payout._id) }, session);
      if (!automatic) {
        const staff = await User.find({ $or: [{ role: 'superadmin' }, { role: 'admin', staffRole: 'finance_team' }], status: 'active' }).select('_id').session(session);
        for (const person of staff) await queueNotification(`withdrawal-review:${payout._id}:${person._id}`, { userId: String(person._id), type: 'payout', title: 'Withdrawal requires review', message: `A PHP ${preview.amount.toFixed(2)} withdrawal is awaiting review. ${policy.reviewReason || ''}`, entityType: 'payout_request', entityId: String(payout._id) }, session);
      }
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    payout = await PayoutRequest.findOne({ user: userId, idempotencyKey: preview.jti });
    if (!payout) throw error;
  } finally { await session.endSession(); }
  if (payout.processingMode === 'automatic') await dispatchWithdrawal(payout._id);
  const result = await PayoutRequest.findById(payout._id); result.$locals.created = created; return result;
}

export async function finalizeWithdrawal(payoutId, outcome, reason, providerId) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const payout = await PayoutRequest.findOne({ _id: payoutId, processingMode: 'automatic', status: 'processing' }).session(session);
      if (!payout) return;
      if (!['paid', 'failed'].includes(outcome)) return;
      payout.status = outcome; payout.lastReconciledAt = new Date();
      if (providerId) payout.providerTransferId = providerId;
      payout.events.push({ status: outcome, note: reason });
      if (outcome === 'paid') payout.paidAt = new Date();
      else {
        payout.failureReason = reason;
        const field = payout.sourceWallet === 'EMPLOYER' ? 'employerBalance' : 'workerBalance';
        const restored = await User.updateOne({ _id: payout.user }, { $inc: { [field]: payout.totalDebit || payout.amount } }, { session });
        if (!restored.matchedCount) throw httpError(409, 'Withdrawal refund requires account reconciliation.');
        await Transaction.create([{ receiver: payout.user, amount: payout.totalDebit || payout.amount, type: 'REFUND', status: 'COMPLETED', balanceTarget: payout.sourceWallet, payoutRequest: payout._id, reference: `PAYOUT-REFUND-${payout._id}`, label: 'Failed withdrawal returned', linkedTransaction: payout.transaction, meta: { reason } }], { session });
      }
      await payout.save({ session });
      await Transaction.updateOne({ _id: payout.transaction }, { $set: { status: outcome === 'paid' ? 'COMPLETED' : 'FAILED', providerReference: providerId || payout.providerTransferId || String(payout._id) } }, { session });
      await queueNotification(`withdrawal-result:${payout._id}`, { userId: String(payout.user), audience: payout.sourceWallet === 'EMPLOYER' ? 'employer' : 'worker', type: 'payout', title: outcome === 'paid' ? 'Withdrawal paid' : 'Withdrawal failed', message: outcome === 'paid' ? `Your PHP ${payout.amount.toFixed(2)} withdrawal was confirmed.` : 'The transfer failed. Reserved funds were returned to your original wallet.', entityType: 'payout_request', entityId: String(payout._id) }, session);
    });
  } finally { await session.endSession(); }
}

export async function dispatchWithdrawal(id) {
  // A persisted claim is never reset: a crash or timeout must be reconciled,
  // never automatically submitted a second time.
  const payout = await PayoutRequest.findOneAndUpdate({ _id: id, status: 'processing', processingMode: 'automatic', dispatchStartedAt: null }, { $set: { dispatchStartedAt: new Date() } }, { returnDocument: 'after' });
  if (!payout) return;
  let submitted = false;
  try {
    const walletResponse = await axios.get(`${BASE}/wallets/${encodeURIComponent(process.env.PAYMONGO_WALLET_ID)}`, options());
    const wallet = walletResponse.data?.data;
    const source = wallet?.source_account || wallet?.attributes?.source_account;
    if (!source?.number || !source?.bic || !source?.name) throw new Error('Provider wallet source account is unavailable.');
    submitted = true;
    const response = await axios.post(`${BASE}/batch_transfers`, { transfers: [{ provider: payout.destinationSnapshot.rail, amount: Math.round(payout.amount * 100), currency: 'PHP', purpose: 'Disbursement', description: 'MicroJobs unused employer wallet withdrawal', reference_number: `PAYOUT-${payout._id}`, source_account: source, destination_account: { number: payout.destinationSnapshot.accountNumber, name: payout.destinationSnapshot.accountName, bic: payout.destinationSnapshot.bic }, callback_url: process.env.PAYMONGO_TRANSFER_CALLBACK_URL, metadata: { payoutRequestId: String(payout._id) } }] }, { ...options(), headers: { 'Idempotency-Key': `PAYOUT-${payout._id}` } });
    const batch = response.data?.data; const transfer = batch?.transfers?.[0];
    if (!transfer?.id) throw new Error('Provider transfer response is incomplete; reconciliation required.');
    await PayoutRequest.updateOne({ _id: payout._id }, { $set: { providerTransferId: transfer.id, providerBatchId: batch.id } });
    await reconcileWithdrawal(payout._id);
  } catch (error) {
    if (!submitted || ([400, 401, 403, 404, 422].includes(error.response?.status) && Array.isArray(error.response?.data?.errors) && !error.response?.data?.data)) {
      await finalizeWithdrawal(payout._id, 'failed', submitted ? 'Provider rejected the transfer request.' : 'No transfer was submitted because the provider wallet was unavailable.');
      return;
    }
    // Do not infer transfer failure from a network error or HTTP error alone.
    await PayoutRequest.updateOne({ _id: payout._id, status: 'processing' }, { $set: { failureReason: 'Provider status is uncertain; reconciliation is required.' }, $push: { events: { status: 'processing', note: 'Dispatch interrupted; transfer will not be resent automatically.', at: new Date() } } });
  }
}

export async function reconcileWithdrawal(id, transferHint) {
  const payout = await PayoutRequest.findOne({ _id: id, processingMode: 'automatic', status: 'processing' });
  if (!payout) return;
  let transferId = payout.providerTransferId || transferHint;
  if (!transferId) {
    const response = await axios.get(`${BASE}/transfers`, { ...options(), params: { reference_number: `PAYOUT-${payout._id}`, limit: 100 } });
    const rows = response.data?.data;
    const match = Array.isArray(rows) && rows.find((item) => (item.attributes || item).reference_number === `PAYOUT-${payout._id}`);
    transferId = match?.id;
  }
  if (!transferId || !/^[a-zA-Z0-9_-]+$/.test(transferId)) return;
  const response = await axios.get(`${BASE}/transfers/${transferId}`, options());
  const raw = response.data?.data; const transfer = raw?.attributes ? { id: raw.id, ...raw.attributes } : raw;
  if (transfer?.reference_number !== `PAYOUT-${payout._id}` || Number(transfer.amount) !== Math.round(payout.amount * 100) || transfer.currency !== 'PHP' || transfer.destination_account?.number !== payout.destinationSnapshot.accountNumber || transfer.destination_account?.bic !== payout.destinationSnapshot.bic) throw httpError(409, 'Provider transfer does not match this withdrawal.');
  await PayoutRequest.updateOne({ _id: payout._id }, { $set: { providerTransferId: transfer.id, lastReconciledAt: new Date(), ...(transfer.provider_reference_number ? { providerRailReference: String(transfer.provider_reference_number) } : {}), ...(Number.isFinite(Number(transfer.fee)) && Number(transfer.fee) >= 0 ? { providerFee: money(Number(transfer.fee) / 100) } : {}) } });
  if (transfer.status === 'succeeded') await finalizeWithdrawal(payout._id, 'paid', 'Provider confirmed completion.', transfer.id);
  if (transfer.status === 'failed') await finalizeWithdrawal(payout._id, 'failed', String(transfer.provider_error_code || transfer.failure_code || 'Provider confirmed transfer failure.'), transfer.id);
}
