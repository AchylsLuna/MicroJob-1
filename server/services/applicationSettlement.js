import mongoose from 'mongoose';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { createNotification } from '../lib/notificationService.js';

export async function settleApplicationPayment({ applicationId, employerId }) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const application = await JobApplication.findOne({ _id: applicationId, status: 'Hired' }).session(session);
      if (!application) throw Object.assign(new Error('Hired application not found.'), { status: 404 });
      const job = await Job.findOne({ _id: application.job, jobPoster: employerId }).session(session);
      if (!job) throw Object.assign(new Error('You cannot pay this application.'), { status: 403 });
      if (application.paymentStatus === 'Paid') {
        result = { application, job, deduplicated: true };
        return;
      }
      if (application.workStatus !== 'Submitted') throw Object.assign(new Error('The worker must submit finished work before payment.'), { status: 409 });
      const reference = `application-payout:${application._id}`;
      const existing = await Transaction.findOne({ reference, status: 'COMPLETED' }).session(session);
      if (existing) {
        application.paymentStatus = 'Paid'; application.workStatus = 'Completed';
        application.paidAt ||= existing.createdAt; application.completedAt ||= existing.createdAt;
        await application.save({ session });
        result = { application, job, transaction: existing, deduplicated: true };
        return;
      }
      application.paymentStatus = 'Processing';
      await application.save({ session });
      const amount = Number(application.agreedAmount || job.salary || 0);
      const [escrow, payouts, refunds] = await Promise.all(['ESCROW', 'PAYOUT', 'REFUND'].map((type) => Transaction.aggregate([
        { $match: { jobReference: job._id, type, status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]).session(session)));
      const remaining = Number(escrow[0]?.total || 0) - Number(payouts[0]?.total || 0) - Number(refunds[0]?.total || 0);
      if (remaining < amount) throw Object.assign(new Error('The secured job funds are insufficient for this payment.'), { status: 409 });
      await User.updateOne({ _id: application.applicant }, { $inc: { workerBalance: amount } }, { session });
      const [transaction] = await Transaction.create([{ sender: null, receiver: application.applicant, amount, type: 'PAYOUT', status: 'COMPLETED', balanceTarget: 'WORKER', jobReference: job._id, reference, label: `Worker payout (${job.title})`, relatedEntityType: 'job_application', relatedEntityId: String(application._id), actor: employerId }], { session });
      application.paymentStatus = 'Paid'; application.workStatus = 'Completed'; application.paidAt = new Date(); application.completedAt = new Date();
      await application.save({ session });
      const unpaid = await JobApplication.countDocuments({ job: job._id, status: 'Hired', $or: [{ paymentStatus: { $ne: 'Paid' } }, { workStatus: { $ne: 'Completed' } }] }).session(session);
      if (unpaid === 0 && Number(job.hiredCount || 0) >= Number(job.positionsNeeded || 1)) { job.status = 'Completed'; await job.save({ session }); }
      result = { application, job, transaction, deduplicated: false };
    });
    if (!result?.deduplicated) await createNotification({ userId: result.application.applicant, audience: 'worker', type: 'payment', title: 'Job payment completed', message: `PHP ${Number(result.transaction.amount).toFixed(2)} was added to your worker balance.`, entityType: 'application', entityId: result.application._id, actor: employerId, push: true });
    return result;
  } finally { await session.endSession(); }
}
