import crypto from 'crypto';
import QRCode from 'qrcode';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import QrSettlementRequest from '../models/QrSettlementRequest.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { settleApplicationPayment } from '../services/applicationSettlement.js';
import monitor from '../lib/monitor.js';
import { createNotification } from '../lib/notificationService.js';
import { deleteStoredUpload, getStoredUpload, saveStoredUpload } from '../lib/uploadStore.js';
import { emitToUser } from '../lib/socket.js';

const hash = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const cipherKey = () => crypto.createHash('sha256').update(String(process.env.QR_INVOICE_SECRET || process.env.JWT_SECRET || 'microjobs-local-qr-secret')).digest();
const encryptCode = (value) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
};
const decryptCode = (value) => {
  const [iv, tag, encrypted] = String(value || '').split('.').map((part) => Buffer.from(part, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', cipherKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};
const getUserId = (req) => String(req.user?.id || req.user?.userId || '');
const isWorkerRole = (role) => ['work', 'both'].includes(String(role || '').toLowerCase());
const isEmployerRole = (role) => ['hire', 'both'].includes(String(role || '').toLowerCase());

const expireIfNeeded = async (request) => {
  if (request?.status === 'active' && request.expiresAt.getTime() <= Date.now()) {
    const result = await QrSettlementRequest.updateOne({ _id: request._id, status: 'active' }, { $set: { status: 'expired' } });
    request.status = 'expired';
    if (result.modifiedCount > 0) await createNotification({ userId: request.requestingWorker, audience: 'worker', type: 'payment', title: 'Payment invoice expired', message: 'Your job payment invoice expired. You can generate a replacement from E-Wallet.', entityType: 'payment_request', entityId: request._id }).catch(() => undefined);
  }
  return request;
};

const buildPreview = async (request) => {
  await request.populate([
    { path: 'job', select: 'title salary status positionsNeeded hiredCount jobPoster' },
    { path: 'requestingWorker', select: 'firstName lastName' },
    { path: 'employer', select: 'firstName lastName companyName' },
    { path: 'application', select: 'applicant agreedAmount workStatus paymentStatus' },
  ]);
  const application = request.application;
  const amount = Number(application?.agreedAmount || request.salarySnapshot || request.job.salary || 0);
  const workers = [{ applicationId: String(application?._id), workerId: String(request.requestingWorker._id), name: [request.requestingWorker.firstName, request.requestingWorker.lastName].filter(Boolean).join(' ') || 'Worker', amount }];
  return {
    requestId: String(request._id), status: request.status, expiresAt: request.expiresAt,
    job: { id: String(request.job._id), title: request.job.title, status: request.job.status },
    requestingWorker: { id: String(request.requestingWorker._id), name: [request.requestingWorker.firstName, request.requestingWorker.lastName].filter(Boolean).join(' ') || 'Worker' },
    employer: { id: String(request.employer._id), name: request.employer.companyName || [request.employer.firstName, request.employer.lastName].filter(Boolean).join(' ') || 'Employer' },
    workers,
    application: { id: String(application?._id), workStatus: application?.workStatus, paymentStatus: application?.paymentStatus },
    amountPerWorker: amount,
    totalAmount: amount,
  };
};

const validateSettlementState = async (request) => {
  const job = await Job.findById(request.job).select('salary status jobPoster');
  if (!job || !['Available', 'In Progress', 'Closed'].includes(job.status)) return { status: 409, message: 'The job is no longer active.' };
  if (String(job.jobPoster) !== String(request.employer)) return { status: 409, message: 'The job employer changed after this QR was created.' };
  const application = await JobApplication.findOne({ _id: request.application, job: job._id, applicant: request.requestingWorker, status: 'Hired' });
  if (!application || application.workStatus !== 'Submitted') return { status: 409, message: 'This worker has not submitted finished work.' };
  if (application.paymentStatus === 'Paid') return { status: 409, message: 'This worker has already been paid.' };
  if (Number(application.agreedAmount || job.salary) !== Number(request.salarySnapshot)) return { status: 409, message: 'The agreed payment changed. Ask the worker to generate a new QR.' };
  return null;
};

export async function createQrSettlementRequest(req, res) {
  let qrImageName;
  let message;
  let notification;
  let request;
  try {
    const userId = getUserId(req);
    const user = await User.findById(userId).select('role');
    if (!user || !isWorkerRole(user.role)) return res.status(403).json({ message: 'Only worker accounts can request job settlement.' });
    const job = await Job.findById(req.body?.jobId);
    if (!job) return res.status(404).json({ message: 'Job not found.' });
    if (!['Available', 'In Progress', 'Closed'].includes(job.status)) return res.status(409).json({ message: 'Only an active hired job can be settled by QR.' });
    const application = await JobApplication.findOne({ job: job._id, applicant: userId, status: 'Hired' });
    if (!application) return res.status(403).json({ message: 'Only a hired worker can create this payment request.' });
    if (application.workStatus !== 'Submitted') return res.status(409).json({ message: 'Submit finished work before creating a payment QR.' });
    if (application.paymentStatus === 'Paid') return res.status(409).json({ message: 'This work is already paid.' });

    const existing = await QrSettlementRequest.findOne({ application: application._id, status: 'active', expiresAt: { $gt: new Date() } }).select('+shortCodeCipher');
    if (existing?.shortCodeCipher && existing.qrImageName && req.body?.replace !== true) {
      return res.status(200).json({ requestId: String(existing._id), imageUrl: `/api/payment/qr-requests/${existing._id}/image`, shortCode: decryptCode(existing.shortCodeCipher), expiresAt: existing.expiresAt, preview: await buildPreview(existing), deduplicated: true });
    }
    await QrSettlementRequest.updateMany({ application: application._id, status: 'active' }, { $set: { status: 'cancelled' } });
    const token = crypto.randomBytes(32).toString('base64url');
    const shortCode = crypto.randomBytes(5).toString('hex').slice(0, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const requestId = crypto.randomBytes(12).toString('hex');
    const qrPayload = `microjobs://wallet/settle?token=${token}`;
    qrImageName = `qr_invoice_${requestId}.png`;
    const qrBuffer = await QRCode.toBuffer(qrPayload, { type: 'png', width: 720, margin: 3, errorCorrectionLevel: 'M', color: { dark: '#0F2954', light: '#FFFFFF' } });
    await saveStoredUpload({ filename: qrImageName, buffer: qrBuffer, contentType: 'image/png', metadata: { kind: 'settlement_request', requestId, purgeAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
    request = await QrSettlementRequest.create({
      _id: requestId,
      job: job._id, application: application._id, requestingWorker: userId, employer: job.jobPoster,
      salarySnapshot: Number(application.agreedAmount || job.salary || 0), hiredWorkerSnapshot: [userId],
      tokenHash: hash(token), shortCodeHash: hash(shortCode), shortCodeCipher: encryptCode(shortCode), qrImageName, expiresAt,
      purgeAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    const preview = await buildPreview(request);
    message = await Message.create({ sender: userId, receiver: job.jobPoster, job: job._id, content: `Payment invoice for ${job.title}`, clientMessageId: `settlement:${request._id}`, attachment: { type: 'settlement_request', settlementRequest: request._id, qrImageName, jobTitle: job.title, totalAmount: preview.totalAmount, expiresAt } });
    const hydratedMessage = await Message.findById(message._id).populate('sender', 'firstName lastName').populate('receiver', 'firstName lastName').populate('job', 'title').populate('attachment.settlementRequest', 'status expiresAt settledAt');
    emitToUser(String(job.jobPoster), 'new_message', hydratedMessage || message);
    emitToUser(String(userId), 'new_message_echo', hydratedMessage || message);
    notification = await createNotification({ userId: job.jobPoster, audience: 'employer', type: 'payment', title: 'Job payment requested', message: `${preview.requestingWorker.name} requested settlement for ${job.title}.`, entityType: 'payment_request', entityId: request._id, actor: userId, metadata: { requestId: String(request._id), jobId: String(job._id), messageId: String(message._id) }, pushData: { type: 'payment_request', requestId: String(request._id), jobId: String(job._id), audience: 'employer' } });
    request.chatMessage = message._id; request.employerNotification = notification._id;
    await request.save();
    await monitor.audit({ actor: userId, action: 'qr_settlement_created', status: 'success', meta: { job: String(job._id), request: String(request._id) } });
    return res.status(201).json({ requestId: String(request._id), qrPayload, imageUrl: `/api/payment/qr-requests/${request._id}/image`, shortCode, expiresAt, chatMessageId: String(message._id), preview });
  } catch (error) {
    if (notification?._id) await Notification.deleteOne({ _id: notification._id }).catch(() => undefined);
    if (message?._id) await Message.deleteOne({ _id: message._id }).catch(() => undefined);
    if (request?._id) await QrSettlementRequest.deleteOne({ _id: request._id }).catch(() => undefined);
    if (qrImageName) await deleteStoredUpload(qrImageName).catch(() => undefined);
    console.error('Create QR settlement error:', error);
    return res.status(500).json({ message: 'Failed to create QR payment request.' });
  }
}

export async function listQrSettlementRequests(req, res) {
  try {
    const userId = getUserId(req);
    const user = await User.findById(userId).select('role');
    if (!user) return res.status(401).json({ message: 'Authenticated account was not found.' });

    const requestedMode = String(req.query?.mode || '').trim().toLowerCase();
    if (requestedMode && !['worker', 'employer'].includes(requestedMode)) {
      return res.status(400).json({ message: 'Wallet mode must be worker or employer.' });
    }
    const mode = requestedMode || (String(user.role).toLowerCase() === 'hire' ? 'employer' : 'worker');
    if (mode === 'worker' && !isWorkerRole(user.role)) {
      return res.status(403).json({ message: 'Worker payment requests are unavailable for this account.' });
    }
    if (mode === 'employer' && !isEmployerRole(user.role)) {
      return res.status(403).json({ message: 'Employer payment requests are unavailable for this account.' });
    }

    const ownerQuery = mode === 'employer' ? { employer: userId } : { requestingWorker: userId };
    const requests = await QrSettlementRequest.find(ownerQuery).sort({ createdAt: -1 }).limit(30);
    const items = await Promise.all(requests.map(async (request) => {
      await expireIfNeeded(request);
      return {
        preview: await buildPreview(request),
        imageUrl: `/api/payment/qr-requests/${request._id}/image`,
        chatMessageId: request.chatMessage ? String(request.chatMessage) : null,
      };
    }));
    return res.status(200).json({ mode, requests: items });
  } catch (error) {
    console.error('List QR settlement requests error:', error);
    return res.status(500).json({ message: 'Failed to load payment requests.' });
  }
}

export async function getQrSettlementRequest(req, res) {
  const userId = getUserId(req);
  const request = await expireIfNeeded(await QrSettlementRequest.findOne({ _id: req.params.requestId, $or: [{ requestingWorker: userId }, { employer: userId }] }).select('+shortCodeCipher'));
  if (!request) return res.status(404).json({ message: 'Payment request not found.' });
  const shortCode = request.status === 'active' ? decryptCode(request.shortCodeCipher) : null;
  return res.status(200).json({ preview: await buildPreview(request), imageUrl: `/api/payment/qr-requests/${request._id}/image`, shortCode, chatMessageId: request.chatMessage ? String(request.chatMessage) : null });
}

export async function getQrSettlementImage(req, res) {
  const userId = getUserId(req);
  const request = await QrSettlementRequest.findOne({ _id: req.params.requestId, $or: [{ requestingWorker: userId }, { employer: userId }] }).select('qrImageName');
  if (!request) return res.status(404).json({ message: 'QR image not found.' });
  const upload = await getStoredUpload(request.qrImageName);
  if (!upload) return res.status(404).json({ message: 'QR image is no longer available.' });
  res.set('Cache-Control', 'private, no-store');
  res.type('image/png');
  return res.send(upload.data);
}

export async function resolveQrSettlementRequest(req, res) {
  try {
    const userId = getUserId(req);
    const user = await User.findById(userId).select('role');
    if (!user || !isEmployerRole(user.role)) return res.status(403).json({ message: 'Only employer accounts can scan payment requests.' });
    const raw = String(req.body?.token || req.body?.code || '').trim();
    const token = raw.startsWith('microjobs://') ? new URL(raw).searchParams.get('token') : req.body?.token;
    const query = req.body?.code ? { shortCodeHash: hash(String(req.body.code).toUpperCase()) } : { tokenHash: hash(token) };
    const request = await expireIfNeeded(await QrSettlementRequest.findOne(query));
    if (!request) return res.status(404).json({ message: 'Payment QR or code is invalid.' });
    if (String(request.employer) !== userId) return res.status(403).json({ message: 'This payment request belongs to another employer.' });
    if (request.status !== 'active') return res.status(409).json({ message: `This payment request is ${request.status}.` });
    const invalidState = await validateSettlementState(request);
    if (invalidState) return res.status(invalidState.status).json({ message: invalidState.message });
    return res.status(200).json({ preview: await buildPreview(request) });
  } catch (error) {
    return res.status(400).json({ message: 'Unable to read this MicroJobs payment QR.' });
  }
}

export async function settleQrSettlementRequest(req, res) {
  const userId = getUserId(req);
  let request;
  let settlementCommitted = false;
  try {
    const user = await User.findById(userId).select('role');
    if (!user || !isEmployerRole(user.role)) return res.status(403).json({ message: 'Only employer accounts can settle jobs.' });
    request = await QrSettlementRequest.findOneAndUpdate(
      { _id: req.params.requestId, employer: userId, status: 'active', expiresAt: { $gt: new Date() } },
      { $set: { status: 'settling' } }, { returnDocument: 'after' },
    );
    if (!request) return res.status(409).json({ message: 'This payment request is expired, settled, or unavailable.' });
    const invalidState = await validateSettlementState(request);
    if (invalidState) {
      await QrSettlementRequest.updateOne({ _id: request._id, status: 'settling' }, { $set: { status: 'cancelled' } });
      return res.status(invalidState.status).json({ message: invalidState.message });
    }

    const payload = await settleApplicationPayment({ applicationId: request.application, employerId: userId });
    settlementCommitted = true;
    const settlements = await Transaction.find({ relatedEntityType: 'job_application', relatedEntityId: String(request.application), type: 'PAYOUT', status: 'COMPLETED' }).distinct('_id');
    request.status = 'settled'; request.settledAt = new Date(); request.settlementTransactions = settlements;
    await request.save();
    await monitor.audit({ actor: userId, action: 'qr_settlement_completed', status: 'success', meta: { job: String(request.job), request: String(request._id) } });
    return res.status(200).json({ message: 'Worker payment completed successfully.', job: payload?.job, application: payload?.application, settlementTransactions: settlements });
  } catch (error) {
    if (request?._id) {
      await QrSettlementRequest.updateOne(
        { _id: request._id, status: 'settling' },
        { $set: settlementCommitted ? { status: 'settled', settledAt: new Date() } : { status: 'active' } },
      ).catch(() => undefined);
    }
    console.error('Settle QR payment error:', error);
    return res.status(500).json({ message: 'Failed to settle this QR payment.' });
  }
}

export async function cancelQrSettlementRequest(req, res) {
  const updated = await QrSettlementRequest.findOneAndUpdate(
    { _id: req.params.requestId, requestingWorker: getUserId(req), status: 'active' },
    { $set: { status: 'cancelled' } }, { returnDocument: 'after' },
  );
  if (!updated) return res.status(404).json({ message: 'Active payment request not found.' });
  await createNotification({ userId: updated.requestingWorker, audience: 'worker', type: 'payment', title: 'Payment invoice cancelled', message: 'Your job payment invoice was cancelled.', entityType: 'payment_request', entityId: updated._id, push: false }).catch(() => undefined);
  return res.status(200).json({ message: 'Payment request cancelled.' });
}
