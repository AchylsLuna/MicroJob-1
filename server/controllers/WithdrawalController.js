import crypto from 'node:crypto';
import PayoutRequest from '../models/PayoutRequest.js';
import { withdrawalPolicy } from '../lib/withdrawalPolicy.js';
import { confirmWithdrawal, previewWithdrawal, receivingInstitutions, reconcileWithdrawal } from '../services/withdrawals.js';
const id = (req) => String(req.user?.id || req.user?.userId || '');
const handle = (fn) => async (req, res) => { try { return await fn(req, res); } catch (error) { return res.status(error.status || 500).json({ message: error.status ? error.message : 'Withdrawal service is unavailable. Please try again.' }); } };
export const getPolicy = handle(async (req, res) => res.json(withdrawalPolicy(req.query.sourceWallet === 'EMPLOYER' ? 'EMPLOYER' : 'WORKER')));
export const getInstitutions = handle(async (req, res) => res.json({ institutions: await receivingInstitutions() }));
export const preview = handle(async (req, res) => res.json(await previewWithdrawal(id(req), req.body || {})));
export const confirm = handle(async (req, res) => { const payoutRequest = await confirmWithdrawal(id(req), req.body || {}); return res.status(payoutRequest.$locals.created ? 201 : 200).json({ payoutRequest }); });
export const reconcile = handle(async (req, res) => {
  await reconcileWithdrawal(req.params.id, req.body?.transferId);
  return res.json({ payoutRequest: await PayoutRequest.findById(req.params.id) });
});
export const transferWebhook = handle(async (req, res) => {
  const secret = process.env.PAYMONGO_TRANSFER_WEBHOOK_SECRET;
  if (!secret || !req.rawBody) return res.sendStatus(503);
  const parts = Object.fromEntries(String(req.get('paymongo-signature') || '').split(',').map((part) => part.trim().split('=')));
  if (!parts.t || !Number.isFinite(Number(parts.t)) || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return res.sendStatus(401);
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.`).update(req.rawBody).digest('hex');
  const valid = [String(process.env.PAYMONGO_SECRET_KEY || '').startsWith('sk_live_') ? parts.li : parts.te].filter(Boolean).some((signature) => /^[a-f0-9]{64}$/i.test(signature) && crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex')));
  if (!valid) return res.sendStatus(401);
  const resource = req.body?.data?.attributes?.data || req.body?.data;
  const transfer = resource?.attributes || resource;
  const match = /^PAYOUT-([a-f0-9]{24})$/i.exec(String(transfer?.reference_number || ''));
  if (match) await reconcileWithdrawal(match[1], resource?.id);
  return res.sendStatus(200);
});
