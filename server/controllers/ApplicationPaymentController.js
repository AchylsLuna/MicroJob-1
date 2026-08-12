import JobApplication from '../models/JobApplication.js';
import { createNotification } from '../lib/notificationService.js';
import Message from '../models/Message.js';
import { emitToUser } from '../lib/socket.js';
import { settleApplicationPayment } from '../services/applicationSettlement.js';

const id = (req) => String(req.user?.id || req.user?.userId || '');

export async function authorizePayment(req, res) {
  const app = await JobApplication.findOne({ _id: req.params.applicationId, status: 'Hired' }).populate('job');
  if (!app) return res.status(404).json({ message: 'Hired application not found.' });
  if (String(app.job?.jobPoster) !== id(req)) return res.status(403).json({ message: 'You cannot authorize this payment.' });
  if (app.paymentStatus === 'Paid') return res.status(409).json({ message: 'This worker is already paid.' });
  app.paymentStatus = 'Authorized'; app.paymentAuthorizedAt ||= new Date(); await app.save();
  await createNotification({ userId: app.applicant, type: 'payment', title: 'Payment authorized', message: 'Your payment is secured and will remain held until work approval.', entityType: 'application', entityId: app._id, actor: id(req), push: true });
  return res.json({ application: app });
}

export async function submitWork(req, res) {
  const app = await JobApplication.findOne({ _id: req.params.applicationId, applicant: id(req), status: 'Hired' }).populate('job');
  if (!app) return res.status(404).json({ message: 'Hired application not found.' });
  if (!['In Progress', 'Changes Requested'].includes(app.workStatus)) return res.status(409).json({ message: 'This work cannot be submitted now.' });
  app.workStatus = 'Submitted'; app.workSubmittedAt = new Date(); await app.save();
  await createNotification({ userId: app.job.jobPoster, type: 'application', title: 'Work submitted', message: `Finished work was submitted for ${app.job.title}.`, entityType: 'application', entityId: app._id, actor: id(req), push: true });
  return res.json({ application: app });
}

export async function requestChanges(req, res) {
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ message: 'A reason is required.' });
  const app = await JobApplication.findOne({ _id: req.params.applicationId, status: 'Hired' }).populate('job');
  if (!app) return res.status(404).json({ message: 'Hired application not found.' });
  if (String(app.job.jobPoster) !== id(req) || app.workStatus !== 'Submitted') return res.status(409).json({ message: 'Changes cannot be requested for this assignment.' });
  app.workStatus = 'Changes Requested'; app.changesRequestedAt = new Date(); app.timeline.push({ type: 'changes_requested', note: reason, actor: id(req), createdAt: new Date() }); await app.save();
  const message = await Message.create({ sender: id(req), receiver: app.applicant, job: app.job._id, content: `Changes requested: ${reason}`, clientMessageId: `changes:${app._id}:${app.changesRequestedAt.getTime()}` });
  const hydrated = await Message.findById(message._id).populate('sender', 'firstName lastName').populate('receiver', 'firstName lastName').populate('job', 'title');
  emitToUser(String(app.applicant), 'new_message', hydrated || message); emitToUser(id(req), 'new_message_echo', hydrated || message);
  await createNotification({ userId: app.applicant, type: 'application', title: 'Changes requested', message: reason, entityType: 'application', entityId: app._id, actor: id(req), push: true });
  return res.json({ application: app });
}

export async function settleDirect(req, res) {
  try { const result = await settleApplicationPayment({ applicationId: req.params.applicationId, employerId: id(req) }); return res.json({ message: result.deduplicated ? 'Payment was already completed.' : 'Worker paid successfully.', application: result.application, job: result.job }); }
  catch (error) { return res.status(error.status || 500).json({ message: error.message || 'Payment failed.' }); }
}
