import axios from 'axios';
import crypto from 'crypto';
import { getWebOrigin } from '../lib/runtimeConfig.js';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import PayoutRequest from '../models/PayoutRequest.js';
import monitor from '../lib/monitor.js';
import { createNotification } from '../lib/notificationService.js';

const PAYMONGO_BASE = 'https://api.paymongo.com/v1';
const XENDIT_BASE = 'https://api.xendit.co';
const TOPUP_TARGET = {
  EMPLOYER: 'EMPLOYER',
  WORKER: 'WORKER',
  BOTH: 'BOTH',
};

const canTopUpEmployerWallet = (role) => {
  const normalizedRole = String(role || '').toLowerCase();
  return normalizedRole === 'hire' || normalizedRole === 'both' || normalizedRole === 'admin' || normalizedRole === 'superadmin';
};

const canWithdrawWorkerBalance = (role) => {
  const normalizedRole = String(role || '').toLowerCase();
  return normalizedRole === 'work' || normalizedRole === 'both';
};

const normalizeTarget = (value) => {
  const normalized = String(value || TOPUP_TARGET.EMPLOYER).toUpperCase();
  if (normalized === TOPUP_TARGET.WORKER || normalized === TOPUP_TARGET.BOTH) return normalized;
  return TOPUP_TARGET.EMPLOYER;
};

const buildTopUpLabel = (target) => {
  if (target === TOPUP_TARGET.WORKER) return 'Top-up (Worker)';
  if (target === TOPUP_TARGET.BOTH) return 'Top-up (Both)';
  return 'Top-up (Employer)';
};

const maskAccountNumber = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.length <= 4) return raw;
  return `${'*'.repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`;
};

const populateTransactionQuery = (query) =>
  query
    .populate('sender', 'firstName lastName email companyName role status')
    .populate('receiver', 'firstName lastName email companyName role status')
    .populate('jobReference', 'title status')
    .populate('payoutRequest', 'status amount destinationSnapshot createdAt paidAt reviewedAt')
    .populate('linkedTransaction', 'type status amount createdAt reference');

const createXenditCheckout = async ({ amount, referenceNumber, target, user }) => {
  const xenditSecret = process.env.XENDIT_SECRET_KEY;
  const directLink = process.env.XENDIT_PAYMENT_LINK_URL;

  if (!xenditSecret && directLink) {
    return {
      checkoutUrl: directLink,
      checkoutId: referenceNumber,
      provider: 'xendit-link',
    };
  }

  if (!xenditSecret) {
    return null;
  }

  const payload = {
    external_id: referenceNumber,
    amount: Number(amount),
    description: `MicroJobs wallet top-up (${target})`,
    success_redirect_url: `${getWebOrigin()}/topup-success?ref=${encodeURIComponent(referenceNumber)}`,
    failure_redirect_url: `${getWebOrigin()}/wallet`,
    currency: 'PHP',
    customer: {
      given_names: user?.firstName || 'MicroJobs',
      surname: user?.lastName || 'User',
      email: user?.email || undefined,
    },
  };

  const response = await axios.request({
    method: 'POST',
    url: `${XENDIT_BASE}/v2/invoices`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${xenditSecret}:`).toString('base64')}`,
    },
    data: payload,
  });
  const invoice = response?.data || {};

  return {
    checkoutUrl: invoice.invoice_url,
    checkoutId: invoice.id || referenceNumber,
    provider: 'xendit',
  };
};

