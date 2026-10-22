import { conversationLink } from '../lib/jobNotificationLinks.js';
import Cancellation from '../models/Cancellation.js';
import { remainingJobFunds, requiredJobFunds } from '../services/jobFunds.js';
import { syncCapacity } from '../services/jobLifecycle.js';
import { queueNotification, deliverQueuedNotification } from '../services/notificationOutbox.js';
import { POLICY_VERSION, requireReason, httpError } from '../lib/lifecyclePolicy.js';
import mongoose from 'mongoose';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import JobOffer from '../models/JobOffer.js';
import Message from '../models/Message.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { emitToUser } from '../lib/socket.js';
import { normalizeHireChecklist } from '../lib/hireChecklist.js';
import { buildConversationKey } from '../lib/jobInquiry.js';
import { isDailyJob, workdayCount, manilaDate } from '../lib/dailyWorkPolicy.js';
import { offerDeadline, isOfferExpired } from '../lib/offerPolicy.js';
import { refundOfferExtra as refundExtra, expireOffer } from '../services/offerLifecycle.js';

const userId = (req) => String(req.user?.id || req.user?.userId || '');
const serialize = (offer) => ({ id: String(offer._id), applicationId: String(offer.application), jobId: String(offer.job), employerId: String(offer.employer), workerId: String(offer.worker), amount: Number(offer.amount), status: offer.status, createdAt: offer.createdAt, acceptedAt: offer.acceptedAt, expiresAt: offer.expiresAt });

