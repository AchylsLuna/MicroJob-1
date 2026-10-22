import { assignmentLink } from '../lib/jobNotificationLinks.js';
import mongoose from 'mongoose';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import JobOffer from '../models/JobOffer.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Cancellation from '../models/Cancellation.js';
import FinancialDispute from '../models/FinancialDispute.js';
import { CANCELLATION_RESPONSE_MS, EVIDENCE_WINDOW_MS, POLICY_VERSION, httpError, money, requireReason } from '../lib/lifecyclePolicy.js';
import { remainingJobFunds, refundJobFunds, jobSpendingSources } from './jobFunds.js';
import { queueNotification, deliverQueuedNotification } from './notificationOutbox.js';
import { resolveJobAvailability } from '../lib/hiringState.js';
import { baseWorkerPay } from '../lib/dailyWorkPolicy.js';

export const activeDispute = (application, session) => FinancialDispute.exists({ application, status: { $in: ['open', 'investigating'] } }).session(session || null);
const notice = (key, userId, audience, title, message, entityId, session, jobId) => queueNotification(key, { userId: String(userId), audience, type: 'application', title, message, entityType: 'application', entityId: String(entityId), link: assignmentLink(audience, entityId, jobId) }, session);

export async function syncCapacity(job, session) {
  job.hiredCount = await JobApplication.countDocuments({ job: job._id, status: { $in: ['Hired', 'Accepted'] } }).session(session);
  job.reservedOfferCount = await JobOffer.countDocuments({ job: job._id, status: { $in: ['pending', 'accepted'] } }).session(session);
  if (!job.cancellationPending) job.status = resolveJobAvailability(job);
  await job.save({ session });
}

export async function escalateCancellation(cancellation, application, job, session) {
  application.disputePending = true; await application.save({ session });
  cancellation.status = 'staff_review';
  cancellation.events.push({ type: 'staff_review', note: 'Agreement was not reached. Funds remain held.' });
  await cancellation.save({ session });
  if (!await activeDispute(application._id, session)) {
    const unpaid = money(Math.max(0, Number(application.agreedAmount || job.salary) - Number(application.paidAmount || 0)));
    await FinancialDispute.create([{ job: job._id, application: application._id, employer: job.jobPoster, worker: application.applicant, raisedBy: cancellation.actor, kind: 'cancellation', subject: `Cancellation: ${job.title}`, reason: cancellation.reason, amount: unpaid, agreedJobAmount: Number(application.agreedAmount || job.salary), alreadyPaidAmount: Number(application.paidAmount || 0), disputedAmount: unpaid, fundsHeldAmount: Math.min(unpaid, Math.max(0, (await remainingJobFunds(job._id, session)).remaining)), workerClaim: cancellation.reason, evidenceDueAt: new Date(Date.now() + EVIDENCE_WINDOW_MS), events: [{ type: 'opened', note: 'Cancellation requires Finance review.' }] }], { session });
  }
  for (const [user, audience] of [[job.jobPoster, 'employer'], [application.applicant, 'worker']]) {
    await notice(`cancellation-review:${cancellation._id}:${user}`, user, audience, 'Cancellation under review', 'Finance Staff will review the cancellation. Submit evidence within seven days; affected funds remain held.', application._id, session, job._id);
  }
}

export async function finishPostingCancellation(job, session) {
  if (!job.cancellationPending) return;
  if (await JobApplication.exists({ job: job._id, status: { $in: ['Hired', 'Accepted'] }, workStatus: { $nin: ['Completed', 'Cancelled'] } }).session(session)) return;
  const remaining = (await remainingJobFunds(job._id, session)).remaining;
  await refundJobFunds({ job, amount: remaining, reference: `job-cancellation-refund:${job._id}`, actor: job.jobPoster, session });
  job.status = 'Cancelled'; job.cancellationPending = false; job.cancelledAt = new Date();
  await job.save({ session });
  await Cancellation.updateMany({ job: job._id, scope: 'job', status: 'pending' }, { $set: { status: 'resolved', resolvedAt: new Date() }, $push: { events: { type: 'resolved', at: new Date(), note: 'All assignments resolved.' } } }, { session });
}