async function applyTopUpToUser({ user, amount, target, reference, source, checkoutId = null, actor = null }) {
  const normalizedTarget = normalizeTarget(target);
  const numericAmount = Number(amount);

  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Invalid top-up amount');
  }

  // Use a mongoose transaction to guarantee idempotent, atomic application of top-up.
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Idempotency: if a transaction with the same reference or providerReference already exists, return it
    const existingQuery = reference ? { reference } : null;
    let existing = null;
    if (existingQuery) existing = await Transaction.findOne(existingQuery).session(session);
    if (!existing && checkoutId) existing = await Transaction.findOne({ providerReference: checkoutId }).session(session);
    if (existing) {
      await session.abortTransaction();
      session.endSession();
      return {
        target: normalizedTarget,
        transaction: existing,
        transactions: [existing],
        user: {
          _id: user._id,
          employerBalance: user.employerBalance,
          workerBalance: user.workerBalance,
        },
      };
    }

    // Refresh user inside session to avoid race
    const userDoc = await User.findById(user._id).session(session);
    if (!userDoc) throw new Error('User not found');

    if (normalizedTarget === TOPUP_TARGET.WORKER) {
      userDoc.workerBalance = (userDoc.workerBalance || 0) + numericAmount;
    }
    if (normalizedTarget === TOPUP_TARGET.EMPLOYER) {
      userDoc.employerBalance = (userDoc.employerBalance || 0) + numericAmount;
    }
    if (normalizedTarget === TOPUP_TARGET.BOTH) {
      const workerShare = Number((numericAmount / 2).toFixed(2));
      const employerShare = Number((numericAmount - workerShare).toFixed(2));
      userDoc.workerBalance = (userDoc.workerBalance || 0) + workerShare;
      userDoc.employerBalance = (userDoc.employerBalance || 0) + employerShare;
    }

    await userDoc.save({ session });

    const tx = await Transaction.create([
      {
        sender: null,
        receiver: userDoc._id,
        amount: numericAmount,
        type: 'TOP_UP',
        status: 'COMPLETED',
        balanceTarget: normalizedTarget === TOPUP_TARGET.BOTH ? 'SYSTEM' : normalizedTarget,
        reference,
        provider: source || null,
        providerReference: checkoutId || reference || null,
        label: buildTopUpLabel(normalizedTarget),
        relatedEntityType: 'wallet_topup',
        relatedEntityId: reference,
        meta: {
          source,
          checkout_id: checkoutId || null,
          target: normalizedTarget,
        },
        actor: actor || null,
      },
    ], { session });

    await session.commitTransaction();
    session.endSession();

    const transaction = Array.isArray(tx) ? tx[0] : tx;
    return {
      target: normalizedTarget,
      transaction,
      transactions: [transaction],
      user: {
        _id: userDoc._id,
        employerBalance: userDoc.employerBalance,
        workerBalance: userDoc.workerBalance,
      },
    };
  } catch (err) {
    try { await session.abortTransaction(); } catch (e) {}
    session.endSession();
    throw err;
  }
}

async function createPayoutRefund({ payoutRequest, actorId, reason, status }) {
  const user = await User.findById(payoutRequest.user);
  if (!user) throw new Error('User not found');

  user.workerBalance = (user.workerBalance || 0) + payoutRequest.amount;
  await user.save();

  const refund = await Transaction.create({
    sender: null,
    receiver: user._id,
    amount: payoutRequest.amount,
    type: 'REFUND',
    status: 'COMPLETED',
    balanceTarget: 'WORKER',
    payoutRequest: payoutRequest._id,
    reference: `${String(status || 'PAYOUT').toUpperCase()}-REFUND-${payoutRequest._id}-${Date.now()}`,
    label: `Payout refund (${String(status || reason || 'reversed').toLowerCase()})`,
    relatedEntityType: 'payout_request',
    relatedEntityId: String(payoutRequest._id),
    linkedTransaction: payoutRequest.transaction || null,
    meta: { reason },
    actor: actorId || null,
  });

  if (payoutRequest.transaction) {
    await Transaction.findByIdAndUpdate(payoutRequest.transaction, {
      $set: { status: 'CANCELLED', linkedTransaction: refund._id },
    });
  }

  return { user, refund };
}

async function notifyAdminsOfPayoutRequest(payoutRequest, userId) {
  const admins = await User.find({ role: { $in: ['admin', 'superadmin'] }, status: { $ne: 'deleted' } })
    .select('_id')
    .lean();

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin._id,
        type: 'payout',
        title: 'New payout request',
        message: `A payout request for PHP ${payoutRequest.amount.toFixed(2)} requires review.`,
        entityType: 'payout_request',
        entityId: payoutRequest._id,
        actor: userId,
        push: true,
        socketPayload: { payoutRequestId: String(payoutRequest._id), status: payoutRequest.status },
      })
    )
  );
}

async function notifyUserPayoutStatus(payoutRequest, actorId, title, message) {
  await createNotification({
    userId: payoutRequest.user,
    type: 'payout',
    title,
    message,
    entityType: 'payout_request',
    entityId: payoutRequest._id,
    actor: actorId,
    push: true,
    socketPayload: { payoutRequestId: String(payoutRequest._id), status: payoutRequest.status },
  });
}

