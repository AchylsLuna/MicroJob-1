import mongoose from 'mongoose';
import JobApplication from '../models/JobApplication.js';
import FinancialDispute from '../models/FinancialDispute.js';
import SupportTicket from '../models/SupportTicket.js';
import User from '../models/User.js';
import { getDisputeMoneySnapshot, parseMoney, fromCents } from '../services/financialDisputeMoney.js';
import { hasPermission, resolveStaffRole } from '../lib/adminPermissions.js';
import { createNotification } from '../lib/notificationService.js';
import Message from '../models/Message.js';
import { emitToUser } from '../lib/socket.js';
import { settleApplicationPayment } from '../services/applicationSettlement.js';

const id = (req) => String(req.user?.id || req.user?.userId || '');

export async function openPaymentDispute(req, res) {
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ message: 'A reason is required to open a payment dispute.' });
  if (reason.length > 2000) return res.status(400).json({ message: 'The dispute reason must be 2000 characters or fewer.' });

  const session = await mongoose.startSession();
  let dispute;
  let application;
  let supportTicket;
  try {
    await session.withTransaction(async () => {
      application = await JobApplication.findById(req.params.applicationId).populate('job').session(session);
      if (!application || application.status !== 'Hired') {
        throw Object.assign(new Error('Hired application not found.'), { status: 404 });
      }
      const employerId = String(application.job?.jobPoster || '');
      if (String(application.applicant) !== id(req)) {
        throw Object.assign(new Error('Only the worker assigned to this job can submit a financial dispute.'), { status: 403 });
      }
      const activeDispute = await FinancialDispute.findOne({ application: application._id, active: true })
        .select('_id ticketId')
        .session(session);
      if (activeDispute) {
        throw Object.assign(new Error('An active financial dispute already exists for this job.'), {
          status: 409,
          existingDisputeId: activeDispute._id,
          ticketId: activeDispute.ticketId,
        });
      }
      if (application.workStatus !== 'Submitted' || !['Secured', 'Authorized', 'Failed'].includes(application.paymentStatus)) {
        throw Object.assign(new Error('Only submitted work with pending payment can be disputed.'), { status: 409 });
      }
      const money = await getDisputeMoneySnapshot({ application, job: application.job, session });
      if (money.agreedAmount <= 0 || money.remainingAgreedAmount <= 0) {
        throw Object.assign(new Error('The agreed payment amount is unavailable.'), { status: 409 });
      }
      const disputedCents = req.body?.disputedAmount === undefined
        ? Math.round(money.remainingAgreedAmount * 100)
        : parseMoney(req.body.disputedAmount, 'Disputed amount', { allowZero: false });
      if (disputedCents > Math.round(money.remainingAgreedAmount * 100)) {
        throw Object.assign(new Error('Disputed amount cannot exceed the unpaid agreed amount.'), { status: 400 });
      }

      const claimed = await JobApplication.updateOne(
        { _id: application._id, workStatus: 'Submitted', paymentStatus: { $in: ['Secured', 'Authorized', 'Failed'] } },
        { $set: { paymentStatus: 'Disputed' } },
        { session },
      );
      if (!claimed.modifiedCount) {
        throw Object.assign(new Error('This assignment already has a payment action in progress.'), { status: 409 });
      }

      const disputeObjectId = new mongoose.Types.ObjectId();
      const ticketId = `FIN-${new Date().getFullYear()}-${String(disputeObjectId).slice(-8).toUpperCase()}`;
      const disputedAmount = fromCents(disputedCents);
      const created = await FinancialDispute.create([{
        _id: disputeObjectId,
        ticketId,
        subject: `Payment dispute: ${application.job.title}`,
        raisedBy: id(req),
        application: application._id,
        job: application.job._id,
        worker: application.applicant,
        employer: employerId,
        agreedJobAmount: money.agreedAmount,
        alreadyPaidAmount: money.alreadyPaidAmount,
        disputedAmount,
        fundsHeldAmount: Math.min(money.fundsHeldAmount, disputedAmount),
        outstandingAmount: Math.max(0, Number((disputedAmount - Math.min(money.fundsHeldAmount, disputedAmount)).toFixed(2))),
        fundStatus: money.fundsHeldAmount <= 0 ? 'OUTSTANDING_PAYMENT' : money.fundsHeldAmount < disputedAmount ? 'PARTIALLY_HELD' : 'FUNDS_HELD',
        workerClaim: reason,
        investigationStatus: 'UNDER_INVESTIGATION',
        paymentStatus: money.alreadyPaidAmount > 0 ? 'PARTIALLY_PAID' : money.fundsHeldAmount > 0 ? 'FUNDS_HELD' : 'OUTSTANDING_PAYMENT',
        amount: disputedAmount,
        reason,
        status: 'investigating',
        messages: [{ author: id(req), authorRole: 'worker', body: reason, visibleToParties: true }],
        auditLogs: [
          { userId: id(req), role: 'worker', action: 'DISPUTE_SUBMITTED', newStatus: 'OPEN', details: { disputedAmount } },
          { userId: null, role: 'system', action: 'INVESTIGATION_STARTED', previousStatus: 'OPEN', newStatus: 'UNDER_INVESTIGATION' },
        ],
      }], { session });
      dispute = created[0];
      const tickets = await SupportTicket.create([{
        requester: id(req),
        financialDispute: dispute._id,
        relatedUsers: [application.applicant, employerId],
        subject: `[${ticketId}] Financial dispute: ${application.job.title}`,
        category: 'financial_dispute',
        priority: 'high',
        status: 'in_progress',
        messages: [{ author: id(req), actorRole: 'user', body: reason }],
      }], { session });
      supportTicket = tickets[0];
      dispute.supportTicket = supportTicket._id;
      dispute.auditLogs.push({ userId: null, role: 'system', action: 'SUPPORT_TICKET_CREATED', newStatus: 'UNDER_INVESTIGATION', details: { supportTicketId: String(supportTicket._id) } });
      await dispute.save({ session });
      application.paymentStatus = 'Disputed';
      application.timeline.push({
        type: 'payment_dispute_opened',
        note: reason,
        actor: id(req),
        meta: { disputeId: String(dispute._id), ticketId, disputedAmount },
        createdAt: new Date(),
      });
      await application.save({ session });
    });
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await FinancialDispute.findOne({ application: req.params.applicationId, active: true }).select('_id ticketId');
      return res.status(409).json({
        message: 'An active financial dispute already exists for this job.',
        existingDisputeId: existing?._id || null,
        ticketId: existing?.ticketId || null,
      });
    }
    if (error.status) return res.status(error.status).json({
      message: error.message,
      ...(error.existingDisputeId ? { existingDisputeId: error.existingDisputeId, ticketId: error.ticketId || null } : {}),
    });
    console.error('Open payment dispute error:', error);
    return res.status(500).json({ message: 'Failed to open payment dispute.' });
  } finally {
    await session.endSession();
  }

  const workerNotice = `Your financial dispute #${dispute.ticketId} has been received and is now under investigation. The MicroJobs Support Team will review the job records, payment information, and evidence submitted by both parties. You may be asked to provide additional information. No final decision has been made. You can track the case from your Financial Disputes page.`;
  const employerNotice = `A financial dispute has been opened regarding Job #${application.job._id} under Ticket #${dispute.ticketId}. The MicroJobs Support Team is reviewing the worker's claim and may request payment records, work records, or additional information from you. This notice does not indicate that either party has been found at fault. You can respond through the Financial Dispute ticket.`;
  try {
    const staff = await User.find({ role: { $in: ['admin', 'superadmin'] }, status: 'active' }).select('_id role staffRole').lean();
    const supportRecipients = staff.filter((user) => hasPermission(resolveStaffRole(user), 'finance.disputes.investigate'));
    await Promise.allSettled([
      createNotification({ userId: application.applicant, audience: 'worker', type: 'support', title: 'Financial Dispute Under Investigation', message: workerNotice, link: '/worker/financial-disputes', entityType: 'financial_dispute', entityId: dispute._id, actor: id(req), push: true }),
      createNotification({ userId: application.job.jobPoster, audience: 'employer', type: 'support', title: 'Financial Dispute Under Investigation', message: employerNotice, link: '/employer/financial-disputes', entityType: 'financial_dispute', entityId: dispute._id, actor: id(req), push: true }),
      ...supportRecipients.map((user) => createNotification({ userId: user._id, audience: 'shared', type: 'support', title: 'New financial dispute', message: `${dispute.ticketId} requires Support investigation.`, link: '/admin/disputes', entityType: 'financial_dispute', entityId: dispute._id, actor: id(req), push: true })),
    ]);
  } catch (error) {
    console.error('Failed to send financial dispute notices:', error);
  }
  return res.status(201).json({ message: 'Financial dispute submitted and support ticket created.', dispute, supportTicketId: supportTicket._id });
}

