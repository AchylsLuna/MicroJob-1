// controllers/PaymentController.js
import axios from 'axios';
import crypto from 'crypto';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import monitor from '../lib/monitor.js';
import AuditLog from '../models/AuditLog.js';

const PAYMONGO_BASE = 'https://api.paymongo.com/v1';

export async function getUserTransactions(req, res) {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId) return res.status(401).json({ message: 'Authentication required' });

        const txs = await Transaction.find({ $or: [{ sender: userId }, { receiver: userId }] })
            .populate('sender', 'name email')
            .populate('receiver', 'name email')
            .populate('jobReference', 'title')
            .sort({ createdAt: -1 });

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
        // If CSRF double-submit protection is enabled, require the header to match cookie
        if (process.env.ENABLE_CSRF === 'true') {
            const tokenHeader = req.headers['x-csrf-token'];
            const cookieName = process.env.CSRF_COOKIE_NAME || 'XSRF-TOKEN';
            const tokenCookie = req.cookies && req.cookies[cookieName];
            if (!tokenHeader || !tokenCookie || tokenHeader !== tokenCookie) {
                return res.status(403).json({ message: 'CSRF token missing or invalid' });
            }
        }
        const { amount, target } = req.body;
        const userId = req.user.id;

        // Basic input validation & sanitization
        const minAmount = Number(process.env.TOPUP_MIN_AMOUNT || 100);
        const maxAmount = Number(process.env.TOPUP_MAX_AMOUNT || 1000000);
        const parsedAmount = Number(amount);
        if (Number.isNaN(parsedAmount) || parsedAmount < minAmount || parsedAmount > maxAmount) {
            return res.status(400).json({ message: `Invalid amount; must be between ${minAmount} and ${maxAmount}` });
        }

        const allowedTargets = ['EMPLOYER', 'WORKER', 'BOTH'];
        let effectiveTarget = target;
        if (effectiveTarget) effectiveTarget = String(effectiveTarget).toUpperCase();
        if (effectiveTarget && !allowedTargets.includes(effectiveTarget)) {
            return res.status(400).json({ message: 'Invalid target' });
        }

        const requestingUser = await User.findById(userId).select('role');
        if (!effectiveTarget) {
            effectiveTarget = (requestingUser && requestingUser.role === 'both') ? 'BOTH' : 'EMPLOYER';
        }

        const amountInCentavos = Math.round(parsedAmount * 100);

        // audit initiation after reading inputs
        await monitor.audit({ actor: req.user?.id || null, action: 'topup_initiated', ip, userAgent: ua, amount: parsedAmount, status: 'initiated', meta: { target: effectiveTarget } });

        // ensure userId is a safe identifier (prevent IDOR injection)
        const { Types } = await import('mongoose');
        if (!Types.ObjectId.isValid(userId)) return res.status(400).json({ message: 'Invalid user id' });

        const referenceNumber = `TOPUP-${userId}-${effectiveTarget}-${Date.now()}`;

        // ensure PAYMONGO secret exists
        if (!process.env.PAYMONGO_SECRET_KEY) {
            console.error('PAYMONGO_SECRET_KEY not configured');
            return res.status(500).json({ message: 'Payment provider not configured' });
        }

        const options = {
            method: 'POST',
            url: `${PAYMONGO_BASE}/checkout_sessions`,
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString('base64')}`
            },
            data: {
                data: {
                    attributes: {
                        payment_method_types: ['gcash'],
                        line_items: [{ currency: 'PHP', amount: amountInCentavos, name: 'E-Wallet Top Up', quantity: 1 }],
                        reference_number: referenceNumber,
                        success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/topup-success?ref=${encodeURIComponent(referenceNumber)}`,
                        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/wallet`
                    }
                }
            }
        };

        const response = await axios.request(options);
        const checkout = response.data.data;

        return res.status(200).json({ checkoutUrl: checkout.attributes.checkout_url, referenceNumber, checkoutId: checkout.id });

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
            const [k, v] = p.split('='); acc[k] = v; return acc; }, {});
        const timestamp = parts.t;
        const signature = parts.te;

        // Basic signature/timestamp checks
        if (!timestamp || !signature) return res.status(400).send('Webhook Error: malformed signature header');
        // protect against replay attacks: allow 5 minute window
        const tsNum = Number(timestamp);
        const nowSec = Math.floor(Date.now() / 1000);
        if (Number.isNaN(tsNum) || Math.abs(nowSec - tsNum) > 300) {
            console.error('Webhook timestamp outside allowed window', { timestamp, nowSec });
            return res.status(400).send('Webhook Error: timestamp invalid or expired');
        }

        const payloadString = `${timestamp}.${JSON.stringify(req.body)}`;
        const expectedSignature = crypto.createHmac('sha256', webhookSecret || '').update(payloadString).digest('hex');
        if (signature !== expectedSignature) {
            console.error('Webhook signature mismatch');
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
                const target = (partsRef[2] || 'EMPLOYER').toUpperCase();

                let amountAdded = 0;
                if (checkoutAttrs.payments && checkoutAttrs.payments.length > 0) {
                    amountAdded = checkoutAttrs.payments[0].attributes.amount / 100;
                } else if (checkoutAttrs.line_items && checkoutAttrs.line_items.length > 0) {
                    amountAdded = checkoutAttrs.line_items[0].amount / 100;
                }

                if (amountAdded <= 0) {
                    console.error('Webhook: no amount found', checkoutAttrs);
                    return res.status(400).send('Webhook Error: No payment amount');
                }

                const user = await User.findById(userId);
                if (!user) return res.status(404).send('User not found');

                // prevent duplicate transaction entries
                const exists = await Transaction.findOne({ reference: referenceNumber });
                if (exists) {
                    console.log('Webhook: transaction already processed', referenceNumber);
                    return res.status(200).send('Already processed');
                }

                if (target === 'BOTH') {
                    user.workerBalance = (user.workerBalance || 0) + amountAdded;
                    user.employerBalance = (user.employerBalance || 0) + amountAdded;
                    await user.save();

                    const label = `Top-up (Both)`;
                    await Transaction.create({ sender: null, receiver: user._id, amount: amountAdded, type: 'TOP_UP', reference: referenceNumber, label, meta: { source: 'paymongo', checkout_id: checkoutId } });
                    await Transaction.create({ sender: null, receiver: user._id, amount: amountAdded, type: 'TOP_UP', reference: referenceNumber, label, meta: { source: 'paymongo', checkout_id: checkoutId } });
                } else {
                    if (target === 'WORKER') {
                        user.workerBalance = (user.workerBalance || 0) + amountAdded;
                    } else {
                        user.employerBalance = (user.employerBalance || 0) + amountAdded;
                    }
                    await user.save();

                    const label = `Top-up (${target === 'WORKER' ? 'Worker' : 'Employer'})`;
                    await Transaction.create({ sender: null, receiver: user._id, amount: amountAdded, type: 'TOP_UP', reference: referenceNumber, label, meta: { source: 'paymongo', checkout_id: checkoutId } });
                }

                console.log(`Webhook: topped up ${amountAdded} for ${userId} (${target})`);
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
        // CSRF double-submit check for cookie-based auth flows (optional)
        if (process.env.ENABLE_CSRF === 'true') {
            const tokenHeader = req.headers['x-csrf-token'];
            const cookieName = process.env.CSRF_COOKIE_NAME || 'XSRF-TOKEN';
            const tokenCookie = req.cookies && req.cookies[cookieName];
            if (!tokenHeader || !tokenCookie || tokenHeader !== tokenCookie) {
                return res.status(403).json({ message: 'CSRF token missing or invalid' });
            }
        }
        const { referenceNumber, checkoutId } = req.body;
        if (!referenceNumber && !checkoutId) return res.status(400).json({ message: 'referenceNumber or checkoutId required' });

        // avoid duplicates: check by reference or by checkout id
        let existing = null;
        if (referenceNumber) existing = await Transaction.findOne({ reference: referenceNumber });
        if (!existing && checkoutId) existing = await Transaction.findOne({ 'meta.checkout_id': checkoutId });
        if (existing) return res.status(200).json({ message: 'Already processed', transaction: existing });

        const authHeader = { headers: { authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString('base64')}` } };
        let resp;
        if (checkoutId) {
            resp = await axios.get(`${PAYMONGO_BASE}/checkout_sessions/${checkoutId}`, authHeader);
        } else if (referenceNumber) {
            // list and search for matching reference_number
            resp = await axios.get(`${PAYMONGO_BASE}/checkout_sessions`, authHeader);
            const found = (resp.data.data || []).find((c) => c.attributes?.reference_number === referenceNumber);
            if (!found) return res.status(404).json({ message: 'Checkout session not found' });
            resp.data.data = found;
        } else {
            return res.status(400).json({ message: 'referenceNumber or checkoutId required' });
        }
        const checkout = resp.data.data;
        const attrs = checkout.attributes || {};
        const ref = attrs.reference_number || referenceNumber;

        // validate reference format and ownership: TOPUP-<userId>-<TARGET>-<ts>
        const refParts = (ref || '').split('-');
        if (refParts.length < 4 || refParts[0] !== 'TOPUP') {
            return res.status(400).json({ message: 'Invalid reference format' });
        }
        const refUserId = refParts[1];
        const { Types } = await import('mongoose');
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

        const parts = (ref || '').split('-');
        const userId = parts[1];
        const target = (parts[2] || 'EMPLOYER').toUpperCase();

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (target === 'BOTH') {
            user.workerBalance = (user.workerBalance || 0) + amountAdded;
            user.employerBalance = (user.employerBalance || 0) + amountAdded;
            await user.save();
            const label = `Top-up (Both)`;
            const tx1 = await Transaction.create({ sender: null, receiver: user._id, amount: amountAdded, type: 'TOP_UP', reference: ref, label, meta: { source: 'paymongo', checkout_id: checkout.id }, actor: user._id });
            const tx2 = await Transaction.create({ sender: null, receiver: user._id, amount: amountAdded, type: 'TOP_UP', reference: ref, label, meta: { source: 'paymongo', checkout_id: checkout.id }, actor: user._id });
            await monitor.audit({ actor: user._id, action: 'confirm_topup', ip: req.ip || null, userAgent: req.get('user-agent'), amount: amountAdded, status: 'success', meta: { target: 'BOTH', ref } });
            await monitor.recordTopUp({ userId: String(user._id), ip: req.ip || null });
            return res.status(200).json({ message: 'Top-up applied', transactions: [tx1, tx2] });
        }

        if (target === 'WORKER') user.workerBalance = (user.workerBalance || 0) + amountAdded;
        else user.employerBalance = (user.employerBalance || 0) + amountAdded;
        await user.save();

        const labelSingle = `Top-up (${target === 'WORKER' ? 'Worker' : 'Employer'})`;
        const tx = await Transaction.create({ sender: null, receiver: user._id, amount: amountAdded, type: 'TOP_UP', reference: ref, label: labelSingle, meta: { source: 'paymongo', checkout_id: checkout.id }, actor: user._id });
        await monitor.audit({ actor: user._id, action: 'confirm_topup', ip: req.ip || null, userAgent: req.get('user-agent'), amount: amountAdded, status: 'success', meta: { target, ref } });
        await monitor.recordTopUp({ userId: String(user._id), ip: req.ip || null });
        return res.status(200).json({ message: 'Top-up applied', transaction: tx });

    } catch (error) {
        console.error('Confirm top-up error', error.response?.data || error.message || error);
        return res.status(500).json({ message: 'Failed to confirm top-up' });
    }
}

