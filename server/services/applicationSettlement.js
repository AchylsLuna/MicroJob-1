import mongoose from 'mongoose';
import { isDailyJob } from '../lib/dailyWorkPolicy.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import JobOffer from '../models/JobOffer.js';
import { getDisputeMoneySnapshot } from './financialDisputeMoney.js';
import { queueNotification, deliverQueuedNotification, queueJobPaymentReceipts, deliverJobPaymentReceipts } from './notificationOutbox.js';
import { activeDispute } from './jobLifecycle.js';
import { refundJobFunds, remainingJobFunds, jobSpendingSources } from './jobFunds.js';

export async function finalizeSettledJob(job, employerId, session) {
  if (job.cancellationPending || ['Completed', 'Cancelled', 'Full refund', 'Resolved'].includes(job.status)) return false;
  const hires = await JobApplication.countDocuments({ job: job._id, status: { $in: ['Hired', 'Accepted'] } }).session(session);
  if (!hires || (!job.closedManually && hires < Number(job.positionsNeeded || 1))) return false;
  const unpaid = await JobApplication.exists({ job: job._id, status: { $in: ['Hired', 'Accepted'] }, $or: [{ paymentStatus: { $ne: 'Paid' } }, { workStatus: { $ne: 'Completed' } }] }).session(session);
  if (unpaid || await JobOffer.exists({ job: job._id, status: { $in: ['pending', 'accepted'] } }).session(session)) return false;
  job.status = 'Completed'; await job.save({ session });
  const remaining = (await remainingJobFunds(job._id, session)).remaining;
  await refundJobFunds({ job, amount: remaining, reference: `completion-refund:${job._id}`, actor: employerId, session });
  return true;
}

export async function settleApplicationPayment({ applicationId, employerId, expectedSubmittedAt, session: providedSession }) {
  const session = providedSession || await mongoose.startSession();
  try {
    let result;
    const settle = async () => {
      const application = await JobApplication.findOne({ _id: applicationId, status: { $in: ['Hired', 'Accepted'] } }).session(session);
      if (!application) throw Object.assign(new Error('Hired application not found.'), { status: 404 });
      const job = await Job.findOne({ _id: application.job, jobPoster: employerId }).session(session);
      if (!job) throw Object.assign(new Error('You cannot pay this application.'), { status: 403 });
      if (isDailyJob(job)) throw Object.assign(new Error('Use Confirm and Pay on the proof for a specific work date in chat.'), { status: 409 });
      if (application.paymentStatus === 'Paid') {
        result = { application, job, deduplicated: true };
        return;
      }
      if (expectedSubmittedAt !== undefined && (!application.workSubmittedAt || new Date(expectedSubmittedAt).getTime() !== application.workSubmittedAt.getTime())) throw Object.assign(new Error('New completion evidence is available. Review the latest submission before releasing funds.'), { status: 409 });
      if (application.paymentStatus === 'Disputed' || job.cancellationPending || ['Cancelled', 'Completed'].includes(job.status) || application.cancellationPending || await activeDispute(application._id, session)) throw Object.assign(new Error('Affected funds are held while this cancellation or dispute is unresolved.'), { status: 409 });
      job.fundsVersion = Number(job.fundsVersion || 0) + 1; await job.save({ session });
      if (application.workStatus !== 'Submitted') throw Object.assign(new Error('The worker must submit finished work before payment.'), { status: 409 });
      const reference = `application-payout:${application._id}`;
      const existing = await Transaction.findOne({ reference, status: 'COMPLETED' }).session(session);
      if (existing) {
        application.paymentStatus = 'Paid'; application.workStatus = 'Completed';
        application.paymentReminderClaimedAt = null; application.paymentReminderClaimedStage = null;
        application.paidAt ||= existing.createdAt; application.completedAt ||= existing.createdAt;
        await application.save({ session });
        result = { application, job, transaction: existing, deduplicated: true };
        return;
      }
      application.paymentStatus = 'Processing';
      await application.save({ session });
      const payment = await getDisputeMoneySnapshot({ application, job, session });
      const amount = payment.remainingAgreedAmount;
      if (amount <= 0) throw Object.assign(new Error('The completed payment ledger requires reconciliation; no additional funds were released.'), { status: 409 });
      const remaining = (await remainingJobFunds(job._id, session)).remaining;
      if (remaining < amount) throw Object.assign(new Error('The secured job funds are insufficient for this payment.'), { status: 409 });
      const fundingSources = await jobSpendingSources(job, amount, session);
      const credited = await User.updateOne({ _id: application.applicant }, { $inc: { workerBalance: amount } }, { session });
      if (!credited.matchedCount) throw Object.assign(new Error('Worker account unavailable.'), { status: 409 });
      const [transaction] = await Transaction.create([{ sender: null, receiver: application.applicant, amount, type: 'PAYOUT', status: 'COMPLETED', balanceTarget: 'WORKER', meta: { fundingSources }, jobReference: job._id, reference, label: `Job payment (${job.title})`, relatedEntityType: 'job_application', relatedEntityId: String(application._id), actor: employerId }], { session });
      application.paymentStatus = 'Paid'; application.workStatus = 'Completed'; application.paidAmount = payment.alreadyPaidAmount + amount; application.paymentReminderClaimedAt = null; application.paymentReminderClaimedStage = null; application.paidAt = new Date(); application.completedAt = new Date();
      await application.save({ session });
      await finalizeSettledJob(job, employerId, session);
      await queueNotification(`job-paid:${application._id}`, {
        userId: String(application.applicant), audience: 'worker', type: 'payment',
        title: `Job marked as done: ${job.title}`,
        message: `Your employer marked ${job.title} as done and paid PHP ${amount.toFixed(2)}. The amount was added to your worker balance.`,
        entityType: 'application', entityId: String(application._id), actor: employerId,
        metadata: { jobId: String(job._id), jobTitle: job.title, amount, workStatus: 'Completed', paymentStatus: 'Paid' },
      }, session);
      await queueNotification(`job-paid-employer:${application._id}`, { userId: String(employerId), audience: 'employer', type: 'payment', title: 'Payment sent', message: `PHP ${amount.toFixed(2)} was released to the worker for ${job.title}.`, entityType: 'application', entityId: String(application._id) }, session);
      await queueJobPaymentReceipts(transaction, employerId, application.applicant, session);
      result = { application, job, transaction, deduplicated: false };
    };
    if (providedSession) await settle(); else await session.withTransaction(settle);
    // A caller-owned transaction must deliver only after its own commit.
    if (!providedSession) await Promise.all([deliverQueuedNotification(`job-paid:${result.application._id}`), deliverJobPaymentReceipts(`application-payout:${result.application._id}`)]);
    return result;
  } finally { if (!providedSession) await session.endSession(); }
}
