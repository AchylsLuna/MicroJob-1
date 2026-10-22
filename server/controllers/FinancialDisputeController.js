import mongoose from 'mongoose';
import FinancialDispute from '../models/FinancialDispute.js';
import JobApplication from '../models/JobApplication.js';
import SupportTicket from '../models/SupportTicket.js';
import { createNotification } from '../lib/notificationService.js';
import { hasPermission, resolveStaffRole } from '../lib/adminPermissions.js';
import { hasValidDisputeEvidenceFileSignature, removeUploadFile } from '../middleware/uploadConfig.js';

const userId = (req) => String(req.user?.id || req.user?.userId || '');

const actorRole = (req, dispute = null) => {
  const id = userId(req);
  if (dispute && String(dispute.worker?._id || dispute.worker) === id) return 'worker';
  if (dispute && String(dispute.employer?._id || dispute.employer) === id) return 'employer';
  const staffRole = resolveStaffRole(req.user);
  if (hasPermission(staffRole, 'finance.disputes.investigate')) return 'support';
  if (hasPermission(staffRole, 'finance.disputes.review')) return 'finance';
  return staffRole ? 'admin' : 'worker';
};

const canView = (req, dispute) => {
  const id = userId(req);
  if ([String(dispute.worker?._id || dispute.worker), String(dispute.employer?._id || dispute.employer)].includes(id)) return true;
  return hasPermission(resolveStaffRole(req.user), 'finance.disputes.view');
};

const populateDispute = (query) => query
  .populate('worker', 'firstName lastName email avatarUrl')
  .populate('employer', 'firstName lastName email companyName avatarUrl')
  .populate('raisedBy', 'firstName lastName email')
  .populate('job', 'title description salary status')
  .populate('application', 'agreedAmount workStatus paymentStatus timeline completionEvidence')
  .populate('assignedSupportUserId', 'firstName lastName email')
  .populate('assignedFinanceUserId', 'firstName lastName email')
  .populate('evidence.uploadedBy', 'firstName lastName email')
  .populate('messages.author', 'firstName lastName email')
  .populate('investigationReport.supportAgent', 'firstName lastName email')
  .populate('financeSettlement.financeUserId', 'firstName lastName email')
  .populate('financeSettlement.approvedBy', 'firstName lastName email');

export function shapeFinancialDispute(dispute, { staff = false } = {}) {
  const doc = dispute?.toObject ? dispute.toObject() : structuredClone(dispute || {});
  if (!staff) {
    doc.evidence = (doc.evidence || []).map((entry) => ({ ...entry, description: entry.description || entry.statement || (entry.noEvidence ? 'No evidence available' : '') }));
    doc.messages = (doc.messages || []).filter((message) => message.visibleToParties !== false);
    if (doc.investigationReport) delete doc.investigationReport.supportNotes;
    doc.investigationReportHistory = (doc.investigationReportHistory || []).map((report) => {
      const visibleReport = { ...report };
      delete visibleReport.supportNotes;
      return visibleReport;
    });
    doc.auditLogs = (doc.auditLogs || []).map((entry) => ({
      _id: entry._id,
      action: entry.action,
      previousStatus: entry.previousStatus,
      newStatus: entry.newStatus,
      timestamp: entry.timestamp,
    }));
  }
  const displayStatus = !doc.active || ['resolved', 'rejected'].includes(doc.status)
    ? doc.status === 'rejected' ? 'Closed' : 'Resolved'
    : doc.escalatedAt || doc.investigationStatus === 'ESCALATED' ? 'Escalated'
      : String(doc.investigationStatus).startsWith('AWAITING_') ? 'Awaiting Evidence'
        : doc.investigationStatus === 'OPEN' || doc.status === 'open' ? 'Open' : 'Under Review';
  return { ...doc, displayStatus, id: String(doc._id) };
}

export async function listMyFinancialDisputes(req, res) {
  try {
    const id = userId(req);
    const staff = hasPermission(resolveStaffRole(req.user), 'finance.disputes.view');
    const filter = staff ? {} : { $or: [{ worker: id }, { employer: id }] };
    const disputes = await populateDispute(FinancialDispute.find(filter).sort({ raisedAt: -1 }));
    return res.status(200).json({ disputes: disputes.map((item) => shapeFinancialDispute(item, { staff })) });
  } catch (error) {
    console.error('List financial disputes error:', error);
    return res.status(500).json({ message: 'Failed to load financial disputes.' });
  }
}

export async function getFinancialDispute(req, res) {
  try {
    const dispute = await populateDispute(FinancialDispute.findById(req.params.disputeId));
    if (!dispute) return res.status(404).json({ message: 'Financial dispute not found.' });
    if (!canView(req, dispute)) return res.status(403).json({ message: 'You cannot view this financial dispute.' });
    const staff = hasPermission(resolveStaffRole(req.user), 'finance.disputes.view');
    return res.status(200).json({ dispute: shapeFinancialDispute(dispute, { staff }) });
  } catch (error) {
    console.error('Get financial dispute error:', error);
    return res.status(500).json({ message: 'Failed to load the financial dispute.' });
  }
}

