import mongoose from 'mongoose';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import Cancellation from '../models/Cancellation.js';
import PayoutRequest from '../models/PayoutRequest.js';
import NotificationOutbox from '../models/NotificationOutbox.js';
import { activeDispute, escalateCancellation } from './jobLifecycle.js';
import { queueNotification, deliverOutbox } from './notificationOutbox.js';
import { dispatchWithdrawal, reconcileWithdrawal, automaticWithdrawalsEnabled } from './withdrawals.js';
import { HOUR } from '../lib/lifecyclePolicy.js';
import { escalateOverdueDisputes } from './disputeEscalation.js';
import { queueWorkerNonpaymentAlerts } from './workerNonpaymentAlerts.js';
import { maintainJobOffers } from './offerLifecycle.js';

export async function runMaintenance() {
  let reminders = 0; let escalations = 0; let transferErrors = 0;
  const deadline = Date.now() + 40000;
  const offers = await maintainJobOffers({ deadline });
  const applications = await JobApplication.find({ status: { $in: ['Hired', 'Accepted'] }, workStatus: 'Submitted', paymentStatus: { $in: ['Secured', 'Authorized', 'Failed'] }, cancellationPending: { $ne: true }, disputePending: { $ne: true }, reminderStages: { $ne: 48 }, $or: [
    { nextPaymentReminderAt: { $ne: null, $lte: new Date() } },
    { nextPaymentReminderAt: null, reminderStages: { $ne: 24 }, $or: [{ firstSubmittedAt: { $lte: new Date(Date.now() - 24 * HOUR), $ne: null } }, { firstSubmittedAt: null, workSubmittedAt: { $lte: new Date(Date.now() - 24 * HOUR), $ne: null } }] },
  ] }).sort({ nextPaymentReminderAt: 1, firstSubmittedAt: 1 }).limit(100);
  for (const item of applications) {
    if (Date.now() > deadline) break;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const app = await JobApplication.findById(item._id).session(session); const job = await Job.findById(app.job).session(session);
        if (app.workStatus !== 'Submitted' || app.cancellationPending || app.paymentStatus === 'Paid' || job.cancellationPending || await activeDispute(app._id, session)) return;
        const elapsed = Date.now() - new Date(app.firstSubmittedAt || app.workSubmittedAt).getTime();
        for (const hours of [24, 48]) if (elapsed >= hours * HOUR && !app.reminderStages.includes(hours)) {
          app.reminderStages.push(hours);
          await queueNotification(`payment-reminder:${app._id}:${hours}`, { userId: String(job.jobPoster), audience: 'employer', type: 'payment', title: 'Submitted work awaits payment', message: `Work for ${job.title} remains unpaid. Review it and confirm payment, request changes, or open a dispute. Nonpayment disputes become available after 72 hours.`, entityType: 'application', entityId: String(app._id) }, session);
          reminders += 1;
        }
        app.nextPaymentReminderAt = app.reminderStages.includes(48) ? null : new Date(new Date(app.firstSubmittedAt || app.workSubmittedAt).getTime() + 48 * HOUR);
        await app.save({ session });
      });
    } finally { await session.endSession(); }
  }
  const workerNonpaymentAlerts = Date.now() < deadline ? await queueWorkerNonpaymentAlerts({ deadline }) : 0;
  const expired = await Cancellation.find({ scope: 'assignment', status: 'pending', responseDueAt: { $lte: new Date() } }).limit(50);
  for (const item of expired) {
    if (Date.now() > deadline) break;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const cancellation = await Cancellation.findOne({ _id: item._id, status: 'pending' }).session(session); if (!cancellation) return;
        const application = await JobApplication.findById(cancellation.application).session(session); const job = await Job.findById(cancellation.job).session(session);
        job.fundsVersion = Number(job.fundsVersion || 0) + 1; await job.save({ session });
        await escalateCancellation(cancellation, application, job, session); escalations += 1;
      });
    } finally { await session.endSession(); }
  }
  if (automaticWithdrawalsEnabled()) {
    const pending = await PayoutRequest.find({ processingMode: 'automatic', status: 'processing' }).sort({ lastReconciledAt: 1, createdAt: 1 }).limit(10);
    for (const payout of pending) {
      if (Date.now() > deadline) break;
      try { if (!payout.dispatchStartedAt) await dispatchWithdrawal(payout._id); else await reconcileWithdrawal(payout._id); }
      catch { transferErrors += 1; }
    }
  }
  const disputeEscalations = Date.now() < deadline ? await escalateOverdueDisputes({ deadline }) : 0;
  const delivered = Date.now() < deadline ? await deliverOutbox(20, deadline) : 0;
  return { reminders, workerNonpaymentAlerts, offers, escalations, disputeEscalations, delivered, transferErrors, notificationBacklog: await NotificationOutbox.countDocuments({ status: { $ne: 'delivered' } }), failedDeliveries: await NotificationOutbox.countDocuments({ lastError: { $exists: true } }), uncertainTransfers: await PayoutRequest.countDocuments({ processingMode: 'automatic', status: 'processing', failureReason: { $exists: true } }) };
}
