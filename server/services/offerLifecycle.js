import mongoose from 'mongoose';
import JobOffer from '../models/JobOffer.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import { refundJobFunds, remainingJobFunds, requiredJobFunds } from './jobFunds.js';
import { syncCapacity, activeDispute } from './jobLifecycle.js';
import { queueNotification } from './notificationOutbox.js';
import { httpError } from '../lib/lifecyclePolicy.js';
import { emitToUser } from '../lib/socket.js';

export async function refundOfferExtra(offer, session) {
  if (Number(offer.additionalEscrow || 0) <= 0) return;
  const job = await Job.findById(offer.job).session(session);
  if (!job) throw httpError(409, 'Offer funds require Finance reconciliation.');
  return refundJobFunds({ job, amount: Number(offer.additionalEscrow), reference: `offer-extra-refund:${offer._id}`, preferredWallet: 'EMPLOYER', actor: offer.employer, session });
}

export async function expireOffer(offerId, now = new Date()) {
  const session = await mongoose.startSession();
  let expired = false;
  let event;
  try {
    await session.withTransaction(async () => {
      expired = false;
      event = null;
      const offer = await JobOffer.findOne({ _id: offerId, status: 'pending', expiresAt: { $ne: null, $lte: now } }).session(session);
      if (!offer) return;
      const job = await Job.findById(offer.job).session(session);
      const application = await JobApplication.findById(offer.application).session(session);
      if (!job || !application) throw httpError(409, 'Offer records require Finance reconciliation.');
      if (job.cancellationPending || application.cancellationPending || application.disputePending || await activeDispute(application._id, session)) return;
      // Serialize with job funding, cancellation, and settlement before refunding.
      job.fundsVersion = Number(job.fundsVersion || 0) + 1; await job.save({ session });
      offer.status = 'expired'; offer.resolvedAt = now; await offer.save({ session });
      if ((await remainingJobFunds(job._id, session)).remaining - Number(offer.additionalEscrow || 0) < await requiredJobFunds(job, session)) throw httpError(409, 'Secured offer funds require Finance reconciliation.');
      await refundOfferExtra(offer, session);
      if (application.status === 'Offer Sent') {
        application.status = 'Shortlisted';
        application.timeline.push({ type: 'offer_expired', note: 'The offer response deadline passed. The application is retained.', meta: { offerId: String(offer._id) } });
        await application.save({ session });
      }
      await syncCapacity(job, session);
      for (const [userId, audience, actor] of [[offer.worker, 'worker', offer.employer], [offer.employer, 'employer', offer.worker]]) {
        await queueNotification(`offer-expired:${offer._id}:${audience}`, {
          userId: String(userId), audience, type: 'application', title: 'Job offer expired',
          message: audience === 'worker' ? `Your offer for ${job.title} expired before a response was received. Your application is retained; contact the employer if you are still interested.`
            : `The unanswered offer for ${job.title} expired. Its reserved position was released. PHP ${Number(offer.additionalEscrow || 0).toFixed(2)} in extra offer funds was returned; base job funding remains secured.`,
          entityType: 'job_offer', entityId: String(offer._id), actor: String(actor),
          pushData: { participantId: String(actor), jobId: String(job._id) },
        }, session);
      }
      expired = true;
      event = { id: String(offer._id), applicationId: String(offer.application), jobId: String(job._id), employerId: String(offer.employer), workerId: String(offer.worker), amount: offer.amount, status: 'expired', expiresAt: offer.expiresAt };
    });
    if (event) { emitToUser(event.workerId, 'job_offer_updated', event); emitToUser(event.employerId, 'job_offer_updated', event); }
    return expired;
  } finally { await session.endSession(); }
}

export async function maintainJobOffers({ now = new Date(), deadline = Date.now() + 40000, limit = 100 } = {}) {
  let expired = 0; let reminders = 0; let errors = 0;
  const overdue = await JobOffer.find({ status: 'pending', expiresAt: { $ne: null, $lte: now } }).sort({ expiresAt: 1 }).limit(limit).select('_id');
  for (const offer of overdue) {
    if (Date.now() >= deadline) break;
    try { if (await expireOffer(offer._id, now)) expired += 1; } catch { errors += 1; }
  }
  if (Date.now() >= deadline) return { expired, reminders, errors };
  const due = await JobOffer.find({ status: 'pending', expiresAt: { $gt: now }, responseReminderAt: { $ne: null, $lte: now }, responseReminderSentAt: null }).sort({ responseReminderAt: 1 }).limit(limit).select('_id');
  for (const candidate of due) {
    if (Date.now() >= deadline) break;
    const session = await mongoose.startSession();
    try {
      let added = false;
      await session.withTransaction(async () => {
        added = false;
        const offer = await JobOffer.findOne({ _id: candidate._id, status: 'pending', expiresAt: { $gt: now }, responseReminderSentAt: null }).session(session);
        const job = offer && await Job.findById(offer.job).session(session);
        if (!job || job.cancellationPending || job.archivedAt || ['Cancelled', 'Completed', 'Full refund', 'Resolved'].includes(job.status)) return;
        const application = await JobApplication.findById(offer.application).session(session);
        if (!application || application.status !== 'Offer Sent' || application.cancellationPending || application.disputePending || await activeDispute(application._id, session)) return;
        offer.responseReminderSentAt = now; await offer.save({ session });
        const when = offer.expiresAt.toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
        await queueNotification(`offer-response-reminder:${offer._id}`, {
          userId: String(offer.worker), audience: 'worker', type: 'application', title: 'Job offer awaiting your response',
          message: `Respond to your offer for ${job.title} by ${when} (Asia/Manila). An unanswered offer expires and releases the reserved position.`,
          entityType: 'job_offer', entityId: String(offer._id), actor: String(offer.employer),
          link: `/worker/messages?startUser=${offer.employer}&jobId=${job._id}`,
          pushData: { participantId: String(offer.employer), jobId: String(job._id) },
        }, session);
        added = true;
      });
      if (added) reminders += 1;
    } catch { errors += 1; } finally { await session.endSession(); }
  }
  return { expired, reminders, errors };
}