export async function getUserTransactions(req, res) {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Authentication required' });

    const txs = await populateTransactionQuery(
      Transaction.find({ $or: [{ sender: userId }, { receiver: userId }] }).sort({ createdAt: -1 })
    );

    return res.status(200).json({ transactions: txs });
  } catch (error) {
    console.error('Get transactions error', error);
    return res.status(500).json({ message: 'Failed to fetch transactions' });
  }
}

export async function createTopUpSession(req, res) {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || null;
    const ua = req.get('user-agent');
    if (process.env.ENABLE_CSRF === 'true') {
      const tokenHeader = req.headers['x-csrf-token'];
      const cookieName = process.env.CSRF_COOKIE_NAME || 'csrfToken';
      const tokenCookie = req.cookies && req.cookies[cookieName];
      if (!tokenHeader || !tokenCookie || tokenHeader !== tokenCookie) {
        return res.status(403).json({ message: 'CSRF token missing or invalid' });
      }
    }

    const { amount, target } = req.body;
    const userId = req.user.id;
    const minAmount = Number(process.env.TOPUP_MIN_AMOUNT || 100);
    const maxAmount = Number(process.env.TOPUP_MAX_AMOUNT || 1000000);
    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount < minAmount || parsedAmount > maxAmount) {
      return res.status(400).json({ message: `Invalid amount; must be between ${minAmount} and ${maxAmount}` });
    }

    const requestingUser = await User.findById(userId).select('role firstName lastName email');
    if (!requestingUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!canTopUpEmployerWallet(requestingUser.role)) {
      return res.status(403).json({ message: 'Only employer accounts can top up wallets' });
    }

    let effectiveTarget = TOPUP_TARGET.EMPLOYER;
    if (target && String(target).toUpperCase() !== TOPUP_TARGET.EMPLOYER) {
      return res.status(400).json({ message: 'Invalid target. Top-up target must be EMPLOYER.' });
    }

    await monitor.audit({
      actor: req.user?.id || null,
      action: 'topup_initiated',
      ip,
      userAgent: ua,
      amount: parsedAmount,
      status: 'initiated',
      meta: { target: effectiveTarget },
    });

    const { Types } = await import('mongoose');
    if (!Types.ObjectId.isValid(userId)) return res.status(400).json({ message: 'Invalid user id' });

    const referenceNumber = `TOPUP-${userId}-${effectiveTarget}-${Date.now()}`;

    try {
      const xenditCheckout = await createXenditCheckout({
        amount: parsedAmount,
        referenceNumber,
        target: effectiveTarget,
        user: requestingUser,
      });

      if (xenditCheckout?.checkoutUrl) {
        return res.status(200).json({
          checkoutUrl: xenditCheckout.checkoutUrl,
          referenceNumber,
          checkoutId: xenditCheckout.checkoutId,
          provider: xenditCheckout.provider,
        });
      }
    } catch (xenditError) {
      console.warn('Xendit top-up init failed, falling back to PayMongo:', xenditError?.response?.data || xenditError?.message || xenditError);
    }

    const amountInCentavos = Math.round(parsedAmount * 100);
    if (!process.env.PAYMONGO_SECRET_KEY) {
      console.error('PAYMONGO_SECRET_KEY not configured');
      return res.status(500).json({ message: 'Payment provider not configured' });
    }

    const response = await axios.request({
      method: 'POST',
      url: `${PAYMONGO_BASE}/checkout_sessions`,
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString('base64')}`,
      },
      data: {
        data: {
          attributes: {
            payment_method_types: ['gcash'],
            line_items: [{ currency: 'PHP', amount: amountInCentavos, name: 'E-Wallet Top Up', quantity: 1 }],
            reference_number: referenceNumber,
            success_url: `${getWebOrigin()}/topup-success?ref=${encodeURIComponent(referenceNumber)}`,
            cancel_url: `${getWebOrigin()}/wallet`,
          },
        },
      },
    });

    const checkout = response.data.data;
    return res.status(200).json({
      checkoutUrl: checkout.attributes.checkout_url,
      referenceNumber,
      checkoutId: checkout.id,
      provider: 'paymongo',
    });
  } catch (error) {
    console.error('PayMongo Error:', error.response?.data || error.message || error);
    const ip = req.ip || req.headers['x-forwarded-for'] || null;
    const ua = req.get('user-agent');
    const reqAmount = Number(req.body?.amount || 0);
    await monitor.audit({ actor: req.user?.id || null, action: 'topup_failed', ip, userAgent: ua, amount: reqAmount, status: 'failed', meta: { message: error.message } });
    await monitor.recordFailure({ key: 'topup_initiation', userId: req.user?.id, ip, reason: error.message });
    return res.status(500).json({ message: 'Failed to initiate top-up.' });
  }
}

export async function handleWebhook(req, res) {
  try {
    const signatureHeader = req.headers['paymongo-signature'];
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

    if (!signatureHeader) return res.status(400).send('Webhook Error: No signature');
    if (!webhookSecret) {
      console.error('Webhook called but PAYMONGO_WEBHOOK_SECRET not configured');
      return res.status(500).send('Webhook misconfigured');
    }

    const parts = signatureHeader.split(',').reduce((acc, p) => {
      const [k, v] = p.split('=');
      acc[k] = v;
      return acc;
    }, {});
    const timestamp = parts.t;
    const signature = parts.te;
    if (!timestamp || !signature) return res.status(400).send('Webhook Error: malformed signature header');

    const tsNum = Number(timestamp);
    const nowSec = Math.floor(Date.now() / 1000);
    if (Number.isNaN(tsNum) || Math.abs(nowSec - tsNum) > 300) {
      return res.status(400).send('Webhook Error: timestamp invalid or expired');
    }

    const payloadString = `${timestamp}.${JSON.stringify(req.body)}`;
    const expectedSignature = crypto.createHmac('sha256', webhookSecret || '').update(payloadString).digest('hex');
    if (signature !== expectedSignature) {
      return res.status(400).send('Webhook Error: Invalid signature');
    }

    const event = req.body.data;
    const eventType = event.attributes?.type || event.type;
    if (eventType === 'checkout_session.payment.paid') {
      const checkoutNode = event.attributes?.data || event.data;
      const checkoutAttrs = checkoutNode?.attributes || {};
      const referenceNumber = checkoutAttrs.reference_number || checkoutAttrs.referenceNumber || '';
      const checkoutId = checkoutNode?.id || checkoutAttrs?.id || null;

      if (referenceNumber && referenceNumber.startsWith('TOPUP')) {
        const partsRef = referenceNumber.split('-');
        const userId = partsRef[1];
        const target = normalizeTarget(partsRef[2] || TOPUP_TARGET.EMPLOYER);

        let amountAdded = 0;
        if (checkoutAttrs.payments && checkoutAttrs.payments.length > 0) {
          amountAdded = checkoutAttrs.payments[0].attributes.amount / 100;
        } else if (checkoutAttrs.line_items && checkoutAttrs.line_items.length > 0) {
          amountAdded = checkoutAttrs.line_items[0].amount / 100;
        }

        if (amountAdded <= 0) {
          return res.status(400).send('Webhook Error: No payment amount');
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).send('User not found');

        const exists = await Transaction.findOne({ reference: referenceNumber });
        if (exists) {
          return res.status(200).send('Already processed');
        }

        await applyTopUpToUser({
          user,
          amount: amountAdded,
          target,
          reference: referenceNumber,
          source: 'paymongo',
          checkoutId,
        });
      }
    }

    return res.status(200).send('Webhook received');
  } catch (error) {
    console.error('Webhook processing error', error.response?.data || error.message || error);
    return res.status(500).send('Webhook processing failed');
  }
}

export async function confirmTopUp(req, res) {
  try {
    if (process.env.ENABLE_CSRF === 'true') {
      const tokenHeader = req.headers['x-csrf-token'];
      const cookieName = process.env.CSRF_COOKIE_NAME || 'csrfToken';
      const tokenCookie = req.cookies && req.cookies[cookieName];
      if (!tokenHeader || !tokenCookie || tokenHeader !== tokenCookie) {
        return res.status(403).json({ message: 'CSRF token missing or invalid' });
      }
    }

    const { referenceNumber, checkoutId, provider, paymentIntentId } = req.body;
    if (!referenceNumber && !checkoutId) return res.status(400).json({ message: 'referenceNumber or checkoutId required' });

    let existing = null;
    if (referenceNumber) existing = await Transaction.findOne({ reference: referenceNumber });
    if (!existing && checkoutId) existing = await Transaction.findOne({ providerReference: checkoutId });
    if (existing) return res.status(200).json({ message: 'Already processed', transaction: existing });

    const { Types } = await import('mongoose');
    const maybeXenditCheckoutId = String(checkoutId || '');
    const providerHint = String(provider || '').toLowerCase();
    const canTryXendit = Boolean(process.env.XENDIT_SECRET_KEY);
    const shouldTryXendit = canTryXendit && (
      providerHint.startsWith('xendit') ||
      maybeXenditCheckoutId.startsWith('inv-') ||
      Boolean(referenceNumber)
    );

    if (shouldTryXendit) {
      const xHeaders = {
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.XENDIT_SECRET_KEY}:`).toString('base64')}`,
        },
      };

      let invoice = null;
      if (maybeXenditCheckoutId.startsWith('inv-')) {
        try {
          const xResp = await axios.get(`${XENDIT_BASE}/v2/invoices/${maybeXenditCheckoutId}`, xHeaders);
          invoice = xResp?.data || null;
        } catch (invoiceByIdError) {
          console.warn('Xendit invoice lookup by ID failed:', invoiceByIdError?.response?.data || invoiceByIdError?.message || invoiceByIdError);
        }
      }

      if (!invoice && referenceNumber) {
        try {
          const listResp = await axios.get(`${XENDIT_BASE}/v2/invoices?external_id=${encodeURIComponent(referenceNumber)}`, xHeaders);
          const list = Array.isArray(listResp?.data) ? listResp.data : [];
          invoice = list.find((item) => item?.external_id === referenceNumber) || list[0] || null;
        } catch (invoiceByRefError) {
          console.warn('Xendit invoice lookup by reference failed:', invoiceByRefError?.response?.data || invoiceByRefError?.message || invoiceByRefError);
        }
      }

      if (invoice) {
        const ref = invoice.external_id || referenceNumber;
        const refParts = (ref || '').split('-');
        if (refParts.length < 4 || refParts[0] !== 'TOPUP') {
          return res.status(400).json({ message: 'Invalid reference format' });
        }

        const refUserId = refParts[1];
        if (!Types.ObjectId.isValid(refUserId)) return res.status(400).json({ message: 'Invalid reference user id' });
        if (refUserId !== String(req.user.id)) return res.status(403).json({ message: 'Not authorized to confirm this top-up' });
        if (String(invoice.status || '').toUpperCase() !== 'PAID') {
          return res.status(400).json({ message: 'Payment not completed yet' });
        }

        const amountAdded = Number(invoice.paid_amount || invoice.amount || 0);
        if (!Number.isFinite(amountAdded) || amountAdded <= 0) {
          return res.status(400).json({ message: 'No payment found for this checkout' });
        }

        const user = await User.findById(refUserId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const topUpResult = await applyTopUpToUser({
          user,
          amount: amountAdded,
          target: normalizeTarget(refParts[2] || TOPUP_TARGET.EMPLOYER),
          reference: ref,
          source: 'xendit',
          checkoutId: invoice.id || maybeXenditCheckoutId,
          actor: user._id,
        });

        await monitor.audit({
          actor: user._id,
          action: 'confirm_topup',
          ip: req.ip || null,
          userAgent: req.get('user-agent'),
          amount: amountAdded,
          status: 'success',
          meta: { target: topUpResult.target, ref, provider: 'xendit' },
        });
        await monitor.recordTopUp({ userId: String(user._id), ip: req.ip || null });

        return res.status(200).json({
          message: 'Top-up applied',
          ...(topUpResult.target === TOPUP_TARGET.BOTH ? { transactions: topUpResult.transactions } : { transaction: topUpResult.transaction }),
        });
      }
    }

    if (!checkoutId && !paymentIntentId) {
      return res.status(400).json({ message: 'Unable to confirm payment. Missing checkout ID and payment intent ID. Please contact support.' });
    }

    if (!checkoutId) {
      return res.status(400).json({ message: 'Checkout ID is required for PayMongo confirmation' });
    }

    const resp = await axios.get(`${PAYMONGO_BASE}/checkout_sessions/${checkoutId}`, {
      headers: {
        authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString('base64')}`,
      },
    }).catch((error) => {
      console.warn('PayMongo checkout lookup by ID failed:', error.response?.data || error.message);
      return null;
    });
    if (!resp?.data?.data) {
      return res.status(400).json({ message: 'Payment session not found. Please try again.' });
    }

    const checkout = resp.data.data;
    const attrs = checkout.attributes || {};
    const ref = attrs.reference_number || referenceNumber;
    const refParts = (ref || '').split('-');
    if (refParts.length < 4 || refParts[0] !== 'TOPUP') {
      return res.status(400).json({ message: 'Invalid reference format' });
    }

    const refUserId = refParts[1];
    if (!Types.ObjectId.isValid(refUserId)) return res.status(400).json({ message: 'Invalid reference user id' });
    if (refUserId !== String(req.user.id)) return res.status(403).json({ message: 'Not authorized to confirm this top-up' });

    let amountAdded = 0;
    if (attrs.payments && attrs.payments.length > 0) amountAdded = attrs.payments[0].attributes.amount / 100;
    else if (attrs.line_items && attrs.line_items.length > 0) amountAdded = attrs.line_items[0].amount / 100;
    if (amountAdded <= 0) {
      await monitor.audit({ actor: req.user?.id || null, action: 'confirm_no_amount', ip: req.ip || null, userAgent: req.get('user-agent'), status: 'failed', meta: { ref } });
      await monitor.recordFailure({ key: 'confirm_no_amount', userId: req.user?.id, ip: req.ip || null, reason: 'no_amount' });
      return res.status(400).json({ message: 'No payment found for this checkout' });
    }

    const user = await User.findById(refUserId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const topUpResult = await applyTopUpToUser({
      user,
      amount: amountAdded,
      target: normalizeTarget(refParts[2] || TOPUP_TARGET.EMPLOYER),
      reference: ref,
      source: 'paymongo',
      checkoutId: checkout.id,
      actor: user._id,
    });

    await monitor.audit({
      actor: user._id,
      action: 'confirm_topup',
      ip: req.ip || null,
      userAgent: req.get('user-agent'),
      amount: amountAdded,
      status: 'success',
      meta: { target: topUpResult.target, ref, provider: 'paymongo' },
    });
    await monitor.recordTopUp({ userId: String(user._id), ip: req.ip || null });

    return res.status(200).json({
      message: 'Top-up applied',
      ...(topUpResult.target === TOPUP_TARGET.BOTH ? { transactions: topUpResult.transactions } : { transaction: topUpResult.transaction }),
    });
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
    console.error('Confirm top-up error:', errorMsg, error.response?.data || error);
    return res.status(500).json({ message: `Failed to confirm top-up: ${errorMsg}` });
  }
}

