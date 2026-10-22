import mongoose from 'mongoose';
import JobApplication from '../models/JobApplication.js';
import Job from '../models/Job.js';
import { canFileNonpayment, HOUR } from '../lib/lifecyclePolicy.js';
import { activeDispute } from './jobLifecycle.js';
import { queueNotification } from './notificationOutbox.js';

export async function queueWorkerNonpaymentAlerts({ now = new Date(), limit = 100, deadline = Date.now() + 40000 } = {}) {
  const cutoff = new Date(now.getTime() - 72 * HOUR);
  const candidates = await JobApplication.find({
    status: { $in: ['Hired', 'Accepted'] }, cancellationPending: { $ne: true }, disputePending: { $ne: true },
    paymentStatus: { $nin: ['Paid', 'Processing', 'Refunded', 'Disputed'] },
    $or: [
      { 'dailyPayments.0': { $exists: false }, paymentStatus: { $ne: 'Partially paid' }, nonpaymentAlertedAt: null, $expr: { $lte: [{ $ifNull: ['$firstSubmittedAt', '$workSubmittedAt'] }, cutoff] }, $or: [{ firstSubmittedAt: { $ne: null } }, { workSubmittedAt: { $ne: null } }] },
      { dailyPayments: { $elemMatch: { submittedAt: { $ne: null, $lte: cutoff }, paidAt: null, nonpaymentAlertedAt: null } } },
    ],
  }).sort({ createdAt: 1 }).limit(limit).select('_id');
  let queued = 0;
  for (const candidate of candidates) {
    if (Date.now() >= deadline) break;
    const session = await mongoose.startSession();
    try {
      let added = 0;
      await session.withTransaction(async () => {
        added = 0;
        const application = await JobApplication.findById(candidate._id).session(session);
        const job = application && await Job.findById(application.job).session(session);
        if (!job || !['Hired', 'Accepted'].includes(application.status) || application.cancellationPending || application.disputePending
          || job.cancellationPending || ['Cancelled', 'Completed', 'Full refund', 'Resolved'].includes(job.status)
          || !canFileNonpayment(application, now.getTime()) || await activeDispute(application._id, session)) return;
        const days = application.dailyPayments?.length
          ? application.dailyPayments.filter((day) => day.submittedAt && day.submittedAt <= cutoff && !day.paidAt && !day.nonpaymentAlertedAt)
          : application.nonpaymentAlertedAt ? [] : [null];
        for (const day of days) {
          const workDate = day?.workDate;
          await queueNotification(`nonpayment-eligible:${application._id}:${workDate || 'assignment'}`, {
            userId: String(application.applicant), audience: 'worker', type: 'application',
            title: 'Unpaid work — review your assignment',
            message: `Your submitted work for ${job.title}${workDate ? ` (${workDate})` : ''} has remained unpaid for at least 72 hours. Open your assignment to review the payment status and raise a nonpayment dispute if it is still eligible.`,
            entityType: 'application', entityId: String(application._id),
            link: `/worker/applied-jobs?applicationId=${application._id}`,
            metadata: { action: 'open_assignment', ...(workDate ? { workDate } : {}) },
            pushData: { applicationId: String(application._id), jobId: String(job._id) },
          }, session);
          if (day) day.nonpaymentAlertedAt = now; else application.nonpaymentAlertedAt = now;
          added += 1;
        }
        if (added) await application.save({ session });
      });
      queued += added;
    } finally { await session.endSession(); }
  }
  return queued;
}
