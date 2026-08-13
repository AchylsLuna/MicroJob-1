import mongoose from 'mongoose';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import JobOffer from '../models/JobOffer.js';
import Message from '../models/Message.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { createNotification } from '../lib/notificationService.js';
import { emitToUser } from '../lib/socket.js';

const userId = (req) => String(req.user?.id || req.user?.userId || '');
const serialize = (offer) => ({ id: String(offer._id), applicationId: String(offer.application), jobId: String(offer.job), employerId: String(offer.employer), workerId: String(offer.worker), amount: Number(offer.amount), status: offer.status, createdAt: offer.createdAt, acceptedAt: offer.acceptedAt });

async function refundExtra(offer, session) {
  if (Number(offer.additionalEscrow || 0) <= 0) return;
  const reference = `offer-extra-refund:${offer._id}`;
  if (await Transaction.exists({ reference }).session(session)) return;
  await User.updateOne({ _id: offer.employer }, { $inc: { employerBalance: offer.additionalEscrow } }, { session });
  await Transaction.create([{ sender: null, receiver: offer.employer, amount: offer.additionalEscrow, type: 'REFUND', status: 'COMPLETED', balanceTarget: 'EMPLOYER', jobReference: offer.job, reference, label: 'Negotiated offer escrow refund', relatedEntityType: 'job_offer', relatedEntityId: String(offer._id), actor: offer.employer }], { session });
}

export async function createJobOffer(req, res) {
  const session = await mongoose.startSession();
  let created;
  try {
    await session.withTransaction(async () => {
      const application = await JobApplication.findById(req.params.applicationId).session(session);
      if (!application) throw Object.assign(new Error('Application not found.'), { status: 404 });
      const job = await Job.findOne({ _id: application.job, jobPoster: userId(req) }).session(session);
      if (!job) throw Object.assign(new Error('You cannot offer terms for this application.'), { status: 403 });
      if (['Hired', 'Rejected', 'Withdrawn'].includes(application.status)) throw Object.assign(new Error('This application cannot receive an offer.'), { status: 409 });
      const amount = Number(req.body?.amount);
      if (!Number.isFinite(amount) || amount < Number(job.salary)) throw Object.assign(new Error(`Offer must be at least PHP ${Number(job.salary).toFixed(2)}.`), { status: 400 });
      if (await JobOffer.exists({ application: application._id, status: { $in: ['pending', 'accepted'] } }).session(session)) throw Object.assign(new Error('This application already has an active offer.'), { status: 409 });
      const reservation = await Job.updateOne({ _id: job._id, $expr: { $lt: [{ $add: [{ $ifNull: ['$hiredCount', 0] }, { $ifNull: ['$reservedOfferCount', 0] }] }, '$positionsNeeded'] } }, { $inc: { reservedOfferCount: 1 } }, { session });
      if (!reservation.modifiedCount) throw Object.assign(new Error('All job positions are already hired or reserved by offers.'), { status: 409 });
      const extra = Number((amount - Number(job.salary)).toFixed(2));
      if (extra > 0) {
        const debit = await User.updateOne({ _id: userId(req), employerBalance: { $gte: extra } }, { $inc: { employerBalance: -extra } }, { session });
        if (!debit.modifiedCount) throw Object.assign(new Error('Employer balance is insufficient for the negotiated increase.'), { status: 409 });
      }
      [created] = await JobOffer.create([{ job: job._id, application: application._id, employer: userId(req), worker: application.applicant, amount, additionalEscrow: extra }], { session });
      if (extra > 0) await Transaction.create([{ sender: userId(req), receiver: null, amount: extra, type: 'ESCROW', status: 'COMPLETED', balanceTarget: 'ESCROW', jobReference: job._id, reference: `offer-extra:${created._id}`, label: 'Negotiated offer escrow', relatedEntityType: 'job_offer', relatedEntityId: String(created._id), actor: userId(req) }], { session });
      const message = await Message.create([{ sender: userId(req), receiver: application.applicant, job: job._id, content: `Formal job offer for ${job.title}`, clientMessageId: `job-offer:${created._id}`, attachment: { type: 'job_offer', jobOffer: created._id, application: application._id, jobTitle: job.title, offerAmount: amount } }], { session });
      created.chatMessage = message[0]._id; await created.save({ session });
      application.status = 'Offer Sent'; await application.save({ session });
    });
    await createNotification({ userId: created.worker, audience: 'worker', type: 'application', title: 'Formal job offer', message: `You received a PHP ${Number(created.amount).toFixed(2)} job offer.`, entityType: 'job_offer', entityId: created._id, actor: created.employer, push: true });
    const chatMessage = await Message.findById(created.chatMessage).populate('sender', 'firstName lastName').populate('receiver', 'firstName lastName').populate('job', 'title').populate('attachment.jobOffer', 'status amount acceptedAt resolvedAt');
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
    await session.withTransaction(async () => {
      offer = await JobOffer.findOne({ _id: req.params.offerId, worker: userId(req), status: 'pending' }).session(session);
      if (!offer) throw Object.assign(new Error('Pending offer not found.'), { status: 404 });
      offer.status = action === 'accept' ? 'accepted' : 'rejected'; offer.acceptedAt = action === 'accept' ? new Date() : null; offer.resolvedAt = new Date();
      if (action === 'reject') { await refundExtra(offer, session); await Job.updateOne({ _id: offer.job, reservedOfferCount: { $gt: 0 } }, { $inc: { reservedOfferCount: -1 } }, { session }); await JobApplication.updateOne({ _id: offer.application, status: 'Offer Sent' }, { $set: { status: 'Shortlisted' } }, { session }); }
      await offer.save({ session });
    });
    await createNotification({ userId: offer.employer, audience: 'employer', type: 'application', title: `Offer ${offer.status}`, message: `The worker ${offer.status} your formal offer.`, entityType: 'job_offer', entityId: offer._id, actor: offer.worker, push: true });
    emitToUser(String(offer.employer), 'job_offer_updated', serialize(offer));
    return res.json({ offer: serialize(offer) });
  } catch (error) { return res.status(error.status || 500).json({ message: error.message || 'Unable to update offer.' }); }
  finally { await session.endSession(); }
}

