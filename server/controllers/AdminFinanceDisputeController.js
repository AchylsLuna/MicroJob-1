import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import Message from '../models/Message.js';
import JobOffer from '../models/JobOffer.js';
import Transaction from '../models/Transaction.js';
import FinancialDispute from '../models/FinancialDispute.js';
import SupportTicket from '../models/SupportTicket.js';
import User from '../models/User.js';
import { createNotification } from '../lib/notificationService.js';
import { hasPermission, resolveStaffRole } from '../lib/adminPermissions.js';
import { populateFinancialDispute, shapeFinancialDispute } from './FinancialDisputeController.js';
import { approveAndProcessDisputeSettlement, proposeDisputeSettlement } from '../services/financialDisputeSettlement.js';

const id = (req) => String(req.user?.id || req.user?.userId || '');

const notificationFor = (userId, audience, dispute, title, message, actor) => createNotification({
  userId,
  audience,
  type: 'support',
  title,
  message,
  link: audience === 'worker' ? '/worker/financial-disputes' : '/employer/financial-disputes',
  entityType: 'financial_dispute',
  entityId: dispute._id,
  actor,
  push: true,
});

/** GET /admin/finance/disputes */
export async function listAdminFinancialDisputes(req, res) {
  try {
    const disputes = await populateFinancialDispute(FinancialDispute.find({}).sort({ raisedAt: -1 }));
    return res.status(200).json(disputes.map((dispute) => shapeFinancialDispute(dispute, { staff: true })));
  } catch (error) {
    console.error('List financial disputes error:', error);
    return res.status(500).json({ message: 'Failed to fetch financial disputes.' });
  }
}

export async function assignFinancialDisputeSupport(req, res) {
  try {
    const assignedSupportUserId = String(req.body?.assignedSupportUserId || id(req));
    const assignee = await User.findById(assignedSupportUserId).select('role staffRole status');
    if (!assignee || assignee.status !== 'active' || !hasPermission(resolveStaffRole(assignee), 'finance.disputes.investigate')) {
      return res.status(400).json({ message: 'Choose an active staff member authorized to investigate financial disputes.' });
    }
    const dispute = await FinancialDispute.findById(req.params.disputeId);
    if (!dispute) return res.status(404).json({ message: 'Financial dispute not found.' });
    if (!dispute.active) return res.status(409).json({ message: 'This dispute is already resolved.' });
    const staffRole = resolveStaffRole(req.user);
    if (staffRole === 'support_staff' && assignedSupportUserId !== id(req)) {
      return res.status(403).json({ message: 'Support Staff may assign an unassigned dispute only to themselves.' });
    }
    if (dispute.assignedSupportUserId && String(dispute.assignedSupportUserId) !== id(req) && !['admin_team', 'superadmin'].includes(staffRole)) {
      return res.status(403).json({ message: 'Only Admin Team may reassign another investigator’s dispute.' });
    }
    const previousStatus = dispute.investigationStatus;
    dispute.assignedSupportUserId = assignedSupportUserId;
    dispute.investigationStatus = 'UNDER_INVESTIGATION';
    dispute.status = 'investigating';
    dispute.auditLogs.push({ userId: id(req), role: 'support', action: 'SUPPORT_ASSIGNED', previousStatus, newStatus: 'UNDER_INVESTIGATION', details: { assignedSupportUserId } });
    await dispute.save();
    if (dispute.supportTicket) await SupportTicket.updateOne({ _id: dispute.supportTicket }, { $set: { assignedTo: assignedSupportUserId, status: 'in_progress' } });
    return res.status(200).json({ message: 'Support investigator assigned.', dispute: shapeFinancialDispute(dispute, { staff: true }) });
  } catch (error) {
    console.error('Assign financial dispute support error:', error);
    return res.status(500).json({ message: 'Failed to assign the investigation.' });
  }
}

export async function requestFinancialDisputeEvidence(req, res) {
  try {
    const target = String(req.body?.target || '').toLowerCase();
    const message = String(req.body?.message || '').trim();
    if (!['worker', 'employer'].includes(target) || !message) return res.status(400).json({ message: 'Evidence target and request message are required.' });
    const dispute = await FinancialDispute.findById(req.params.disputeId);
    if (!dispute) return res.status(404).json({ message: 'Financial dispute not found.' });
    if (!dispute.assignedSupportUserId) return res.status(409).json({ message: 'Assign this dispute to a Support investigator first.' });
    if (String(dispute.assignedSupportUserId) !== id(req) && !['admin_team', 'superadmin'].includes(resolveStaffRole(req.user))) {
      return res.status(403).json({ message: 'Only the assigned Support investigator can request evidence.' });
    }
    if (!dispute.active || ['FOR_FINANCE_REVIEW', 'PENDING_FINANCE_APPROVAL', 'PROCESSING_SETTLEMENT'].includes(dispute.investigationStatus)) {
      return res.status(409).json({ message: 'Evidence cannot be requested at this stage.' });
    }
    const previousStatus = dispute.investigationStatus;
    dispute.investigationStatus = target === 'worker' ? 'AWAITING_WORKER_EVIDENCE' : 'AWAITING_EMPLOYER_EVIDENCE';
    dispute.messages.push({ author: id(req), authorRole: 'support', body: message, visibleToParties: true });
    dispute.auditLogs.push({ userId: id(req), role: 'support', action: 'EVIDENCE_REQUESTED', previousStatus, newStatus: dispute.investigationStatus, details: { target } });
    await dispute.save();
    const recipient = target === 'worker' ? dispute.worker : dispute.employer;
    await notificationFor(recipient, target, dispute, 'Evidence requested for financial dispute', `${dispute.ticketId}: ${message}`, id(req));
    return res.status(200).json({ message: 'Evidence request sent.', dispute: shapeFinancialDispute(dispute, { staff: true }) });
  } catch (error) {
    console.error('Request financial dispute evidence error:', error);
    return res.status(500).json({ message: 'Failed to request evidence.' });
  }
}