export async function simulateWebhook(req, res) {
  try {
    const allow = process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_WEBHOOK === 'true';
    if (!allow) return res.status(403).json({ message: 'Not allowed' });

    const { referenceNumber, amount, checkoutId } = req.body;
    if (!referenceNumber || !amount) return res.status(400).json({ message: 'referenceNumber and amount required' });

    const exists = await Transaction.findOne({ reference: referenceNumber });
    if (exists) return res.status(200).json({ message: 'Already processed', transaction: exists });

    const parts = referenceNumber.split('-');
    if (!parts[0] || parts[0] !== 'TOPUP') return res.status(400).json({ message: 'Invalid reference format' });
    const userId = parts[1];
    const target = normalizeTarget(parts[2] || TOPUP_TARGET.EMPLOYER);
    const { Types } = await import('mongoose');
    if (!Types.ObjectId.isValid(userId)) return res.status(400).json({ message: 'Invalid reference user id' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const amountNum = Number(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) return res.status(400).json({ message: 'Invalid amount' });

    const topUpResult = await applyTopUpToUser({
      user,
      amount: amountNum,
      target,
      reference: referenceNumber,
      source: 'dev-webhook',
      checkoutId: checkoutId || null,
      actor: user._id,
    });

    await monitor.audit({
      actor: user._id,
      action: 'dev_webhook_topup',
      ip: req.ip || null,
      userAgent: req.get('user-agent'),
      amount: amountNum,
      status: 'success',
      meta: { target: topUpResult.target, referenceNumber },
    });
    await monitor.recordTopUp({ userId: String(user._id), ip: req.ip || null });
    return res.status(200).json({
      message: 'Simulated top-up applied',
      ...(topUpResult.target === TOPUP_TARGET.BOTH ? { transactions: topUpResult.transactions } : { transaction: topUpResult.transaction }),
    });
  } catch (error) {
    console.error('Simulate webhook error', error);
    return res.status(500).json({ message: 'Simulate failed' });
  }
}

export async function createPayoutRequest(req, res) {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Authentication required' });

    const { amount, destinationSnapshot } = req.body || {};
    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: 'Invalid payout amount' });
    }

    const methodType = String(destinationSnapshot?.methodType || '').trim();
    const institutionName = String(destinationSnapshot?.institutionName || '').trim();
    const accountName = String(destinationSnapshot?.accountName || '').trim();
    const accountNumber = String(destinationSnapshot?.accountNumber || '').trim();
    if (!methodType || !institutionName || !accountName || !accountNumber) {
      return res.status(400).json({ message: 'Complete destination details are required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!canWithdrawWorkerBalance(user.role)) {
      return res.status(403).json({ message: 'Only worker accounts can request withdrawals' });
    }
    if ((user.workerBalance || 0) < numericAmount) {
      return res.status(400).json({ message: 'Insufficient worker balance' });
    }

    user.workerBalance = Number((user.workerBalance - numericAmount).toFixed(2));
    await user.save();

    const payoutRequest = await PayoutRequest.create({
      user: user._id,
      amount: numericAmount,
      destinationSnapshot: {
        methodType,
        institutionName,
        accountName,
        accountNumber,
        accountNumberMasked: maskAccountNumber(accountNumber),
      },
      status: 'requested',
    });

    const transaction = await Transaction.create({
      sender: user._id,
      receiver: null,
      amount: numericAmount,
      type: 'PAYOUT',
      status: 'PENDING',
      balanceTarget: 'WORKER',
      payoutRequest: payoutRequest._id,
      reference: `PAYOUT-${payoutRequest._id}-${Date.now()}`,
      provider: 'manual_admin_review',
      providerReference: String(payoutRequest._id),
      label: 'Payout request',
      relatedEntityType: 'payout_request',
      relatedEntityId: String(payoutRequest._id),
      meta: {
        destinationSnapshot: {
          ...payoutRequest.destinationSnapshot.toObject(),
          accountNumber: undefined,
        },
      },
      actor: user._id,
    });

    payoutRequest.transaction = transaction._id;
    await payoutRequest.save();

    await notifyAdminsOfPayoutRequest(payoutRequest, user._id);
    await monitor.audit({
      actor: user._id,
      action: 'payout_requested',
      ip: req.ip || null,
      userAgent: req.get('user-agent'),
      amount: numericAmount,
      status: 'initiated',
      meta: { payoutRequestId: payoutRequest._id },
    });

    const populated = await PayoutRequest.findById(payoutRequest._id)
      .populate('transaction')
      .populate('user', 'firstName lastName email');
    return res.status(201).json({ message: 'Payout request submitted.', payoutRequest: populated });
  } catch (error) {
    console.error('Create payout request error', error);
    return res.status(500).json({ message: 'Failed to create payout request' });
  }
}

