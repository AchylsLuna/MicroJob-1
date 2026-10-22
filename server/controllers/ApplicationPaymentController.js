import { assignmentLink, disputeLink } from '../lib/jobNotificationLinks.js';
import FinancialDispute from '../models/FinancialDispute.js';
import SupportTicket from '../models/SupportTicket.js';
import User from '../models/User.js';
import { getDisputeMoneySnapshot, parseMoney, fromCents } from '../services/financialDisputeMoney.js';
import { hasPermission, resolveStaffRole } from '../lib/adminPermissions.js';
import { createNotification } from '../lib/notificationService.js';
import mongoose from 'mongoose';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import Message from '../models/Message.js';
import { settleApplicationPayment } from '../services/applicationSettlement.js';
import { activeDispute } from '../services/jobLifecycle.js';
import { queueNotification, deliverQueuedNotification } from '../services/notificationOutbox.js';
import { httpError, requireReason, HOUR, canFileNonpayment, EVIDENCE_WINDOW_MS } from '../lib/lifecyclePolicy.js';
import { hasValidAvatarFileSignature } from '../middleware/uploadConfig.js';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { uploadEvidenceToAzure, deleteEvidenceFromAzure } from '../lib/azureEvidenceStorage.js';
import { emitToUser } from '../lib/socket.js';
import { buildConversationKey } from '../lib/jobInquiry.js';
import { isDailyJob, requireDailySubmission, DAILY_REVIEW_INTERVAL_MS } from '../lib/dailyWorkPolicy.js';
import { settleDailyPayment } from '../services/dailyPayments.js';

const id = (req) => String(req.user?.id || req.user?.userId || '');
const handle = (fn) => async (req, res) => {
  try { return await fn(req, res); }
  catch (error) {
    if (!error.status) {
      const safeLabel = (value) => /^[A-Za-z0-9_]{1,64}$/.test(String(value || '')) ? String(value) : 'Unknown';
      console.error('Application payment action failed:', { action: req.route?.path || 'unknown', name: safeLabel(error.name), code: safeLabel(error.code) });
    }
    return res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to complete this action.' });
  }
};

export const previewPayment = handle(async (req, res) => {
  const application = await JobApplication.findById(req.params.applicationId); const job = application && await Job.findById(application.job);
  if (!job || String(job.jobPoster) !== id(req)) throw httpError(403, 'You cannot review this payment.');
  if (isDailyJob(job)) throw httpError(409, 'Review and pay each work date in chat.');
  if (!['Hired', 'Accepted'].includes(application.status) || application.paymentStatus === 'Paid' || application.cancellationPending || job.cancellationPending || await activeDispute(application._id)) throw httpError(409, 'This payment is unavailable or held.');
  const payment = await getDisputeMoneySnapshot({ application, job });
  const worker = await User.findById(application.applicant).select('firstName lastName');
  await queueNotification(`payment-review:${application._id}:${application.workSubmittedAt?.getTime() || 0}`, { userId: id(req), audience: 'employer', type: 'payment', title: 'Review before releasing funds', message: `Confirm PHP ${payment.remainingAgreedAmount.toFixed(2)} from secured funds for ${job.title}. No additional wallet debit is required.`, entityType: 'application', entityId: String(application._id) });
  return res.json({ application, jobTitle: job.title, recipient: { id: String(application.applicant), name: `${worker?.firstName || ''} ${worker?.lastName || ''}`.trim() }, amount: payment.remainingAgreedAmount, source: 'Secured job funds', walletDebit: 0 });
});