export async function createJobOffer(req, res) {
  const session = await mongoose.startSession();
  let created;
  try {
    const overdue = await JobOffer.findOne({ application: req.params.applicationId, employer: userId(req), status: 'pending', expiresAt: { $ne: null, $lte: new Date() } });
    if (overdue) await expireOffer(overdue._id);
    await session.withTransaction(async () => {
      const application = await JobApplication.findById(req.params.applicationId).session(session);
      if (!application) throw Object.assign(new Error('Application not found.'), { status: 404 });
      const job = await Job.findOne({ _id: application.job, jobPoster: userId(req) }).session(session);
      if (!job) throw Object.assign(new Error('You cannot offer terms for this application.'), { status: 403 });
      if (job.cancellationPending || job.archivedAt || job.closedManually || ['Completed', 'Cancelled'].includes(job.status) || new Date(job.deadline).getTime() <= Date.now()) throw httpError(409, 'This job is not accepting offers.');
      if (job.interviewRequired && !application.interviews.some((item) => item.status === 'completed')) throw httpError(409, 'Complete the required interview before sending an offer.');
      if (['Hired', 'Rejected', 'Withdrawn', 'Cancelled', 'Position filled'].includes(application.status)) throw Object.assign(new Error('This application cannot receive an offer.'), { status: 409 });
      if ((await remainingJobFunds(job._id, session)).remaining < await requiredJobFunds(job, session)) throw httpError(409, 'Secured funds require reconciliation before another offer.');
      const amount = Number(req.body?.amount);
      if (!Number.isFinite(amount) || Math.round(amount * 100) / 100 !== amount || amount < Number(job.salary)) throw Object.assign(new Error(`Offer must be at least PHP ${Number(job.salary).toFixed(2)}.`), { status: 400 });
      if (await JobOffer.exists({ application: application._id, status: { $in: ['pending', 'accepted'] } }).session(session)) throw Object.assign(new Error('This application already has an active offer.'), { status: 409 });
      const reservation = await Job.updateOne({ _id: job._id, $expr: { $lt: [{ $add: [{ $ifNull: ['$hiredCount', 0] }, { $ifNull: ['$reservedOfferCount', 0] }] }, '$positionsNeeded'] } }, { $inc: { reservedOfferCount: 1 } }, { session });
      if (!reservation.modifiedCount) throw Object.assign(new Error('All job positions are already hired or reserved by offers.'), { status: 409 });
      if (isDailyJob(job) && job.workDates[0] < manilaDate()) throw httpError(409, 'The work schedule has started. Post again with new dates before offering or hiring.');
      const extra = Number(((amount - Number(job.salary)) * workdayCount(job)).toFixed(2));
      if (extra > 0) {
        const debit = await User.updateOne({ _id: userId(req), employerBalance: { $gte: extra } }, { $inc: { employerBalance: -extra } }, { session });
        if (!debit.modifiedCount) throw Object.assign(new Error('Employer balance is insufficient for the negotiated increase.'), { status: 409 });
      }
      [created] = await JobOffer.create([{ job: job._id, application: application._id, employer: userId(req), worker: application.applicant, amount, additionalEscrow: extra, ...offerDeadline(job) }], { session });
      if (extra > 0) await Transaction.create([{ sender: userId(req), receiver: null, amount: extra, type: 'ESCROW', status: 'COMPLETED', balanceTarget: 'ESCROW', jobReference: job._id, reference: `offer-extra:${created._id}`, meta: { fundingSources: { EMPLOYER: extra, WORKER: 0 } }, label: 'Negotiated offer escrow', relatedEntityType: 'job_offer', relatedEntityId: String(created._id), actor: userId(req) }], { session });
      const message = await Message.create([{ sender: userId(req), receiver: application.applicant, job: job._id, content: `Formal job offer for ${job.title}`, clientMessageId: `job-offer:${created._id}`, attachment: { type: 'job_offer', jobOffer: created._id, application: application._id, jobTitle: job.title, offerAmount: amount, ...(isDailyJob(job) ? { workDates: job.workDates, workStartTime: job.workStartTime, workEndTime: job.workEndTime, dailyAmount: amount, totalAmount: Number((amount * workdayCount(job)).toFixed(2)) } : {}) } }], { session });
      created.chatMessage = message[0]._id; await created.save({ session });
      application.status = 'Offer Sent'; await application.save({ session });
      await syncCapacity(job, session);
      if (job.hiredCount + job.reservedOfferCount >= job.positionsNeeded) {
        const others = await JobApplication.find({ job: job._id, _id: { $ne: application._id }, status: { $in: ['Applied', 'Shortlisted', 'Interview Scheduled', 'Interviewed'] } }).session(session);
        for (const other of others) await queueNotification(`recruitment-paused:${created._id}:${other._id}`, { userId: String(other.applicant), audience: 'worker', type: 'application', title: 'Recruitment paused', message: 'Available positions are reserved by pending offers. Your application is retained.', entityType: 'application', entityId: String(other._id) }, session);
      }
      await queueNotification(`offer-created:${created._id}`, { userId: created.worker, audience: 'worker', type: 'application', title: 'Job offer received', message: `You received a PHP ${Number(created.amount).toFixed(2)} job offer for ${job.title}.`, link: conversationLink('worker', created.employer, created.job), metadata: { jobId: String(created.job), applicationId: String(created.application) }, entityType: 'job_offer', entityId: created._id, actor: created.employer, push: true, pushData: { participantId: String(created.employer), jobId: String(created.job) } }, session);
    });
    await deliverQueuedNotification(`offer-created:${created._id}`);
    const chatMessage = await Message.findById(created.chatMessage).populate('sender', 'firstName lastName').populate('receiver', 'firstName lastName').populate('job', 'title').populate('attachment.jobOffer', 'status amount acceptedAt resolvedAt expiresAt').populate('attachment.application', 'workStatus paymentStatus workSubmittedAt dailyPayments');
    if (chatMessage) { emitToUser(String(created.worker), 'new_message', chatMessage); emitToUser(String(created.employer), 'new_message_echo', chatMessage); }
    emitToUser(String(created.worker), 'job_offer_updated', serialize(created));
    return res.status(201).json({ offer: serialize(created) });
  } catch (error) { return res.status(error.status || 500).json({ message: error.message || 'Unable to create offer.' }); }
  finally { await session.endSession(); }
}