export async function resolveCancelledAssignment({ application, job, cancellation, workerPayment, actor, session, retainBaseFunding = true }) {
  const amount = money(workerPayment);
  const agreed = money(application.agreedAmount || job.salary);
  const alreadyPaid = money(application.paidAmount || 0);
  const unpaid = money(agreed - alreadyPaid);
  if (!Number.isFinite(amount) || amount < 0 || amount > unpaid) throw httpError(400, 'Worker payment must be between zero and the unpaid agreed amount.');
  if (['Paid', 'Processing'].includes(application.paymentStatus)) throw httpError(409, 'Payment is already completed or processing.');
  if (amount > 0) {
    if ((await remainingJobFunds(job._id, session)).remaining < amount) throw httpError(409, 'Insufficient secured funds.');
    const fundingSources = await jobSpendingSources(job, amount, session);
    const result = await User.updateOne({ _id: application.applicant }, { $inc: { workerBalance: amount } }, { session });
    if (!result.matchedCount) throw httpError(409, 'Worker account is unavailable.');
    await Transaction.create([{ receiver: application.applicant, amount, type: 'PAYOUT', status: 'COMPLETED', balanceTarget: 'WORKER', meta: { fundingSources }, jobReference: job._id, reference: `cancellation-payment:${application._id}`, label: 'Job payment on cancellation', relatedEntityType: 'job_application', relatedEntityId: String(application._id), actor }], { session });
  }
  // Before start, keep the base slot funded for a replacement. After start,
  // close recruitment so partially consumed slot funding cannot be promised again.
  const retainBase = retainBaseFunding && !application.startedAt && application.workStatus === 'Not started' && !job.cancellationPending;
  const refund = money(Math.max(0, unpaid - amount - (retainBase ? baseWorkerPay(job) : 0)));
  await refundJobFunds({ job, amount: refund, reference: `assignment-cancellation-refund:${application._id}`, actor, application: application._id, session });
  if (!retainBase && !job.cancellationPending) { job.closedManually = true; job.status = 'Closed'; }
  application.status = 'Cancelled'; application.workStatus = 'Cancelled'; application.cancellationPending = false; application.disputePending = false;
  application.paidAmount = money(alreadyPaid + amount);
  application.paymentStatus = application.paidAmount === agreed ? 'Paid' : application.paidAmount > 0 ? 'Partially paid' : 'Refunded';
  if (amount > 0) application.paidAt = new Date();
  application.completedAt = new Date();
  application.timeline.push({ type: 'cancelled', status: 'Cancelled', note: cancellation.reason, actor, meta: { cancellationId: String(cancellation._id), workerPayment: amount, refunded: refund } });
  await application.save({ session });
  cancellation.status = 'resolved'; cancellation.workerPayment = amount; cancellation.resolvedAt = new Date();
  cancellation.events.push({ type: 'resolved', actor, amount, note: 'Assignment cancelled and funds settled.' });
  await cancellation.save({ session });
  await JobOffer.updateMany({ application: application._id, status: 'hired' }, { $set: { status: 'cancelled', cancellationReason: cancellation.reason, resolvedAt: new Date() } }, { session });
  await syncCapacity(job, session);
  await finishPostingCancellation(job, session);
  for (const [user, audience] of [[job.jobPoster, 'employer'], [application.applicant, 'worker']]) {
    await notice(`assignment-cancelled:${cancellation._id}:${user}`, user, audience, 'Assignment cancelled', `${job.title}: ${cancellation.reason}. Worker payment: PHP ${amount.toFixed(2)}.`, application._id, session, job._id);
  }
}

async function requestAssignment(application, job, actor, reason, workerPayment, session) {
  if (application.cancellationPending || await activeDispute(application._id, session)) throw httpError(409, 'An existing cancellation or financial dispute must be resolved first.');
  if (!['Hired', 'Accepted'].includes(application.status) || ['Paid', 'Processing'].includes(application.paymentStatus) || application.workStatus === 'Completed') throw httpError(409, 'This assignment cannot be cancelled.');
  const beforeStart = application.workStatus === 'Not started' && !application.startedAt;
  const amount = beforeStart ? 0 : money(workerPayment);
  if (!Number.isFinite(amount) || amount < 0 || amount > money(Number(application.agreedAmount || job.salary) - Number(application.paidAmount || 0))) throw httpError(400, 'Enter the proposed worker payment from zero to the unpaid agreed amount.');
  const [cancellation] = await Cancellation.create([{ job: job._id, application: application._id, scope: 'assignment', actor, reason, workerPayment: amount, responseDueAt: new Date(Date.now() + CANCELLATION_RESPONSE_MS), policyVersion: POLICY_VERSION, events: [{ type: 'requested', actor, note: reason, amount }] }], { session });
  application.cancellation = cancellation._id; application.cancellationPending = true;
  await application.save({ session });
  if (beforeStart) await resolveCancelledAssignment({ application, job, cancellation, workerPayment: 0, actor, session });
  {
    const recipient = String(actor) === String(job.jobPoster) ? application.applicant : job.jobPoster;
    await queueNotification(`cancellation-request:${cancellation._id}`, { userId: String(recipient), audience: String(recipient) === String(job.jobPoster) ? 'employer' : 'worker', type: 'application', title: 'Job cancellation request', message: beforeStart ? `${job.title}: ${reason}. The assignment was cancelled before work started; no response is needed.` : `${job.title}: ${reason}. Proposed worker payment: PHP ${amount.toFixed(2)}. Respond within 72 hours.`, entityType: 'application', entityId: String(application._id), link: assignmentLink(String(recipient) === String(job.jobPoster) ? 'employer' : 'worker', application._id, job._id), actor, metadata: { jobId: String(job._id), cancellationId: String(cancellation._id) }, pushData: { jobId: String(job._id), applicationId: String(application._id) } }, session);
  }
  return cancellation;
}