// Dev helper: simulate a PayMongo webhook (only allowed in non-production or when ALLOW_DEV_WEBHOOK=true)
export async function simulateWebhook(req, res) {
    try {
        const allow = process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_WEBHOOK === 'true';
        if (!allow) return res.status(403).json({ message: 'Not allowed' });

        const { referenceNumber, amount, checkoutId } = req.body;
        if (!referenceNumber || !amount) return res.status(400).json({ message: 'referenceNumber and amount required' });

        // Prevent duplicate processing
        const exists = await Transaction.findOne({ reference: referenceNumber });
        if (exists) return res.status(200).json({ message: 'Already processed', transaction: exists });

        const parts = referenceNumber.split('-');
        if (!parts[0] || parts[0] !== 'TOPUP') return res.status(400).json({ message: 'Invalid reference format' });
        const userId = parts[1];
        const target = (parts[2] || 'EMPLOYER').toUpperCase();
        const { Types } = await import('mongoose');
        if (!Types.ObjectId.isValid(userId)) return res.status(400).json({ message: 'Invalid reference user id' });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const amountNum = Number(amount);
        if (Number.isNaN(amountNum) || amountNum <= 0) return res.status(400).json({ message: 'Invalid amount' });

        if (target === 'BOTH') {
            user.workerBalance = (user.workerBalance || 0) + amountNum;
            user.employerBalance = (user.employerBalance || 0) + amountNum;
            await user.save();
            const label = `Top-up (Both)`;
            const tx1 = await Transaction.create({ sender: null, receiver: user._id, amount: amountNum, type: 'TOP_UP', reference: referenceNumber, label, meta: { source: 'dev-webhook', checkout_id: checkoutId || null } });
            const tx2 = await Transaction.create({ sender: null, receiver: user._id, amount: amountNum, type: 'TOP_UP', reference: referenceNumber, label, meta: { source: 'dev-webhook', checkout_id: checkoutId || null } });
            await monitor.audit({ actor: user._id, action: 'dev_webhook_topup', ip: req.ip || null, userAgent: req.get('user-agent'), amount: amountNum, status: 'success', meta: { target: 'BOTH', referenceNumber } });
            await monitor.recordTopUp({ userId: String(user._id), ip: req.ip || null });
            return res.status(200).json({ message: 'Simulated top-up applied', transactions: [tx1, tx2] });
        }

        if (target === 'WORKER') user.workerBalance = (user.workerBalance || 0) + amountNum;
        else user.employerBalance = (user.employerBalance || 0) + amountNum;
        await user.save();

        const label = `Top-up (${target === 'WORKER' ? 'Worker' : 'Employer'})`;
        const tx = await Transaction.create({ sender: null, receiver: user._id, amount: amountNum, type: 'TOP_UP', reference: referenceNumber, label, meta: { source: 'dev-webhook', checkout_id: checkoutId || null } });
        await monitor.audit({ actor: user._id, action: 'dev_webhook_topup', ip: req.ip || null, userAgent: req.get('user-agent'), amount: amountNum, status: 'success', meta: { target, referenceNumber } });
        await monitor.recordTopUp({ userId: String(user._id), ip: req.ip || null });
        return res.status(200).json({ message: 'Simulated top-up applied', transaction: tx });
    } catch (error) {
        console.error('Simulate webhook error', error);
        return res.status(500).json({ message: 'Simulate failed' });
    }
}

export async function getAllTransactions(req, res) {
    try {
        const requesterId = req.user?.id || req.user?.userId;
        if (!requesterId) return res.status(401).json({ message: 'Authentication required' });

        const requester = await User.findById(requesterId).select('role');
        if (!requester || requester.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

        const txs = await Transaction.find()
            .populate('sender', 'name email')
            .populate('receiver', 'name email')
            .populate('jobReference', 'title')
            .sort({ createdAt: -1 })
            .limit(1000);

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
    getAllTransactions
};