export async function respondToJobOffer(req, res) {
  const action = String(req.body?.action || '').toLowerCase();
  if (!['accept', 'reject'].includes(action)) return res.status(400).json({ message: 'Action must be accept or reject.' });
  const session = await mongoose.startSession(); let offer;
  try {
    const pending = await JobOffer.findOne({ _id: req.params.offerId, worker: userId(req), status: 'pending' });
    if (isOfferExpired(pending)) {
      await expireOffer(pending._id);
      return res.status(409).json({ message: 'This offer has expired. Contact the employer for a new offer.' });
    }
    await session.withTransaction(async () => {
      offer = await JobOffer.findOne({ _id: req.params.offerId, worker: userId(req), status: 'pending' }).session(session);
      if (!offer) throw Object.assign(new Error('Pending offer not found.'), { status: 404 });
      if (isOfferExpired(offer)) throw httpError(409, 'This offer has expired. Contact the employer for a new offer.');
      if (action === 'accept' && req.body?.policyAcknowledged !== true) throw httpError(400, 'Acknowledge the job and cancellation terms before accepting.');
      const job = await Job.findById(offer.job).session(session);
      if (!job || job.cancellationPending || ['Cancelled', 'Completed'].includes(job.status)) throw httpError(409, 'This posting is no longer available.');
      if (action === 'accept') { offer.policyVersion = POLICY_VERSION; offer.policyAcceptedAt = new Date(); }
      offer.status = action === 'accept' ? 'accepted' : 'rejected'; offer.acceptedAt = action === 'accept' ? new Date() : null; offer.resolvedAt = new Date();
      if (action === 'reject') { await refundExtra(offer, session); await Job.updateOne({ _id: offer.job, reservedOfferCount: { $gt: 0 } }, { $inc: { reservedOfferCount: -1 } }, { session }); await JobApplication.updateOne({ _id: offer.application, status: 'Offer Sent' }, { $set: { status: 'Shortlisted' } }, { session }); }
      await offer.save({ session });
      await syncCapacity(job, session);
      await queueNotification(`offer-response:${offer._id}:${offer.status}`, { userId: offer.employer, audience: 'employer', type: 'application', title: `Job offer ${offer.status}`, message: `The worker ${offer.status} your offer for ${job.title}.`, link: conversationLink('employer', offer.worker, offer.job), metadata: { jobId: String(offer.job), applicationId: String(offer.application) }, entityType: 'job_offer', entityId: offer._id, actor: offer.worker, push: true, pushData: { participantId: String(offer.worker), jobId: String(offer.job) } }, session);
    });
    await deliverQueuedNotification(`offer-response:${offer._id}:${offer.status}`);
    emitToUser(String(offer.employer), 'job_offer_updated', serialize(offer));
    return res.json({ offer: serialize(offer) });
  } catch (error) { return res.status(error.status || 500).json({ message: error.message || 'Unable to update offer.' }); }
  finally { await session.endSession(); }
}

export async function cancelJobOffer(req, res) {
  if (req.body?.policyAcknowledged !== true) return res.status(400).json({ message: 'Review and acknowledge the offer cancellation terms.' });
  let reason; try { reason = requireReason(req.body?.reason); } catch (error) { return res.status(400).json({ message: error.message }); }
  const session = await mongoose.startSession(); let offer;
  try {
    await session.withTransaction(async () => {
      offer = await JobOffer.findOne({ _id: req.params.offerId, employer: userId(req), status: { $in: ['pending', 'accepted'] } }).session(session);
      if (!offer) throw Object.assign(new Error('Active offer not found.'), { status: 404 });
      await refundExtra(offer, session); await Job.updateOne({ _id: offer.job, reservedOfferCount: { $gt: 0 } }, { $inc: { reservedOfferCount: -1 } }, { session }); await JobApplication.updateOne({ _id: offer.application, status: 'Offer Sent' }, { $set: { status: 'Shortlisted' } }, { session }); offer.status = 'cancelled'; offer.cancellationReason = reason; offer.resolvedAt = new Date(); await offer.save({ session });
      await Cancellation.create([{ job: offer.job, application: offer.application, offer: offer._id, scope: 'offer', actor: offer.employer, reason, status: 'resolved', resolvedAt: new Date(), policyVersion: POLICY_VERSION, events: [{ type: 'resolved', actor: offer.employer, note: reason }] }], { session });
      const job = await Job.findById(offer.job).session(session); if (job) await syncCapacity(job, session);
      await queueNotification(`offer-cancelled:${offer._id}`, { userId: offer.worker, audience: 'worker', type: 'application', title: 'Offer cancelled', message: 'The employer cancelled the formal job offer.', entityType: 'job_offer', entityId: offer._id, actor: offer.employer, push: true, pushData: { participantId: String(offer.employer), jobId: String(offer.job) } }, session);
    });
    emitToUser(String(offer.worker), 'job_offer_updated', serialize(offer));
    return res.json({ offer: serialize(offer) });
  } catch (error) { return res.status(error.status || 500).json({ message: error.message || 'Unable to cancel offer.' }); }
  finally { await session.endSession(); }
}

