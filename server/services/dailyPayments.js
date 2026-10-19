import mongoose from 'mongoose';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { activeDispute } from './jobLifecycle.js';
import { jobSpendingSources, remainingJobFunds } from './jobFunds.js';
import { queueNotification, deliverOutbox, deliverQueuedNotification, queueJobPaymentReceipts, deliverJobPaymentReceipts } from './notificationOutbox.js';
import { DAILY_REVIEW_INTERVAL_MS, isDailyJob } from '../lib/dailyWorkPolicy.js';
import { httpError, money } from '../lib/lifecyclePolicy.js';

export async function settleDailyPayment({ applicationId, employerId, workDate, expectedSubmittedAt }) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const application = await JobApplication.findOne({ _id: applicationId, status: { $in: ['Hired', 'Accepted'] } }).session(session);
      const job = application && await Job.findOne({ _id: application.job, jobPoster: employerId }).session(session);
      if (!job) throw httpError(403, 'You cannot pay this assignment.');
      if (!isDailyJob(job)) throw httpError(400, 'This assignment does not use daily payments.');
      const day = application.dailyPayments.find((item) => item.workDate === workDate);
      if (!day) throw httpError(400, 'Choose a scheduled work date.');
      if (day.paidAt) { result = { application, job, deduplicated: true }; return; }
      if (!day.submittedAt || !expectedSubmittedAt || new Date(expectedSubmittedAt).getTime() !== day.submittedAt.getTime()) throw httpError(409, 'Review the latest proof for this work date before releasing funds.');
      if (application.cancellationPending || application.disputePending || job.cancellationPending || ['Cancelled', 'Completed', 'Full refund', 'Resolved'].includes(job.status) || ['Disputed', 'Processing', 'Refunded', 'Paid'].includes(application.paymentStatus) || await activeDispute(application._id, session)) throw httpError(409, 'Daily payment is held or unavailable.');
      const dailyPaid = money(application.dailyPayments.reduce((total, item) => total + (item.paidAt ? item.amount : 0), 0));
      if (dailyPaid !== money(application.paidAmount || 0)) throw httpError(409, 'Payments outside the daily schedule require Finance reconciliation before another daily payment.');
      // Serializes payments, refunds, cancellation and dispute creation across workers.
      job.fundsVersion += 1;
      await job.save({ session });
      const reference = `daily-payout:${application._id}:${workDate}`;
      if (await Transaction.exists({ reference }).session(session)) throw httpError(409, 'Daily payment ledger requires reconciliation.');
      const amount = money(day.amount);
      if ((await remainingJobFunds(job._id, session)).remaining < amount) throw httpError(409, 'The secured funds are insufficient for this daily payment.');
      if (money(Number(application.paidAmount || 0) + amount) > application.agreedAmount) throw httpError(409, 'Daily payments cannot exceed the agreed total.');
      const fundingSources = await jobSpendingSources(job, amount, session);
      const credited = await User.updateOne({ _id: application.applicant }, { $inc: { workerBalance: amount } }, { session });
      if (!credited.matchedCount) throw httpError(409, 'Worker account unavailable.');
      const [transaction] = await Transaction.create([{ receiver: application.applicant, amount, type: 'PAYOUT', status: 'COMPLETED', balanceTarget: 'WORKER', jobReference: job._id, reference, relatedEntityType: 'job_application', relatedEntityId: String(application._id), actor: employerId, label: `Daily pay (${workDate}): ${job.title}`, meta: { fundingSources, workDate } }], { session });
      await queueJobPaymentReceipts(transaction, employerId, application.applicant, session);
      day.paidAt = new Date(); day.nextReminderAt = null;
      application.paidAmount = money(Number(application.paidAmount || 0) + amount);
      application.paymentStatus = application.dailyPayments.every((item) => item.paidAt) ? 'Paid' : 'Partially Paid';
      if (application.paymentStatus === 'Paid') application.paidAt = day.paidAt;
      application.timeline.push({ type: 'daily_payment', actor: employerId, note: `PHP ${amount.toFixed(2)} paid for ${workDate}.`, meta: { workDate, amount } });
      await application.save({ session });
      // Daily approval deliberately leaves assignment workStatus and posting status unchanged.
      for (const [userId, audience] of [[application.applicant, 'worker'], [employerId, 'employer']]) {
        await queueNotification(`${reference}:${audience}`, { userId: String(userId), audience, type: 'payment', title: 'Daily payment completed', message: `PHP ${amount.toFixed(2)} paid for ${job.title}, work date ${workDate}.`, entityType: 'application', entityId: String(application._id) }, session);
      }
      result = { application, job, deduplicated: false };
    });
    await Promise.all([deliverQueuedNotification(`daily-payout:${result.application._id}:${workDate}:worker`), deliverJobPaymentReceipts(`daily-payout:${result.application._id}:${workDate}`)]);
    return result;
  } finally { await session.endSession(); }
}

export async function checkPendingDailyPayments({ now = new Date(), limit = 0 } = {}) {
  const candidates = JobApplication.find({ status: { $in: ['Hired', 'Accepted'] }, cancellationPending: { $ne: true }, disputePending: { $ne: true }, paymentStatus: { $nin: ['Paid', 'Disputed', 'Processing', 'Refunded'] }, dailyPayments: { $elemMatch: { paidAt: null, submittedAt: { $ne: null }, nextReminderAt: { $ne: null, $lte: now } } } }).sort({ 'dailyPayments.nextReminderAt': 1 }).limit(limit).select('_id').batchSize(100).cursor();
  let reminders = 0; let checked = 0;
  for await (const item of candidates) {
    checked += 1;
    const session = await mongoose.startSession();
    try {
      const sent = await session.withTransaction(async () => {
        let count = 0;
        const application = await JobApplication.findById(item._id).session(session);
        const job = application && await Job.findById(application.job).session(session);
        if (!isDailyJob(job) || job.cancellationPending || ['Cancelled', 'Completed', 'Full refund', 'Resolved'].includes(job.status) || application.cancellationPending || application.disputePending || ['Paid', 'Disputed', 'Processing', 'Refunded'].includes(application.paymentStatus) || await activeDispute(application._id, session)) return;
        for (const day of application.dailyPayments) {
          if (day.paidAt || !day.submittedAt || !day.nextReminderAt || day.nextReminderAt > now) continue;
          const due = day.nextReminderAt.getTime();
          count += 1;
          await queueNotification(`daily-review:${application._id}:${day.workDate}:${due}`, { userId: String(job.jobPoster), audience: 'employer', type: 'payment', title: 'Daily proof awaits payment', message: `${job.title}: review proof for ${day.workDate} and Confirm and Pay PHP ${day.amount.toFixed(2)} in chat.`, entityType: 'application', entityId: String(application._id) }, session);
          // Advance by whole 12-hour periods, retaining the cadence after downtime.
          day.nextReminderAt = new Date(due + (Math.floor((now.getTime() - due) / DAILY_REVIEW_INTERVAL_MS) + 1) * DAILY_REVIEW_INTERVAL_MS);
        }
        await application.save({ session });
        return count;
      });
      reminders += sent || 0;
    } finally { await session.endSession(); }
  }
  return { checked, reminders };
}

export function startDailyPaymentChecks() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await checkPendingDailyPayments(); await deliverOutbox(100); }
    catch (error) { console.error('Daily payment check failed:', error.name); }
    finally { running = false; }
  };
  void run();
  const timer = setInterval(() => void run(), DAILY_REVIEW_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