export async function authorizePayment(req, res) {
  const app = await JobApplication.findOne({ _id: req.params.applicationId, status: 'Hired' }).populate('job');
  if (!app) return res.status(404).json({ message: 'Hired application not found.' });
  if (String(app.job?.jobPoster) !== id(req)) return res.status(403).json({ message: 'You cannot authorize this payment.' });
  if (app.paymentStatus === 'Paid') return res.status(409).json({ message: 'This worker is already paid.' });
  if (app.paymentStatus === 'Disputed') return res.status(409).json({ message: 'Payment is on hold while the dispute is reviewed.' });
  app.paymentStatus = 'Authorized'; app.paymentAuthorizedAt ||= new Date(); await app.save();
  await createNotification({ userId: app.applicant, audience: 'worker', type: 'payment', title: 'Payment authorized', message: 'Your payment is secured and will remain held until work approval.', entityType: 'application', entityId: app._id, actor: id(req), push: true });
  return res.json({ application: app });
}

export async function submitWork(req, res) {
  const app = await JobApplication.findOne({ _id: req.params.applicationId, applicant: id(req), status: 'Hired' }).populate('job');
  if (!app) return res.status(404).json({ message: 'Hired application not found.' });
  if (!['In Progress', 'Changes Requested'].includes(app.workStatus)) return res.status(409).json({ message: 'This work cannot be submitted now.' });
  app.workStatus = 'Submitted'; app.workSubmittedAt = new Date();
  app.paymentReminderClaimedAt = null; app.paymentReminderSentAt = null;
  await app.save();
  await createNotification({ userId: app.job.jobPoster, audience: 'employer', type: 'application', title: 'Work submitted', message: `Finished work was submitted for ${app.job.title}.`, entityType: 'application', entityId: app._id, actor: id(req), push: true });
  return res.json({ application: app });
}

