import mongoose from 'mongoose';
import FinancialDispute from '../models/FinancialDispute.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { createNotification } from '../lib/notificationService.js';

const toCents = (amount) => Math.round(Number(amount) * 100);

export async function resolvePaymentDispute({ disputeId, workerPayoutAmount, resolutionNotes, adminId }) {
  const rawPayoutAmount = Number(workerPayoutAmount);
  const payoutCents = toCents(rawPayoutAmount);
  if (!Number.isFinite(rawPayoutAmount) || !Number.isSafeInteger(payoutCents)
    || payoutCents < 0 || Math.abs(rawPayoutAmount * 100 - payoutCents) > 1e-7) {
    throw Object.assign(new Error('Worker payout must be a non-negative amount with at most two decimal places.'), { status: 400 });
  }
  const notes = String(resolutionNotes || '').trim();
  if (!notes) throw Object.assign(new Error('Resolution notes are required.'), { status: 400 });

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const dispute = await FinancialDispute.findById(disputeId).session(session);
      if (!dispute) throw Object.assign(new Error('Financial dispute not found.'), { status: 404 });
      if (!dispute.application) throw Object.assign(new Error('This financial dispute is not linked to a job application.'), { status: 409 });
      if (!['open', 'investigating'].includes(dispute.status)) {
        throw Object.assign(new Error('This dispute has already been resolved.'), { status: 409 });
      }

      const application = await JobApplication.findOne({
        _id: dispute.application,
        status: 'Hired',
        workStatus: 'Submitted',
        paymentStatus: 'Disputed',
      }).session(session);
      if (!application) throw Object.assign(new Error('The disputed assignment is no longer awaiting resolution.'), { status: 409 });

      const job = await Job.findOne({ _id: application.job }).session(session);
      if (!job) throw Object.assign(new Error('The job for this dispute could not be found.'), { status: 404 });
      const agreedCents = toCents(application.agreedAmount || job.salary || 0);
      if (!Number.isSafeInteger(agreedCents) || agreedCents <= 0 || agreedCents !== toCents(dispute.amount)) {
        throw Object.assign(new Error('The disputed amount no longer matches the assignment amount.'), { status: 409 });
      }
      if (payoutCents > agreedCents) {
        throw Object.assign(new Error('Worker payout cannot exceed the agreed job payment.'), { status: 400 });
      }

      const [escrow, payouts, refunds] = await Promise.all(['ESCROW', 'PAYOUT', 'REFUND'].map((type) => Transaction.aggregate([
        { $match: { jobReference: job._id, type, status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]).session(session)));
      const availableCents = toCents(escrow[0]?.total || 0) - toCents(payouts[0]?.total || 0) - toCents(refunds[0]?.total || 0);
      if (availableCents < agreedCents) {
        throw Object.assign(new Error('The secured job funds are insufficient to resolve this dispute.'), { status: 409 });
      }

      const refundCents = agreedCents - payoutCents;
      const workerAmount = payoutCents / 100;
      const employerRefund = refundCents / 100;
      const payoutReference = `dispute-resolution:${dispute._id}:worker`;
      const refundReference = `dispute-resolution:${dispute._id}:employer`;
      if (workerAmount > 0) {
        await User.updateOne({ _id: application.applicant }, { $inc: { workerBalance: workerAmount } }, { session });
        await Transaction.create([{
          sender: null,
          receiver: application.applicant,
          amount: workerAmount,
          type: 'PAYOUT',
          status: 'COMPLETED',
          balanceTarget: 'WORKER',
          jobReference: job._id,
          reference: payoutReference,
          label: `Dispute resolution payout (${job.title})`,
          relatedEntityType: 'financial_dispute',
          relatedEntityId: String(dispute._id),
          actor: adminId,
        }], { session });
      }
      if (employerRefund > 0) {
        await User.updateOne({ _id: job.jobPoster }, { $inc: { employerBalance: employerRefund } }, { session });
        await Transaction.create([{
          sender: null,
          receiver: job.jobPoster,
          amount: employerRefund,
          type: 'REFUND',
          status: 'COMPLETED',
          balanceTarget: 'EMPLOYER',
          jobReference: job._id,
          reference: refundReference,
          label: `Dispute resolution refund (${job.title})`,
          relatedEntityType: 'financial_dispute',
          relatedEntityId: String(dispute._id),
          actor: adminId,
        }], { session });
      }

      const resolvedAt = new Date();
      dispute.status = 'resolved';
      dispute.workerPayoutAmount = workerAmount;
      dispute.employerRefundAmount = employerRefund;
      dispute.resolutionNotes = notes;
      dispute.resolvedBy = adminId;
      dispute.resolvedAt = resolvedAt;
      await dispute.save({ session });

      application.paymentStatus = 'Paid';
      application.workStatus = 'Completed';
      application.paidAt = resolvedAt;
      application.completedAt = resolvedAt;
      application.timeline.push({
        type: 'payment_dispute_resolved',
        note: notes,
        actor: adminId,
        meta: { disputeId: String(dispute._id), workerPayoutAmount: workerAmount, employerRefundAmount: employerRefund },
        createdAt: resolvedAt,
      });
      await application.save({ session });
      result = { dispute, application, job, workerAmount, employerRefund };
    });
  } finally {
    await session.endSession();
  }

  const message = `The payment dispute for ${result.job.title} was resolved. Worker payout: PHP ${result.workerAmount.toFixed(2)}; employer refund: PHP ${result.employerRefund.toFixed(2)}.`;
  const notificationResults = await Promise.allSettled([
    createNotification({
      userId: result.application.applicant,
      audience: 'worker',
      type: 'payment',
      title: 'Payment dispute resolved',
      message,
      entityType: 'application',
      entityId: result.application._id,
      actor: adminId,
      push: true,
    }),
    createNotification({
      userId: result.job.jobPoster,
      audience: 'employer',
      type: 'payment',
      title: 'Payment dispute resolved',
      message,
      entityType: 'application',
      entityId: result.application._id,
      actor: adminId,
      push: true,
    }),
  ]);
  notificationResults
    .filter((notification) => notification.status === 'rejected')
    .forEach(({ reason }) => console.error('Failed to notify a participant about payment dispute resolution:', reason));
  return result;
}
