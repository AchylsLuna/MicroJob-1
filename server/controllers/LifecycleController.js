import { disputeLink } from '../lib/jobNotificationLinks.js';
import mongoose from 'mongoose';
import { resolvePublicId } from '../lib/publicId.js';
import { shapeFinancialDispute } from './FinancialDisputeController.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import JobApplication from '../models/JobApplication.js';
import Cancellation from '../models/Cancellation.js';
import FinancialDispute from '../models/FinancialDispute.js';
import { canFileNonpayment, EVIDENCE_WINDOW_MS, httpError, requireReason } from '../lib/lifecyclePolicy.js';
import { activeDispute, requestCancellation, respondCancellation } from '../services/jobLifecycle.js';
import { remainingJobFunds } from '../services/jobFunds.js';
import { queueNotification, deliverQueuedNotification } from '../services/notificationOutbox.js';

const actor = (req) => String(req.user?.id || req.user?.userId || '');
const handle = (fn) => async (req, res) => { try { return await fn(req, res); } catch (error) { return res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to complete this action.' }); } };

async function participant(applicationId, userId, session) {
  const application = await JobApplication.findById(applicationId).session(session || null);
  const job = application ? await Job.findById(application.job).session(session || null) : null;
  if (!job || !application) throw httpError(404, 'Assignment not found.');
  if (![String(job.jobPoster), String(application.applicant)].includes(userId)) throw httpError(403, 'You cannot access this assignment.');
  return { application, job };
}

export const cancelAssignment = handle(async (req, res) => res.json({ cancellation: await requestCancellation({ ...req.body, applicationId: req.params.applicationId, actor: actor(req) }) }));
export const cancelPosting = handle(async (req, res) => res.json({ cancellation: await requestCancellation({ ...req.body, applicationId: null, jobId: resolvePublicId(req.params.id), actor: actor(req) }) }));
export const respondToCancellation = handle(async (req, res) => res.json({ cancellation: await respondCancellation({ cancellationId: req.params.id, actor: actor(req), action: req.body?.action }) }));

export const getAssignmentLifecycle = handle(async (req, res) => {
  const { application, job } = await participant(req.params.applicationId, actor(req));
  const [cancellations, disputes, worker] = await Promise.all([
    Cancellation.find({ application: application._id }).sort({ createdAt: -1 }),
    FinancialDispute.find({ application: application._id }).sort({ raisedAt: -1 }),
    User.findById(application.applicant).select('firstName lastName'),
  ]);
  return res.json({ application, recipient: { id: String(application.applicant), name: `${worker?.firstName || ''} ${worker?.lastName || ''}`.trim() || String(application.applicant) }, job: { _id: job._id, title: job.title, description: job.description, requirements: job.requirements, salary: job.salary, paymentMode: job.paymentMode, workDates: job.workDates, workStartTime: job.workStartTime, workEndTime: job.workEndTime, jobPoster: job.jobPoster }, cancellations, disputes: disputes.map((item) => shapeFinancialDispute(item)), canRespondCancellation: cancellations.some((item) => item.scope === 'assignment' && item.status === 'pending' && String(item.actor) !== actor(req)), canFileNonpayment: canFileNonpayment(application), funds: await remainingJobFunds(job._id) });
});

export const startWork = handle(async (req, res) => {
  const session = await mongoose.startSession(); let application;
  try {
    await session.withTransaction(async () => {
      const found = await participant(req.params.applicationId, actor(req), session);
      application = found.application; const { job } = found;
      if (String(application.applicant) !== actor(req)) throw httpError(403, 'Only the hired worker can start work.');
      if (application.status !== 'Hired' || application.workStatus !== 'Not started' || application.cancellationPending || job.cancellationPending || ['Completed', 'Cancelled'].includes(job.status) || await activeDispute(application._id, session)) throw httpError(409, 'This assignment cannot start now.');
      job.fundsVersion = Number(job.fundsVersion || 0) + 1; await job.save({ session });
      application.startedAt = new Date(); application.workStatus = 'In Progress';
      application.timeline.push({ type: 'work_started', actor: actor(req), note: 'Worker started work.' }); await application.save({ session });
      await queueNotification(`work-started:${application._id}`, { userId: String(job.jobPoster), audience: 'employer', type: 'application', title: 'Work in progress', message: `The worker has started work on ${job.title}. Work is now in progress.`, entityType: 'application', entityId: String(application._id), actor: actor(req), metadata: { jobId: String(job._id), workStatus: 'In Progress' } }, session);
    });
    await deliverQueuedNotification(`work-started:${application._id}`);
    return res.json({ application });
  } finally { await session.endSession(); }
});

export const openDispute = handle(async (req, res) => {
  const reason = requireReason(req.body?.reason);
  const kind = req.body?.kind === 'nonpayment' ? 'nonpayment' : 'other';
  const session = await mongoose.startSession(); let dispute;
  try {
    await session.withTransaction(async () => {
      const { application, job } = await participant(req.params.applicationId, actor(req), session);
      if (!['Hired', 'Accepted', 'Cancelled'].includes(application.status)) throw httpError(409, 'Only an assignment can have a financial dispute.');
      if (application.paymentStatus === 'Processing') throw httpError(409, 'Wait for the current payment result before opening a dispute.');
      const unpaid = !['Paid', 'Refunded', 'Partially paid'].includes(application.paymentStatus) && application.status !== 'Cancelled';
      const contestedAmount = unpaid ? Math.max(0, Number(application.agreedAmount || job.salary) - Number(application.paidAmount || 0)) : 0;
      if (kind === 'nonpayment' && !canFileNonpayment(application)) throw httpError(409, 'A nonpayment dispute becomes available 72 hours after the first submission.');
      if (await activeDispute(application._id, session)) throw httpError(409, 'An open dispute already exists.');
      job.fundsVersion = Number(job.fundsVersion || 0) + 1; await job.save({ session });
      [dispute] = await FinancialDispute.create([{ job: job._id, application: application._id, employer: job.jobPoster, worker: application.applicant, raisedBy: actor(req), amount: contestedAmount, agreedJobAmount: Number(application.agreedAmount || job.salary), disputedAmount: contestedAmount, fundsHeldAmount: Math.min(contestedAmount, Math.max(0, (await remainingJobFunds(job._id, session)).remaining)), workerClaim: reason, kind, subject: job.title, reason, evidenceDueAt: new Date(Date.now() + EVIDENCE_WINDOW_MS), events: [{ type: 'opened', actor: actor(req), note: reason }] }], { session });
      // Writing the assignment prevents a concurrent settlement from bypassing this hold.
      application.disputePending = contestedAmount > 0;
      application.timeline.push({ type: 'dispute_opened', actor: actor(req), note: reason }); await application.save({ session });
      for (const [user, audience] of [[job.jobPoster, 'employer'], [application.applicant, 'worker']]) await queueNotification(`dispute:${dispute._id}:${user}`, { userId: String(user), audience, type: 'payment', title: 'Financial dispute opened', message: `${job.title}: ${contestedAmount > 0 ? 'Affected unpaid funds are held. ' : 'Completed payments remain recorded. '}You have seven days to provide evidence or state that none is available.`, entityType: 'financial_dispute', entityId: String(dispute._id), link: disputeLink(audience, dispute._id), actor: actor(req), metadata: { jobId: String(job._id), applicationId: String(application._id) }, pushData: { jobId: String(job._id) } }, session);
    });
    await Promise.all([dispute.employer, dispute.worker].map((user) => deliverQueuedNotification(`dispute:${dispute._id}:${user}`)));
    return res.status(201).json({ dispute });
  } finally { await session.endSession(); }
});

export const addEvidence = handle(async (req, res) => {
  const dispute = await FinancialDispute.findById(req.params.id);
  if (!dispute) throw httpError(404, 'Dispute not found.');
  if (![String(dispute.employer), String(dispute.worker)].includes(actor(req))) throw httpError(403, 'You cannot access this dispute.');
  const statement = String(req.body?.statement || '').trim();
  if ((!statement && req.body?.noEvidence !== true) || statement.length > 4000) throw httpError(400, 'Provide a statement of up to 4000 characters or state that no evidence is available.');
  const updated = await FinancialDispute.findOneAndUpdate({ _id: dispute._id, status: { $in: ['open', 'investigating'] }, evidenceDueAt: { $gt: new Date() } }, { $push: { evidence: { actor: actor(req), statement, noEvidence: req.body?.noEvidence === true, at: new Date() }, events: { actor: actor(req), type: 'evidence_added', at: new Date() } } }, { returnDocument: 'after' });
  if (!updated) throw httpError(409, 'The evidence period has ended or the case is closed.');
  return res.json({ dispute: updated });
});