export async function requestChanges(req, res) {
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ message: 'A reason is required.' });
  const app = await JobApplication.findOne({ _id: req.params.applicationId, status: 'Hired' }).populate('job');
  if (!app) return res.status(404).json({ message: 'Hired application not found.' });
  if (String(app.job.jobPoster) !== id(req) || app.workStatus !== 'Submitted') return res.status(409).json({ message: 'Changes cannot be requested for this assignment.' });
  if (app.paymentStatus === 'Disputed') return res.status(409).json({ message: 'Changes cannot be requested while payment is under dispute review.' });
  app.workStatus = 'Changes Requested'; app.changesRequestedAt = new Date(); app.timeline.push({ type: 'changes_requested', note: reason, actor: id(req), createdAt: new Date() }); await app.save();
  const message = await Message.create({ sender: id(req), receiver: app.applicant, job: app.job._id, content: `Changes requested: ${reason}`, clientMessageId: `changes:${app._id}:${app.changesRequestedAt.getTime()}` });
  const hydrated = await Message.findById(message._id).populate('sender', 'firstName lastName').populate('receiver', 'firstName lastName').populate('job', 'title');
  emitToUser(String(app.applicant), 'new_message', hydrated || message); emitToUser(id(req), 'new_message_echo', hydrated || message);
  await createNotification({ userId: app.applicant, audience: 'worker', type: 'application', title: 'Changes requested', message: reason, entityType: 'application', entityId: app._id, actor: id(req), push: true });
  return res.json({ application: app });
}

export async function settleDirect(req, res) {
  try { const result = await settleApplicationPayment({ applicationId: req.params.applicationId, employerId: id(req) }); return res.json({ message: result.deduplicated ? 'Payment was already completed.' : 'Worker paid successfully.', application: result.application, job: result.job }); }
  catch (error) { return res.status(error.status || 500).json({ message: error.message || 'Payment failed.' }); }
}