export async function cancelJobOffer(req, res) {
  const session = await mongoose.startSession(); let offer;
  try {
    await session.withTransaction(async () => {
      offer = await JobOffer.findOne({ _id: req.params.offerId, employer: userId(req), status: { $in: ['pending', 'accepted'] } }).session(session);
      if (!offer) throw Object.assign(new Error('Active offer not found.'), { status: 404 });
      await refundExtra(offer, session); await Job.updateOne({ _id: offer.job, reservedOfferCount: { $gt: 0 } }, { $inc: { reservedOfferCount: -1 } }, { session }); await JobApplication.updateOne({ _id: offer.application, status: 'Offer Sent' }, { $set: { status: 'Shortlisted' } }, { session }); offer.status = 'cancelled'; offer.resolvedAt = new Date(); await offer.save({ session });
    });
    await createNotification({ userId: offer.worker, audience: 'worker', type: 'application', title: 'Offer cancelled', message: 'The employer cancelled the formal job offer.', entityType: 'job_offer', entityId: offer._id, actor: offer.employer, push: true });
    emitToUser(String(offer.worker), 'job_offer_updated', serialize(offer));
    return res.json({ offer: serialize(offer) });
  } catch (error) { return res.status(error.status || 500).json({ message: error.message || 'Unable to cancel offer.' }); }
  finally { await session.endSession(); }
}

export async function confirmOfferHire(req, res) {
  const session = await mongoose.startSession(); let offer; let application; let job;
  try {
    await session.withTransaction(async () => {
      offer = await JobOffer.findOne({ _id: req.params.offerId, employer: userId(req), status: 'accepted' }).session(session);
      if (!offer) throw Object.assign(new Error('Accepted offer not found.'), { status: 404 });
      application = await JobApplication.findById(offer.application).session(session); job = await Job.findById(offer.job).session(session);
      if (!application || !job || Number(job.hiredCount || 0) >= Number(job.positionsNeeded || 1)) throw Object.assign(new Error('This job no longer has an available position.'), { status: 409 });
      application.status = 'Hired'; application.agreedAmount = offer.amount; application.workStatus = 'In Progress'; application.paymentStatus = 'Secured'; await application.save({ session });
      job.hiredCount = Number(job.hiredCount || 0) + 1; job.reservedOfferCount = Math.max(0, Number(job.reservedOfferCount || 0) - 1); job.status = job.hiredCount >= job.positionsNeeded ? 'Closed' : 'Available'; await job.save({ session });
      offer.status = 'hired'; offer.resolvedAt = new Date(); await offer.save({ session });
    });
    await createNotification({ userId: offer.worker, audience: 'worker', type: 'application', title: 'You are hired', message: `Your PHP ${Number(offer.amount).toFixed(2)} offer was confirmed.`, entityType: 'application', entityId: application._id, actor: offer.employer, push: true });
    return res.json({ offer: serialize(offer), application });
  } catch (error) { return res.status(error.status || 500).json({ message: error.message || 'Unable to confirm hire.' }); }
  finally { await session.endSession(); }
}