export async function requestCancellation({ jobId, applicationId, actor, reason: rawReason, workerPayment, policyAcknowledged }) {
  const reason = requireReason(rawReason);
  if (policyAcknowledged !== true) throw httpError(400, 'Acknowledge the cancellation terms before continuing.');
  const session = await mongoose.startSession(); let result;
  try {
    await session.withTransaction(async () => {
      const application = applicationId ? await JobApplication.findById(applicationId).session(session) : null;
      const job = await Job.findById(application?.job || jobId).session(session);
      if (!job || (applicationId && !application)) throw httpError(404, 'Job or assignment not found.');
      if (String(job.jobPoster) !== String(actor) && String(application?.applicant) !== String(actor)) throw httpError(403, 'Only this employer or assigned worker can cancel.');
      // Every money/assignment operation writes the job, serializing competing settlements.
      job.fundsVersion = Number(job.fundsVersion || 0) + 1;
      await job.save({ session });
      if (application) { result = await requestAssignment(application, job, actor, reason, workerPayment, session); return; }
      if (['Cancelled', 'Completed'].includes(job.status) || job.cancellationPending) throw httpError(409, 'This posting is already completed or being cancelled.');
      const hired = await JobApplication.find({ job: job._id, status: { $in: ['Hired', 'Accepted'] }, workStatus: { $ne: 'Completed' } }).session(session);
      if (await FinancialDispute.exists({ job: job._id, status: { $in: ['open', 'investigating'] } }).session(session) || hired.some((item) => item.cancellationPending)) throw httpError(409, 'Resolve existing cases before cancelling this posting.');
      job.cancellationPending = true; job.closedManually = true; job.status = 'Closed'; job.cancellationReason = reason;
      await job.save({ session });
      [result] = await Cancellation.create([{ job: job._id, scope: 'job', actor, reason, policyVersion: POLICY_VERSION, events: [{ type: 'requested', actor, note: reason }] }], { session });
      const offers = await JobOffer.find({ job: job._id, status: { $in: ['pending', 'accepted'] } }).session(session);
      for (const offer of offers) {
        await refundJobFunds({ job, amount: Number(offer.additionalEscrow || 0), reference: `offer-extra-refund:${offer._id}`, preferredWallet: 'EMPLOYER', actor, session });
        offer.status = 'cancelled'; offer.cancellationReason = reason; offer.resolvedAt = new Date(); await offer.save({ session });
      }
      for (const item of hired) await requestAssignment(item, job, actor, reason, workerPayment ?? 0, session);
      const affected = await JobApplication.find({ job: job._id, status: { $nin: ['Hired', 'Accepted', 'Cancelled', 'Withdrawn', 'Rejected'] } }).session(session);
      for (const item of affected) {
        item.status = 'Cancelled'; item.timeline.push({ type: 'job_cancelled', actor, note: reason }); await item.save({ session });
        await notice(`job-cancelled:${result._id}:${item.applicant}`, item.applicant, 'worker', 'Job posting cancelled', `${job.title}: ${reason}`, item._id, session, job._id);
      }
      await syncCapacity(job, session); await finishPostingCancellation(job, session);
    });
    await deliverQueuedNotification(`cancellation-request:${result._id}`);
    return result;
  } finally { await session.endSession(); }
}

export async function respondCancellation({ cancellationId, actor, action }) {
  if (!['accept', 'reject'].includes(action)) throw httpError(400, 'Choose accept or reject.');
  const session = await mongoose.startSession(); let result;
  try {
    await session.withTransaction(async () => {
      result = await Cancellation.findOne({ _id: cancellationId, status: 'pending', scope: 'assignment' }).session(session);
      if (!result) throw httpError(409, 'Pending cancellation not found.');
      const application = await JobApplication.findById(result.application).session(session);
      const job = await Job.findById(result.job).session(session);
      if (![String(job.jobPoster), String(application.applicant)].includes(String(actor)) || String(result.actor) === String(actor)) throw httpError(403, 'Only the other party can respond.');
      job.fundsVersion = Number(job.fundsVersion || 0) + 1; await job.save({ session });
      if (await activeDispute(application._id, session)) throw httpError(409, 'Finance is already reviewing this assignment.');
      result.events.push({ type: action, actor });
      if (action === 'reject' || new Date(result.responseDueAt).getTime() <= Date.now()) await escalateCancellation(result, application, job, session);
      else await resolveCancelledAssignment({ application, job, cancellation: result, workerPayment: result.workerPayment, actor, session });
    });
    return result;
  } finally { await session.endSession(); }
}