export async function listMyPayoutRequests(req, res) {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Authentication required' });

    const requests = await PayoutRequest.find({ user: userId })
      .populate('transaction')
      .populate('reviewer', 'firstName lastName email')
      .sort({ createdAt: -1 });

    return res.status(200).json({ payoutRequests: requests });
  } catch (error) {
    console.error('List my payout requests error', error);
    return res.status(500).json({ message: 'Failed to fetch payout requests' });
  }
}

export async function cancelPayoutRequest(req, res) {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { payoutRequestId } = req.params;
    if (!userId) return res.status(401).json({ message: 'Authentication required' });

    const payoutRequest = await PayoutRequest.findOne({ _id: payoutRequestId, user: userId });
    if (!payoutRequest) return res.status(404).json({ message: 'Payout request not found' });
    if (payoutRequest.status !== 'requested') {
      return res.status(400).json({ message: 'Only requested payouts can be cancelled' });
    }

    const { refund } = await createPayoutRefund({
      payoutRequest,
      actorId: userId,
      reason: 'cancelled_by_user',
      status: 'cancelled',
    });

    payoutRequest.status = 'cancelled';
    payoutRequest.cancelledAt = new Date();
    payoutRequest.reviewedAt = new Date();
    payoutRequest.reviewNotes = 'Cancelled by user.';
    await payoutRequest.save();

    await notifyUserPayoutStatus(payoutRequest, userId, 'Payout cancelled', 'Your payout request was cancelled and the amount was returned to your worker balance.');
    return res.status(200).json({ message: 'Payout request cancelled.', payoutRequest, refundTransaction: refund });
  } catch (error) {
    console.error('Cancel payout request error', error);
    return res.status(500).json({ message: 'Failed to cancel payout request' });
  }
}