export async function completeFinancialDisputeInvestigation(req, res) {
  try {
    const fields = ['workCompletionFindings', 'paymentFindings', 'timelineSummary', 'supportNotes', 'recommendedFacts'];
    const report = Object.fromEntries(fields.map((field) => [field, String(req.body?.[field] || '').trim()]));
    if (fields.some((field) => !report[field])) return res.status(400).json({ message: 'Complete every investigation report section before forwarding to Finance.' });
    const dispute = await FinancialDispute.findById(req.params.disputeId).populate('job', 'description');
    if (!dispute) return res.status(404).json({ message: 'Financial dispute not found.' });
    if (!dispute.assignedSupportUserId) return res.status(409).json({ message: 'Assign this dispute to a Support investigator first.' });
    if (String(dispute.assignedSupportUserId) !== id(req) && !['admin_team', 'superadmin'].includes(resolveStaffRole(req.user))) {
      return res.status(403).json({ message: 'Only the assigned Support investigator can complete this report.' });
    }
    if (!dispute.active || ['FOR_FINANCE_REVIEW', 'PENDING_FINANCE_APPROVAL', 'PROCESSING_SETTLEMENT'].includes(dispute.investigationStatus)) {
      return res.status(409).json({ message: 'This investigation can no longer be edited.' });
    }
    const previousStatus = dispute.investigationStatus;
    dispute.investigationReport = {
      status: 'COMPLETED',
      jobDescription: String(req.body?.jobDescription || dispute.job?.description || '').trim(),
      ...report,
      completedAt: new Date(),
      supportAgent: id(req),
    };
    dispute.investigationStatus = 'FOR_FINANCE_REVIEW';
    dispute.auditLogs.push({ userId: id(req), role: 'support', action: 'INVESTIGATION_COMPLETED', previousStatus, newStatus: 'FOR_FINANCE_REVIEW' });
    dispute.auditLogs.push({ userId: id(req), role: 'support', action: 'SENT_TO_FINANCE', previousStatus, newStatus: 'FOR_FINANCE_REVIEW' });
    await dispute.save();

    const financeUsers = await User.find({ role: { $in: ['admin', 'superadmin'] }, status: 'active' }).select('_id role staffRole').lean();
    await Promise.allSettled(financeUsers
      .filter((user) => hasPermission(resolveStaffRole(user), 'finance.disputes.review'))
      .map((user) => createNotification({ userId: user._id, audience: 'shared', type: 'support', title: 'Financial dispute ready for Finance review', message: `${dispute.ticketId} has a completed investigation report.`, link: '/admin/disputes', entityType: 'financial_dispute', entityId: dispute._id, actor: id(req), push: true })));
    return res.status(200).json({ message: 'Investigation report completed and forwarded to Finance.', dispute: shapeFinancialDispute(dispute, { staff: true }) });
  } catch (error) {
    console.error('Complete financial dispute investigation error:', error);
    return res.status(500).json({ message: 'Failed to complete the investigation report.' });
  }
}

export async function proposeFinancialDisputeSettlement(req, res) {
  try {
    const dispute = await proposeDisputeSettlement({
      disputeId: req.params.disputeId,
      financeUserId: id(req),
      settlementType: req.body?.settlementType,
      workerAmount: req.body?.workerAmount,
      employerRefund: req.body?.employerRefund,
      decisionReason: req.body?.decisionReason,
    });
    return res.status(200).json({ message: 'Settlement proposed and sent for independent Finance approval.', dispute: shapeFinancialDispute(dispute, { staff: true }) });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Failed to propose the settlement.' });
  }
}

export async function approveFinancialDisputeSettlement(req, res) {
  try {
    const result = await approveAndProcessDisputeSettlement({ disputeId: req.params.disputeId, approverId: id(req) });
    return res.status(200).json({ message: result.deduplicated ? 'Settlement was already processed.' : 'Settlement approved, processed, and verified.', dispute: shapeFinancialDispute(result.dispute, { staff: true }) });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Failed to approve the settlement.' });
  }
}

/** Backward-compatible endpoint. Direct settlement is intentionally disabled. */
export async function updateAdminFinancialDispute(req, res) {
  if (String(req.body?.status || '').toLowerCase() === 'investigating') return assignFinancialDisputeSupport(req, res);
  return res.status(409).json({ message: 'Use the investigation report, Finance proposal, and independent approval workflow to resolve this dispute.' });
}

export async function getDisputeContext(req, res) {
  const dispute = await FinancialDispute.findById(req.params.disputeId).lean();
  if (!dispute) return res.status(404).json({ message: 'Dispute not found.' });
  const [job, application, offers, transactions, messages] = await Promise.all([
    dispute.job ? Job.findById(dispute.job).select('title requirements salary status cancellationReason').lean() : null,
    dispute.application ? JobApplication.findById(dispute.application).lean() : null,
    dispute.application ? JobOffer.find({ application: dispute.application }).lean() : [],
    dispute.job ? Transaction.find({ jobReference: dispute.job }).select('amount type status reference relatedEntityType relatedEntityId createdAt').lean() : [],
    dispute.job && dispute.worker && dispute.employer ? Message.find({ job: dispute.job, $or: [{ sender: dispute.worker, receiver: dispute.employer }, { sender: dispute.employer, receiver: dispute.worker }] }).select('sender receiver content attachment createdAt').sort({ createdAt: 1 }).lean() : [],
  ]);
  return res.json({ dispute, job, application, offers, transactions, messages });
}
