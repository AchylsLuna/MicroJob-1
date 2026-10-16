import mongoose from 'mongoose';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { getDisputeMoneySnapshot } from './financialDisputeMoney.js';
import { queueNotification } from './notificationOutbox.js';
import { activeDispute } from './jobLifecycle.js';
import { refundJobFunds, remainingJobFunds, jobSpendingSources } from './jobFunds.js';

export async function settleApplicationPayment({ applicationId, employerId, session: providedSession }) {
  const session = providedSession || await mongoose.startSession();
  try {
    let result;
    const settle = async () => {
      const application = await JobApplication.findOne({ _id: applicationId, status: { $in: ['Hired', 'Accepted'] } }).session(session);
      if (!application) throw Object.assign(new Error('Hired application not found.'), { status: 404 });
      const job = await Job.findOne({ _id: application.job, jobPoster: employerId }).session(session);
      if (!job) throw Object.assign(new Error('You cannot pay this application.'), { status: 403 });
      if (application.paymentStatus === 'Paid') {
        result = { application, job, deduplicated: true };
        return;
      }
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
      const unpaid = await JobApplication.countDocuments({ job: job._id, status: 'Hired', $or: [{ paymentStatus: { $ne: 'Paid' } }, { workStatus: { $ne: 'Completed' } }] }).session(session);
      if (unpaid === 0 && (job.closedManually || Number(job.hiredCount || 0) >= Number(job.positionsNeeded || 1))) { job.status = 'Completed'; await job.save({ session }); const remaining = (await remainingJobFunds(job._id, session)).remaining; await refundJobFunds({ job, amount: remaining, reference: `completion-refund:${job._id}`, actor: employerId, session }); }
      await queueNotification(`job-paid:${application._id}`, { userId: String(application.applicant), audience: 'worker', type: 'payment', title: 'Job payment completed', message: `PHP ${amount.toFixed(2)} was added to your worker balance.`, entityType: 'application', entityId: String(application._id) }, session);
      result = { application, job, transaction, deduplicated: false };
    };
    if (providedSession) await settle(); else await session.withTransaction(settle);
    return result;
  } finally { if (!providedSession) await session.endSession(); }
}