export async function listAdminPayoutRequests(req, res) {
  try {
    const { status, search } = req.query || {};
    const filter = {};
    if (status) filter.status = status;

    let requests = await PayoutRequest.find(filter)
      .populate('user', 'firstName lastName email role status workerBalance')
      .populate('reviewer', 'firstName lastName email')
      .populate('transaction')
      .sort({ createdAt: -1 });

    if (search) {
      const query = String(search).trim().toLowerCase();
      requests = requests.filter((item) => {
        const name = `${item.user?.firstName || ''} ${item.user?.lastName || ''}`.toLowerCase();
        const email = String(item.user?.email || '').toLowerCase();
        const institutionName = String(item.destinationSnapshot?.institutionName || '').toLowerCase();
        return name.includes(query) || email.includes(query) || institutionName.includes(query);
      });
    }

    return res.status(200).json({ payoutRequests: requests });
  } catch (error) {
    console.error('List admin payout requests error', error);
    return res.status(500).json({ message: 'Failed to fetch payout requests' });
  }
}

export async function updateAdminPayoutRequest(req, res) {
  try {
    const { payoutRequestId } = req.params;
    const { status, reviewNotes } = req.body || {};
    const actorId = req.user?.id || req.user?.userId;
    const allowed = ['approved', 'rejected', 'paid'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid payout status' });
    }

    const payoutRequest = await PayoutRequest.findById(payoutRequestId);
    if (!payoutRequest) return res.status(404).json({ message: 'Payout request not found' });
    if (['rejected', 'paid', 'cancelled'].includes(payoutRequest.status)) {
      return res.status(400).json({ message: 'Payout request is already finalized' });
    }

    payoutRequest.reviewer = actorId;
    payoutRequest.reviewedAt = new Date();
    payoutRequest.reviewNotes = reviewNotes ? String(reviewNotes).trim() : payoutRequest.reviewNotes;

    if (status === 'approved') {
      payoutRequest.status = 'approved';
      await payoutRequest.save();
      await notifyUserPayoutStatus(payoutRequest, actorId, 'Payout approved', 'Your payout request has been approved and is awaiting payment completion.');
    }

    if (status === 'paid') {
      payoutRequest.status = 'paid';
      payoutRequest.paidAt = new Date();
      await payoutRequest.save();
      if (payoutRequest.transaction) {
        await Transaction.findByIdAndUpdate(payoutRequest.transaction, {
          $set: { status: 'COMPLETED' },
        });
      }
      await notifyUserPayoutStatus(payoutRequest, actorId, 'Payout paid', 'Your payout request has been marked as paid.');
    }

    if (status === 'rejected') {
      payoutRequest.status = 'rejected';
      await payoutRequest.save();
      await createPayoutRefund({
        payoutRequest,
        actorId,
        reason: reviewNotes ? String(reviewNotes).trim() : 'rejected_by_admin',
        status: 'rejected',
      });
      await notifyUserPayoutStatus(payoutRequest, actorId, 'Payout rejected', 'Your payout request was rejected and the amount was returned to your worker balance.');
    }

    const populated = await PayoutRequest.findById(payoutRequest._id)
      .populate('user', 'firstName lastName email role status workerBalance')
      .populate('reviewer', 'firstName lastName email')
      .populate('transaction');
    return res.status(200).json({ message: 'Payout request updated.', payoutRequest: populated });
  } catch (error) {
    console.error('Update admin payout request error', error);
    return res.status(500).json({ message: 'Failed to update payout request' });
  }
}

export async function getAllTransactions(req, res) {
  try {
    const requesterId = req.user?.id || req.user?.userId;
    if (!requesterId) return res.status(401).json({ message: 'Authentication required' });

    const requester = await User.findById(requesterId).select('role');
    const role = requester?.role || '';
    if (!requester || (role !== 'admin' && role !== 'superadmin')) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const txs = await populateTransactionQuery(
      Transaction.find().sort({ createdAt: -1 }).limit(1000)
    );
    return res.status(200).json({ transactions: txs });
  } catch (error) {
    console.error('Get all transactions error', error);
    return res.status(500).json({ message: 'Failed to fetch transactions' });
  }
}

export default {
  getUserTransactions,
  createTopUpSession,
  handleWebhook,
  confirmTopUp,
  simulateWebhook,
  getAllTransactions,
  createPayoutRequest,
  listMyPayoutRequests,
  cancelPayoutRequest,
  listAdminPayoutRequests,
  updateAdminPayoutRequest,
};