export async function confirmOfferHire(req, res) {
  let checklist;
  try { checklist = normalizeHireChecklist(req.body?.checklist); }
  catch (error) { return res.status(error.status || 400).json({ message: error.message }); }
  const session = await mongoose.startSession(); let offer; let application; let job; let checklistMessage;
  try {
    await session.withTransaction(async () => {
      offer = await JobOffer.findOne({ _id: req.params.offerId, employer: userId(req), status: 'accepted' }).session(session);
      if (!offer) throw Object.assign(new Error('Accepted offer not found.'), { status: 404 });
      application = await JobApplication.findById(offer.application).session(session); job = await Job.findById(offer.job).session(session);
      if (!application || !job || application.status !== 'Offer Sent' || job.cancellationPending || job.archivedAt || job.closedManually || ['Cancelled', 'Completed'].includes(job.status) || Number(job.hiredCount || 0) >= Number(job.positionsNeeded || 1)) throw Object.assign(new Error('This job no longer has an available position.'), { status: 409 });
      if (isDailyJob(job) && job.workDates[0] < manilaDate()) throw httpError(409, 'The work schedule has started. Post again with new dates before hiring.');
      application.agreedDailyRate = isDailyJob(job) ? offer.amount : null;
      application.dailyPayments = isDailyJob(job) ? job.workDates.map((workDate) => ({ workDate, amount: offer.amount })) : [];
      application.status = 'Hired'; application.hiredAt ||= new Date(); job.hireConfirmedAt ||= application.hiredAt; application.agreedAmount = Number((offer.amount * workdayCount(job)).toFixed(2)); application.workStatus = 'Not started'; application.startedAt = null; application.paymentStatus = 'Secured'; application.hireChecklist = checklist; await application.save({ session });
      job.hiredCount = Number(job.hiredCount || 0) + 1; job.reservedOfferCount = Math.max(0, Number(job.reservedOfferCount || 0) - 1); job.status = 'In Progress'; await job.save({ session });
      offer.status = 'hired'; offer.resolvedAt = new Date(); await offer.save({ session });
      if (checklist.length) {
        [checklistMessage] = await Message.create([{ sender: offer.employer, receiver: offer.worker, job: job._id, content: `Work checklist for ${job.title}`, clientMessageId: `hire-checklist:${offer._id}`, attachment: { type: 'hire_checklist', application: application._id, jobTitle: job.title, checklist: checklist.map((item) => item.description) } }], { session });
        await User.updateOne({ _id: offer.worker }, { $pull: { archivedConversations: buildConversationKey(String(offer.employer), String(job._id)) } }, { session });
        await User.updateOne({ _id: offer.employer }, { $pull: { archivedConversations: buildConversationKey(String(offer.worker), String(job._id)) } }, { session });
        await queueNotification(`checklist-created:${offer._id}`, { userId: String(offer.worker), audience: 'worker', type: 'message', title: 'Checklist created', message: `Your employer created a work checklist for ${job.title}. Open Messages to view it.`, link: conversationLink('worker', offer.employer, job._id), entityType: 'hire_checklist', entityId: String(application._id), actor: offer.employer, metadata: { jobId: String(job._id), applicationId: String(application._id), messageId: String(checklistMessage._id) }, pushData: { participantId: String(offer.employer), jobId: String(job._id) } }, session);
        application.timeline.push({ type: 'hire_checklist_sent', actor: userId(req), note: 'Hire checklist sent to the worker.', meta: { itemCount: checklist.length, messageId: checklistMessage._id } });
        await application.save({ session });
      }
      await queueNotification(`hired:${offer._id}`, { userId: String(offer.worker), audience: 'worker', type: 'application', title: 'You are hired', message: 'Review your assignment and select Start work when ready.', entityType: 'application', entityId: String(application._id) }, session);
      if (job.hiredCount >= job.positionsNeeded) {
        const others = await JobApplication.find({ job: job._id, status: { $in: ['Applied', 'Shortlisted', 'Interview Scheduled', 'Interviewed', 'Offer Sent'] } }).session(session);
        for (const other of others) { other.status = 'Position filled'; other.timeline.push({ type: 'position_filled', note: 'All positions were filled.', actor: userId(req) }); await other.save({ session }); await queueNotification(`filled:${job._id}:${other._id}`, { userId: String(other.applicant), audience: 'worker', type: 'application', title: 'Job positions filled', message: `All positions for ${job.title} have been filled.`, entityType: 'application', entityId: String(other._id) }, session); }
      }
    });

    await deliverQueuedNotification(`hired:${offer._id}`);
    if (checklistMessage) {
      await deliverQueuedNotification(`checklist-created:${offer._id}`);
      try {
        const message = await Message.findById(checklistMessage._id).populate('sender', 'firstName lastName').populate('receiver', 'firstName lastName').populate('job', 'title');
        if (message) { emitToUser(String(offer.worker), 'new_message', message); emitToUser(String(offer.employer), 'new_message_echo', message); }
      } catch { /* The checklist remains in persisted chat history if realtime delivery is interrupted. */ }
    }
    return res.json({ offer: serialize(offer), application });
  } catch (error) { return res.status(error.status || 500).json({ message: error.message || 'Unable to confirm hire.' }); }
  finally { await session.endSession(); }
}