const notifyParticipants = async (dispute, title, message, actor) => {
  await Promise.allSettled([
    createNotification({ userId: dispute.worker, audience: 'worker', type: 'support', title, message, link: '/worker/financial-disputes', entityType: 'financial_dispute', entityId: dispute._id, actor, push: true }),
    createNotification({ userId: dispute.employer, audience: 'employer', type: 'support', title, message, link: '/employer/financial-disputes', entityType: 'financial_dispute', entityId: dispute._id, actor, push: true }),
  ]);
};

export async function addFinancialDisputeEvidence(req, res) {
  let storedFileName = req.file?.filename || null;
  try {
    const dispute = await FinancialDispute.findById(req.params.disputeId);
    if (!dispute) return res.status(404).json({ message: 'Financial dispute not found.' });
    if (!canView(req, dispute)) return res.status(403).json({ message: 'You cannot add evidence to this financial dispute.' });
    const currentUserId = userId(req);
    const isParticipant = [String(dispute.worker), String(dispute.employer)].includes(currentUserId);
    const staffRole = resolveStaffRole(req.user);
    if (!isParticipant && !hasPermission(staffRole, 'finance.disputes.investigate')) {
      return res.status(403).json({ message: 'Only a participant or Support investigator can add evidence.' });
    }
    if (!isParticipant && dispute.assignedSupportUserId && String(dispute.assignedSupportUserId) !== currentUserId && !['admin_team', 'superadmin'].includes(staffRole)) {
      return res.status(403).json({ message: 'Only the assigned Support investigator can add staff evidence.' });
    }
    if (!dispute.active) return res.status(409).json({ message: 'This financial dispute is already resolved.' });
    if (isParticipant && dispute.evidenceDueAt && new Date(dispute.evidenceDueAt) <= new Date()) return res.status(409).json({ message: 'The seven-day evidence period has ended.' });
    const statement = String(req.body?.statement || '').trim();
    const description = String(req.body?.description || statement.slice(0, 1000)).trim();
    const noEvidence = req.body?.noEvidence === true || req.body?.noEvidence === 'true';
    if (statement.length > 4000 || description.length > 1000) return res.status(400).json({ message: 'Evidence statements allow up to 4000 characters and descriptions up to 1000.' });
    if (!req.file && !description && !noEvidence) return res.status(400).json({ message: 'Choose a file, describe the evidence reference, or state that no evidence is available.' });
    if (req.file && !hasValidDisputeEvidenceFileSignature(req.file)) {
      await removeUploadFile(req.file.filename);
      storedFileName = null;
      return res.status(400).json({ message: 'The evidence file content does not match its file type.' });
    }
    const role = actorRole(req, dispute);
    const evidenceType = String(req.body?.evidenceType || 'OTHER').toUpperCase();
    dispute.evidence.push({
      uploadedBy: userId(req),
      uploaderRole: role,
      evidenceType,
      fileUrl: req.file ? `/uploads/${req.file.filename}` : null,
      fileName: req.file?.originalname || null,
      contentType: req.file?.mimetype || null,
      description,
      statement,
      noEvidence: noEvidence && !req.file,
    });
    const previousStatus = dispute.investigationStatus;
    if (['AWAITING_WORKER_EVIDENCE', 'AWAITING_EMPLOYER_EVIDENCE'].includes(previousStatus)) {
      dispute.investigationStatus = 'EVIDENCE_UNDER_REVIEW';
    }
    dispute.auditLogs.push({ userId: userId(req), role, action: 'EVIDENCE_UPLOADED', previousStatus, newStatus: dispute.investigationStatus, details: { evidenceType, fileName: req.file?.originalname || null } });
    await dispute.save();
    storedFileName = null;
    await notifyParticipants(dispute, 'Financial dispute evidence submitted', `New evidence was added to ${dispute.ticketId}.`, userId(req));
    return res.status(201).json({ message: 'Evidence added. Submitted evidence is append-only.', evidence: dispute.evidence.at(-1), dispute: shapeFinancialDispute(dispute) });
  } catch (error) {
    console.error('Add financial dispute evidence error:', error);
    return res.status(error?.name === 'ValidationError' ? 400 : 500).json({ message: error?.message || 'Failed to add evidence.' });
  } finally { if (storedFileName) await removeUploadFile(storedFileName); }
}

export async function addFinancialDisputeMessage(req, res) {
  try {
    const body = String(req.body?.message || '').trim();
    if (!body) return res.status(400).json({ message: 'Message is required.' });
    const dispute = await FinancialDispute.findById(req.params.disputeId);
    if (!dispute) return res.status(404).json({ message: 'Financial dispute not found.' });
    if (!canView(req, dispute)) return res.status(403).json({ message: 'You cannot respond to this financial dispute.' });
    if (!dispute.active && dispute.investigationStatus !== 'UNDER_APPEAL') return res.status(409).json({ message: 'This financial dispute is closed.' });
    const role = actorRole(req, dispute);
    const visibleToParties = role === 'support' || role === 'finance' || role === 'admin'
      ? req.body?.visibleToParties !== false
      : true;
    dispute.messages.push({ author: userId(req), authorRole: role, body, visibleToParties });
    dispute.auditLogs.push({ userId: userId(req), role, action: `${role.toUpperCase()}_RESPONDED`, newStatus: dispute.investigationStatus, details: { visibleToParties } });
    await dispute.save();
    if (visibleToParties) await notifyParticipants(dispute, 'Financial dispute response added', `A new response was added to ${dispute.ticketId}.`, userId(req));
    return res.status(201).json({ message: 'Response added.', dispute: shapeFinancialDispute(dispute, { staff: hasPermission(resolveStaffRole(req.user), 'finance.disputes.view') }) });
  } catch (error) {
    console.error('Add financial dispute response error:', error);
    return res.status(500).json({ message: 'Failed to add the response.' });
  }
}

