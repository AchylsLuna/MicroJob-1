import User from '../models/User.js';
import Job from '../models/Job.js';
import { scoreJobForWorker } from '../lib/jobMatching.js';
import NotificationOutbox from '../models/NotificationOutbox.js';
import { createNotification } from '../lib/notificationService.js';
import { recruitmentState } from '../lib/lifecyclePolicy.js';
import { sendPaymentReceiptEmail } from './paymentReceiptService.js';

export async function queueNotification(key, payload, session) {
  await NotificationOutbox.updateOne({ key }, { $setOnInsert: { key, payload } }, { upsert: true, ...(session ? { session } : {}) });
}

export async function deliverOutbox(limit = 100, deadline = Date.now() + 40000, keys = null) {
  let delivered = 0;
  for (let i = 0; i < limit; i += 1) {
    if (Date.now() > deadline) break;
    const now = new Date();
    const item = await NotificationOutbox.findOneAndUpdate({ ...(keys ? { key: { $in: keys } } : {}), availableAt: { $lte: now }, status: { $in: ['pending', 'delivering'] } }, { $set: { status: 'delivering', availableAt: new Date(Date.now() + 120000) }, $inc: { attempts: 1 } }, { returnDocument: 'after', sort: { availableAt: 1 } });
    if (!item) break;
    try {
      if (item.payload.paymentReceipt) {
        const result = await sendPaymentReceiptEmail(item.payload.paymentReceipt).catch(() => { throw new Error('Payment receipt email delivery failed.'); });
        if (!result.sent) throw new Error(`Payment receipt pending: ${result.reason}`);
      } else if (item.payload.fanoutJobId) {
        const job = await Job.findById(item.payload.fanoutJobId).populate('category', 'name');
        if (job && recruitmentState(job).recruitmentOpen) {
          const workers = await User.find({ role: { $in: ['work', 'both'] }, status: 'active', _id: { $ne: job.jobPoster, ...(item.payload.cursor ? { $gt: item.payload.cursor } : {}) } }).sort({ _id: 1 }).limit(100).select('skills workExperience jobPreferences preferredCategories jobPosition about totalExperience city province');
          for (const worker of workers) {
            const match = scoreJobForWorker(job, worker);
            if (match.percentage >= 40 && match.reasons.some((reason) => ['Matching skills', 'Preferred category', 'Category fits your profile'].includes(reason))) await queueNotification(`new-job:${job._id}:${worker._id}`, { userId: String(worker._id), audience: 'worker', type: 'application', title: 'New job matches your profile', message: job.title, entityType: 'job', entityId: String(job._id) });
          }
          if (workers.length === 100) { await NotificationOutbox.updateOne({ _id: item._id }, { $set: { 'payload.cursor': String(workers.at(-1)._id), status: 'pending', availableAt: new Date() } }); continue; }
        }
      } else if (!/^payment-received:[a-f0-9]{24}$/i.test(item.key)) {
        // Retired duplicate of job-paid; acknowledge pending entries without
        // sending another feed, socket, or push alert.
        await createNotification({ ...item.payload, deliveryKey: item.key, retryPush: true });
      }
      await NotificationOutbox.updateOne({ _id: item._id, attempts: item.attempts }, { $set: { status: 'delivered', deliveredAt: new Date() }, $unset: { lastError: 1 } });
      delivered += 1;
    } catch (error) {
      await NotificationOutbox.updateOne({ _id: item._id, attempts: item.attempts }, { $set: { status: 'pending', lastError: String(error.message).slice(0, 300), availableAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(item.attempts, 7))) } });
    }
  }
  return delivered;
}

// Call only after the originating transaction commits. A delivery failure must
// not undo work or evidence; the durable outbox remains available for retry.
export async function deliverQueuedNotification(key) {
  try { return await deliverOutbox(1, Date.now() + 15000, [key]); }
  catch { return 0; }
}

export async function queueJobPaymentReceipts(transaction, employerId, workerId, session) {
  for (const [audience, userId] of [['employer', employerId], ['worker', workerId]]) {
    await queueNotification(`payment-receipt:${transaction.reference}:${audience}`, { paymentReceipt: { transactionId: String(transaction._id), userId: String(userId) } }, session);
  }
}

export async function deliverJobPaymentReceipts(reference) {
  return Promise.all(['employer', 'worker'].map((audience) => deliverQueuedNotification(`payment-receipt:${reference}:${audience}`)));
}