async function transition(req, kind) {
  const session = await mongoose.startSession(); let application;
  try {
    await session.withTransaction(async () => {
      application = await JobApplication.findOne({ _id: req.params.applicationId, status: { $in: ['Hired', 'Accepted'] } }).session(session);
      if (!application) throw httpError(404, 'Hired assignment not found.');
      const job = await Job.findById(application.job).session(session);
      const workerAction = kind === 'submit';
      if (String(workerAction ? application.applicant : job?.jobPoster) !== id(req)) throw httpError(403, 'You cannot update this assignment.');
      if (isDailyJob(job) && kind !== 'submit') throw httpError(409, 'Use daily proof and Confirm and Pay in the job chat.');
      if (application.cancellationPending || job.cancellationPending || ['Cancelled', 'Completed'].includes(job.status) || await activeDispute(application._id, session) || ['Paid', 'Processing', 'Disputed', 'Refunded'].includes(application.paymentStatus)) throw httpError(409, 'This assignment is held or already paid.');
      job.fundsVersion = Number(job.fundsVersion || 0) + 1; await job.save({ session });
      let title; let message;
      if (kind === 'authorize') {
        if (req.body?.confirmed !== true) throw httpError(400, 'Confirm the recipient and amount before authorizing payment.');
        application.paymentStatus = 'Authorized'; application.paymentAuthorizedAt ||= new Date();
        title = 'Payment authorized'; message = `Your employer has authorized payment for ${job.title}. Funds remain secured until the employer approves your submitted work.`;
      } else if (kind === 'submit') {
        if (!['In Progress', 'Changes Requested', 'Submitted'].includes(application.workStatus)) throw httpError(409, 'Start work before submitting it.');
        const statement = String(req.body?.statement || '').trim();
        if (!req.completionImages?.length || statement.length > 4000) throw httpError(400, 'Attach at least one completion image and use up to 4000 characters for the description.');
        const submittedAt = new Date();
        const daily = isDailyJob(job);
        const day = daily ? requireDailySubmission(application, req.body?.workDate, submittedAt) : null;
        if (day) { day.submittedAt = submittedAt; day.nextReminderAt = new Date(submittedAt.getTime() + DAILY_REVIEW_INTERVAL_MS); }
        application.completionEvidence.push(...req.completionImages.map((image) => ({ ...image, statement, storage: 'azure', actor: id(req), submittedAt, ...(day ? { workDate: day.workDate } : {}) })));
        application.timeline.push({ type: 'work_submitted', actor: id(req), note: statement.slice(0, 2000) || 'Completion evidence attached.' });
        if (!daily) application.workStatus = 'Submitted';
        application.workSubmittedAt = submittedAt; application.firstSubmittedAt ||= application.workSubmittedAt;
        await Message.create([{ _id: req.completionMessageId, sender: id(req), receiver: job.jobPoster, job: job._id, content: statement || `Work proof for ${job.title}${day ? ` (${day.workDate})` : ''}`, clientMessageId: `completion:${req.completionMessageId}`, attachment: { type: 'completion_evidence', application: application._id, jobTitle: job.title, submittedAt, images: req.completionImages, ...(day ? { workDate: day.workDate, dailyAmount: day.amount } : {}) } }], { session });
        await User.updateOne({ _id: job.jobPoster }, { $pull: { archivedConversations: buildConversationKey(id(req), String(job._id)) } }, { session });
        await User.updateOne({ _id: id(req) }, { $pull: { archivedConversations: buildConversationKey(String(job.jobPoster), String(job._id)) } }, { session });
        if (!daily && !application.reminderStages.includes(48)) application.nextPaymentReminderAt = new Date(application.firstSubmittedAt.getTime() + (application.reminderStages.includes(24) ? 48 : 24) * HOUR);
        title = `Proof pictures received for ${job.title}`;
        const pictureCount = req.completionImages.length;
        message = `The worker submitted proof with ${pictureCount} picture${pictureCount === 1 ? '' : 's'} for ${job.title}${day ? ` on ${day.workDate}` : ''}. Open the assignment to review the pictures before approving payment.`;
      } else {
        if (application.workStatus !== 'Submitted') throw httpError(409, 'Only submitted work can receive change requests.');
        const reason = requireReason(req.body?.reason);
        application.workStatus = 'Changes Requested'; application.changesRequestedAt = new Date();
        application.timeline.push({ type: 'changes_requested', actor: id(req), note: reason });
        await Message.create([{ sender: id(req), receiver: application.applicant, job: job._id, content: `Changes requested: ${reason}`, clientMessageId: `changes:${application._id}:${application.changesRequestedAt.getTime()}` }], { session });
        title = 'Changes requested'; message = reason;
      }
      await application.save({ session });
      await queueNotification(`${kind}:${application._id}:${kind === 'submit' ? application.workSubmittedAt.getTime() : kind === 'changes' ? application.changesRequestedAt.getTime() : 'authorized'}`, {
        userId: String(workerAction ? job.jobPoster : application.applicant),
        audience: workerAction ? 'employer' : 'worker',
        type: kind === 'authorize' ? 'payment' : 'application',
        title, message, entityType: 'application', entityId: String(application._id),
        ...(workerAction ? {
          actor: id(req),
          link: assignmentLink('employer', application._id, job._id),
          metadata: { jobId: String(job._id), jobTitle: job.title, pictureCount: req.completionImages.length, submittedAt: application.workSubmittedAt, ...(req.body?.workDate ? { workDate: req.body.workDate } : {}) },
        } : {}),
      }, session);
    });
    return application;
  } finally { await session.endSession(); }
}
export const authorizePayment = handle(async (req, res) => {
  const application = await transition(req, 'authorize');
  await deliverQueuedNotification(`authorize:${application._id}:authorized`);
  return res.json({ application });
});
export const submitWork = handle(async (req, res) => {
  let saved = false;
  const uploaded = [];
  try {
    const assignment = await JobApplication.findById(req.params.applicationId);
    if (!assignment) throw httpError(404, 'Hired assignment not found.');
    if (String(assignment.applicant) !== id(req)) throw httpError(403, 'You cannot update this assignment.');
    if (!['Hired', 'Accepted'].includes(assignment.status) || !['In Progress', 'Changes Requested', 'Submitted'].includes(assignment.workStatus)) throw httpError(409, 'Start work before submitting it.');
    const job = await Job.findById(assignment.job);
    if (isDailyJob(job)) requireDailySubmission(assignment, req.body?.workDate);
    const files = req.files || [];
    if (!files.length || files.length > 5) throw httpError(400, 'Attach between 1 and 5 completion images.');
    if (String(req.body?.statement || '').trim().length > 4000) throw httpError(400, 'The description must be 4000 characters or fewer.');
    for (const file of files) {
      if (file.buffer.length > 5 * 1024 * 1024) throw httpError(413, 'Each image must be 5 MB or smaller.');
      if (!hasValidAvatarFileSignature(file) || !String(file.mimetype).startsWith('image/')) throw httpError(400, 'Evidence must contain valid JPG, PNG, GIF, or WEBP images.');
    }
    req.completionImages = [];
    req.completionMessageId = new mongoose.Types.ObjectId();
    for (const file of files) {
      const filename = `completion-evidence_${randomUUID()}${path.extname(file.originalname).toLowerCase()}`;
      uploaded.push(filename);
      await uploadEvidenceToAzure({ filename, buffer: file.buffer, contentType: file.mimetype });
      req.completionImages.push({ fileUrl: `/uploads/${filename}`, fileName: file.originalname, contentType: file.mimetype });
    }
    const application = await transition(req, 'submit');
    saved = true;
    await deliverQueuedNotification(`submit:${application._id}:${application.workSubmittedAt.getTime()}`);
    try {
      const chatMessage = await Message.findById(req.completionMessageId).populate('sender', 'firstName lastName').populate('receiver', 'firstName lastName').populate('job', 'title').populate('attachment.application', 'workStatus paymentStatus workSubmittedAt dailyPayments');
      if (chatMessage) { emitToUser(String(chatMessage.receiver._id), 'new_message', chatMessage); emitToUser(id(req), 'new_message_echo', chatMessage); }
    } catch { /* Persisted chat history remains available if realtime delivery is interrupted. */ }
    return res.json({ application });
  } finally {
    if (!saved) await Promise.allSettled(uploaded.map((filename) => deleteEvidenceFromAzure(filename)));
  }
});
export const requestChanges = handle(async (req, res) => res.json({ application: await transition(req, 'changes') }));
export const settleDirect = handle(async (req, res) => {
  if (req.body?.confirmed !== true) throw httpError(400, 'Confirm the recipient and amount before releasing funds.');
  const result = await (req.body?.workDate !== undefined ? settleDailyPayment : settleApplicationPayment)({ applicationId: req.params.applicationId, employerId: id(req), expectedSubmittedAt: req.body?.submittedAt, workDate: req.body?.workDate });
  return res.json({ message: result.deduplicated ? 'Payment was already completed.' : 'Worker paid successfully.', application: result.application, job: result.job });
});

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
      const pendingProof = isDailyJob(application.job) ? application.dailyPayments.some((day) => day.submittedAt && !day.paidAt) : application.workStatus === 'Submitted';
      const pendingStatuses = isDailyJob(application.job) ? ['Secured', 'Authorized', 'Failed', 'Partially Paid'] : ['Secured', 'Authorized', 'Failed'];
      if (!pendingProof || !pendingStatuses.includes(application.paymentStatus)) {
        throw Object.assign(new Error('Only submitted work with pending payment can be disputed.'), { status: 409 });
      }
      if (req.body?.kind === 'nonpayment' && !canFileNonpayment(application)) throw httpError(409, 'A nonpayment dispute becomes available 72 hours after the first submission.');
      application.job.fundsVersion = Number(application.job.fundsVersion || 0) + 1;
      await application.job.save({ session });
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
        { _id: application._id, workStatus: application.workStatus, paymentStatus: { $in: pendingStatuses } },
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
        kind: req.body?.kind === 'nonpayment' ? 'nonpayment' : 'other',
        evidenceDueAt: new Date(Date.now() + EVIDENCE_WINDOW_MS),
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
      application.disputePending = money.fundsHeldAmount > 0;
      application.timeline.push({
        type: 'payment_dispute_opened',
        note: reason,
        actor: id(req),
        meta: { disputeId: String(dispute._id), ticketId, disputedAmount },
        createdAt: new Date(),
      });
      await application.save({ session });
      for (const [recipient, audience] of [[application.applicant, 'worker'], [employerId, 'employer']]) {
        await queueNotification(`dispute:${dispute._id}:${recipient}`, { userId: String(recipient), audience, type: 'support', title: 'Financial Dispute Under Investigation', message: `A financial dispute for ${application.job.title} (${dispute.ticketId}) is under investigation. No final decision has been made. Open the case to provide evidence or respond.`, link: disputeLink(audience, dispute._id), entityType: 'financial_dispute', entityId: String(dispute._id), actor: id(req), metadata: { jobId: String(application.job._id), applicationId: String(application._id) }, pushData: { jobId: String(application.job._id) } }, session);
      }
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

  await Promise.all([dispute.worker, dispute.employer].map((recipient) => deliverQueuedNotification(`dispute:${dispute._id}:${recipient}`)));
  try {
    const staff = await User.find({ role: { $in: ['admin', 'superadmin'] }, status: 'active' }).select('_id role staffRole').lean();
    const supportRecipients = staff.filter((user) => hasPermission(resolveStaffRole(user), 'finance.disputes.investigate'));
    await Promise.allSettled([
      ...supportRecipients.map((user) => createNotification({ userId: user._id, audience: 'shared', type: 'support', title: 'New financial dispute', message: `${dispute.ticketId} requires Support investigation.`, link: '/admin/disputes', entityType: 'financial_dispute', entityId: dispute._id, actor: id(req), push: true })),
    ]);
  } catch (error) {
    console.error('Failed to send financial dispute notices:', error);
  }
  return res.status(201).json({ message: 'Financial dispute submitted and support ticket created.', dispute, supportTicketId: supportTicket._id });
}