export async function submitEmployerResponse(req, res) {
  try {
    const response = String(req.body?.response || '').trim();
    if (!response) return res.status(400).json({ message: 'Employer response is required.' });
    const dispute = await FinancialDispute.findById(req.params.disputeId);
    if (!dispute) return res.status(404).json({ message: 'Financial dispute not found.' });
    if (String(dispute.employer) !== userId(req)) return res.status(403).json({ message: 'Only the employer involved in this dispute can provide this response.' });
    if (!dispute.active) return res.status(409).json({ message: 'This financial dispute is already resolved.' });
    if (dispute.evidenceDueAt && new Date(dispute.evidenceDueAt) <= new Date()) return res.status(409).json({ message: 'The seven-day evidence period has ended.' });
    dispute.employerResponse = response;
    dispute.messages.push({ author: userId(req), authorRole: 'employer', body: response, visibleToParties: true });
    dispute.auditLogs.push({ userId: userId(req), role: 'employer', action: 'EMPLOYER_RESPONDED', newStatus: dispute.investigationStatus });
    await dispute.save();
    return res.status(200).json({ message: 'Employer response recorded.', dispute: shapeFinancialDispute(dispute) });
  } catch (error) {
    console.error('Employer financial dispute response error:', error);
    return res.status(500).json({ message: 'Failed to record the employer response.' });
  }
}

export async function submitFinancialDisputeAppeal(req, res) {
  const session = await mongoose.startSession();
  let dispute;
  try {
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ message: 'Appeal reason is required.' });
    await session.withTransaction(async () => {
      dispute = await FinancialDispute.findById(req.params.disputeId).session(session);
      if (!dispute) throw Object.assign(new Error('Financial dispute not found.'), { status: 404 });
      if (!canView(req, dispute) || ![String(dispute.worker), String(dispute.employer)].includes(userId(req))) {
        throw Object.assign(new Error('Only a party to this dispute can appeal.'), { status: 403 });
      }
      if (dispute.appealSubmittedAt) throw Object.assign(new Error('An appeal has already been submitted.'), { status: 409 });
      if (!['RESOLUTION_ISSUED', 'RESOLVED'].includes(dispute.investigationStatus)) {
        throw Object.assign(new Error('An appeal can be submitted only after a decision is issued.'), { status: 409 });
      }
      const previousStatus = dispute.investigationStatus;
      const appealedAt = new Date();
      if (dispute.investigationReport?.status === 'COMPLETED') {
        dispute.investigationReportHistory.push(dispute.investigationReport.toObject());
      }
      if (dispute.financeSettlement) dispute.settlementHistory.push(dispute.financeSettlement.toObject());
      dispute.investigationReport = { status: 'DRAFT' };
      dispute.financeSettlement = null;
      dispute.investigationStatus = 'UNDER_APPEAL';
      dispute.settlementStatus = 'NONE';
      dispute.active = true;
      dispute.appealReason = reason;
      dispute.appealSubmittedBy = userId(req);
      dispute.appealSubmittedAt = appealedAt;
      dispute.auditLogs.push({ userId: userId(req), role: actorRole(req, dispute), action: 'APPEAL_OPENED', previousStatus, newStatus: 'UNDER_APPEAL', details: { reason } });
      await dispute.save({ session });
      await JobApplication.updateOne(
        { _id: dispute.application },
        {
          $set: { paymentStatus: 'Disputed' },
          $push: { timeline: { type: 'financial_dispute_appealed', note: reason, actor: userId(req), meta: { disputeId: String(dispute._id) }, createdAt: appealedAt } },
        },
        { session },
      );
      if (dispute.supportTicket) {
        await SupportTicket.updateOne(
          { _id: dispute.supportTicket },
          { $set: { status: 'in_progress', resolvedAt: null } },
          { session },
        );
      }
    });
    await notifyParticipants(dispute, 'Financial dispute appeal submitted', `${dispute.ticketId} is under appeal.`, userId(req));
    return res.status(200).json({ message: 'Appeal submitted.', dispute: shapeFinancialDispute(dispute) });
  } catch (error) {
    if (!error.status) console.error('Financial dispute appeal error:', error);
    return res.status(error.status || 500).json({ message: error.message || 'Failed to submit the appeal.' });
  } finally {
    await session.endSession();
  }
}

export { canView as canViewFinancialDispute, populateDispute as populateFinancialDispute, actorRole as financialDisputeActorRole };
