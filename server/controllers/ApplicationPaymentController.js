import mongoose from 'mongoose';
import JobApplication from '../models/JobApplication.js';
import FinancialDispute from '../models/FinancialDispute.js';
import { createNotification } from '../lib/notificationService.js';
import Message from '../models/Message.js';
import { emitToUser } from '../lib/socket.js';
import { settleApplicationPayment } from '../services/applicationSettlement.js';

const id = (req) => String(req.user?.id || req.user?.userId || '');

export async function openPaymentDispute(req, res) {
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ message: 'A reason is required to open a payment dispute.' });
  if (reason.length > 2000) return res.status(400).json({ message: 'The dispute reason must be 2000 characters or fewer.' });

  const session = await mongoose.startSession();
  let dispute;
  let application;
  try {
    await session.withTransaction(async () => {
      application = await JobApplication.findById(req.params.applicationId).populate('job').session(session);
      if (!application || application.status !== 'Hired') {
        throw Object.assign(new Error('Hired application not found.'), { status: 404 });
      }
      const employerId = String(application.job?.jobPoster || '');
      if (String(application.applicant) !== id(req) && employerId !== id(req)) {
        throw Object.assign(new Error('You are not a participant in this assignment.'), { status: 403 });
      }
      if (application.workStatus !== 'Submitted' || !['Secured', 'Authorized', 'Failed'].includes(application.paymentStatus)) {
        throw Object.assign(new Error('Only submitted work with pending payment can be disputed.'), { status: 409 });
      }
      const amount = Number(application.agreedAmount || application.job?.salary || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw Object.assign(new Error('The agreed payment amount is unavailable.'), { status: 409 });
      }

      const claimed = await JobApplication.updateOne(
        { _id: application._id, workStatus: 'Submitted', paymentStatus: { $in: ['Secured', 'Authorized', 'Failed'] } },
        { $set: { paymentStatus: 'Disputed' } },
        { session },
      );
      if (!claimed.modifiedCount) {
        throw Object.assign(new Error('This assignment already has a payment action in progress.'), { status: 409 });
      }

      const created = await FinancialDispute.create([{
        subject: `Payment dispute: ${application.job.title}`,
        raisedBy: id(req),
        application: application._id,
        amount,
        reason,
      }], { session });
      dispute = created[0];
      application.paymentStatus = 'Disputed';
      application.timeline.push({
        type: 'payment_dispute_opened',
        note: reason,
        actor: id(req),
        meta: { disputeId: String(dispute._id), amount },
        createdAt: new Date(),
      });
      await application.save({ session });
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: 'A payment dispute already exists for this assignment.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error('Open payment dispute error:', error);
    return res.status(500).json({ message: 'Failed to open payment dispute.' });
  } finally {
    await session.endSession();
  }

  const otherParty = String(application.applicant) === id(req) ? application.job.jobPoster : application.applicant;
  try {
    await createNotification({
      userId: otherParty,
      audience: String(application.applicant) === id(req) ? 'employer' : 'worker',
      type: 'payment',
      title: 'Payment dispute opened',
      message: `A payment dispute was opened for ${application.job.title}: ${reason}`,
      entityType: 'application',
      entityId: application._id,
      actor: id(req),
      push: true,
    });
  } catch (error) {
    console.error('Failed to notify the other party about a payment dispute:', error);
  }
  return res.status(201).json({ message: 'Payment dispute opened.', dispute });
}

export async function authorizePayment(req, res) {
  const app = await JobApplication.findOne({ _id: req.params.applicationId, status: 'Hired' }).populate('job');
  if (!app) return res.status(404).json({ message: 'Hired application not found.' });
  if (String(app.job?.jobPoster) !== id(req)) return res.status(403).json({ message: 'You cannot authorize this payment.' });
  if (app.paymentStatus === 'Paid') return res.status(409).json({ message: 'This worker is already paid.' });
  if (app.paymentStatus === 'Disputed') return res.status(409).json({ message: 'Payment is on hold while the dispute is reviewed.' });
  app.paymentStatus = 'Authorized'; app.paymentAuthorizedAt ||= new Date(); await app.save();
  await createNotification({ userId: app.applicant, audience: 'worker', type: 'payment', title: 'Payment authorized', message: 'Your payment is secured and will remain held until work approval.', entityType: 'application', entityId: app._id, actor: id(req), push: true });
  return res.json({ application: app });
}

export async function submitWork(req, res) {
  const app = await JobApplication.findOne({ _id: req.params.applicationId, applicant: id(req), status: 'Hired' }).populate('job');
  if (!app) return res.status(404).json({ message: 'Hired application not found.' });
  if (!['In Progress', 'Changes Requested'].includes(app.workStatus)) return res.status(409).json({ message: 'This work cannot be submitted now.' });
  app.workStatus = 'Submitted'; app.workSubmittedAt = new Date();
  app.paymentReminderClaimedAt = null; app.paymentReminderSentAt = null;
  await app.save();
  await createNotification({ userId: app.job.jobPoster, audience: 'employer', type: 'application', title: 'Work submitted', message: `Finished work was submitted for ${app.job.title}.`, entityType: 'application', entityId: app._id, actor: id(req), push: true });
  return res.json({ application: app });
}

export async function requestChanges(req, res) {
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ message: 'A reason is required.' });
  const app = await JobApplication.findOne({ _id: req.params.applicationId, status: 'Hired' }).populate('job');
  if (!app) return res.status(404).json({ message: 'Hired application not found.' });
  if (String(app.job.jobPoster) !== id(req) || app.workStatus !== 'Submitted') return res.status(409).json({ message: 'Changes cannot be requested for this assignment.' });
  if (app.paymentStatus === 'Disputed') return res.status(409).json({ message: 'Changes cannot be requested while payment is under dispute review.' });
  app.workStatus = 'Changes Requested'; app.changesRequestedAt = new Date(); app.timeline.push({ type: 'changes_requested', note: reason, actor: id(req), createdAt: new Date() }); await app.save();
  const message = await Message.create({ sender: id(req), receiver: app.applicant, job: app.job._id, content: `Changes requested: ${reason}`, clientMessageId: `changes:${app._id}:${app.changesRequestedAt.getTime()}` });
  const hydrated = await Message.findById(message._id).populate('sender', 'firstName lastName').populate('receiver', 'firstName lastName').populate('job', 'title');
  emitToUser(String(app.applicant), 'new_message', hydrated || message); emitToUser(id(req), 'new_message_echo', hydrated || message);
  await createNotification({ userId: app.applicant, audience: 'worker', type: 'application', title: 'Changes requested', message: reason, entityType: 'application', entityId: app._id, actor: id(req), push: true });
  return res.json({ application: app });
}

export async function settleDirect(req, res) {
  try { const result = await settleApplicationPayment({ applicationId: req.params.applicationId, employerId: id(req) }); return res.json({ message: result.deduplicated ? 'Payment was already completed.' : 'Worker paid successfully.', application: result.application, job: result.job }); }
  catch (error) { return res.status(error.status || 500).json({ message: error.message || 'Payment failed.' }); }
}
