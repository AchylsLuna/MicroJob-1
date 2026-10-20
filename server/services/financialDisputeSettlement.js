import crypto from 'crypto';
import Cancellation from '../models/Cancellation.js';
import { resolveCancelledAssignment, syncCapacity } from './jobLifecycle.js';
import { refundJobFunds, jobSpendingSources } from './jobFunds.js';
import { queueNotification } from './notificationOutbox.js';
import mongoose from 'mongoose';
import FinancialDispute from '../models/FinancialDispute.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import SupportTicket from '../models/SupportTicket.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { createNotification } from '../lib/notificationService.js';
import { getDisputeMoneySnapshot, parseMoney, fromCents, toCents } from './financialDisputeMoney.js';

const settlementId = () => `SET-${new Date().getFullYear()}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

export function requireEvidenceOpportunity(dispute) {
  if (!dispute.evidenceDueAt || new Date(dispute.evidenceDueAt) <= new Date()) return;
  const contributors = new Set((dispute.evidence || []).map((entry) => String(entry.actor || entry.uploadedBy)));
  if (![dispute.worker, dispute.employer].every((id) => contributors.has(String(id)))) {
    throw Object.assign(new Error('Allow both parties seven days to provide evidence or state that none is available.'), { status: 409 });
  }
}

export async function proposeDisputeSettlement({ disputeId, financeUserId, settlementType, workerAmount, employerRefund, decisionReason }) {
  const reason = String(decisionReason || '').trim();
  if (!reason) throw Object.assign(new Error('A written decision reason is required.'), { status: 400 });
  const type = String(settlementType || '').toUpperCase();
  if (!['FULL_REFUND', 'COMPLETE_PAYMENT', 'PARTIAL_PAYMENT'].includes(type)) {
    throw Object.assign(new Error('Settlement must be FULL_REFUND, COMPLETE_PAYMENT, or PARTIAL_PAYMENT.'), { status: 400 });
  }

  const dispute = await FinancialDispute.findById(disputeId);
  if (!dispute) throw Object.assign(new Error('Financial dispute not found.'), { status: 404 });
  if (dispute.investigationReport?.status !== 'COMPLETED' || dispute.investigationStatus !== 'FOR_FINANCE_REVIEW') {
    throw Object.assign(new Error('Finance cannot issue a settlement before the investigation report is completed.'), { status: 409 });
  }
  requireEvidenceOpportunity(dispute);
  if (dispute.financeSettlement && !['FAILED'].includes(dispute.financeSettlement.settlementStatus)) {
    throw Object.assign(new Error('A settlement decision already exists for this dispute.'), { status: 409 });
  }
  const [application, job] = await Promise.all([
    JobApplication.findById(dispute.application),
    Job.findById(dispute.job),
  ]);
  if (!application || !job) throw Object.assign(new Error('Linked job payment records are unavailable.'), { status: 409 });
  const money = await getDisputeMoneySnapshot({ application, job });
  const availableCents = Math.min(toCents(money.fundsHeldAmount), toCents(dispute.disputedAmount));
  const remainingPayableCents = Math.max(0, toCents(money.agreedAmount) - toCents(money.alreadyPaidAmount));
  let workerCents = 0;
  let refundCents = 0;

  if (type === 'FULL_REFUND') refundCents = availableCents;
  if (type === 'COMPLETE_PAYMENT') workerCents = Math.min(remainingPayableCents, availableCents);
  if (type === 'PARTIAL_PAYMENT') {
    workerCents = parseMoney(workerAmount, 'Worker amount');
    refundCents = parseMoney(employerRefund, 'Employer refund');
    if (workerCents + refundCents > availableCents) {
      throw Object.assign(new Error('Worker amount plus employer refund cannot exceed the available held dispute funds.'), { status: 400 });
    }
    if (workerCents + refundCents < availableCents) {
      throw Object.assign(new Error('Allocate all available held dispute funds before submitting a partial settlement.'), { status: 400 });
    }
  }
  if (workerCents > remainingPayableCents) {
    throw Object.assign(new Error('Worker settlement would double-pay amounts already received.'), { status: 400 });
  }
  const outstandingCents = type === 'FULL_REFUND'
    ? 0
    : Math.max(0, toCents(dispute.disputedAmount) - workerCents - refundCents);
  const previousStatus = dispute.investigationStatus;
  dispute.assignedFinanceUserId = financeUserId;
  dispute.financeSettlement = {
    settlementId: settlementId(),
    financeUserId,
    settlementType: type,
    agreedAmount: money.agreedAmount,
    alreadyPaidAmount: money.alreadyPaidAmount,
    workerSettlementAmount: fromCents(workerCents),
    employerRefundAmount: fromCents(refundCents),
    outstandingAmount: fromCents(outstandingCents),
    decisionReason: reason,
    settlementStatus: 'PROPOSED',
  };
  dispute.investigationStatus = 'PENDING_FINANCE_APPROVAL';
  dispute.settlementStatus = 'PENDING_APPROVAL';
  dispute.auditLogs.push({
    userId: financeUserId,
    role: 'finance',
    action: 'SETTLEMENT_SELECTED',
    previousStatus,
    newStatus: 'PENDING_FINANCE_APPROVAL',
    details: { settlementType: type, workerAmount: fromCents(workerCents), employerRefund: fromCents(refundCents), outstandingAmount: fromCents(outstandingCents) },
  });
  await dispute.save();
  return dispute;
}

export async function approveAndProcessDisputeSettlement({ disputeId, approverId }) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const dispute = await FinancialDispute.findById(disputeId).session(session);
      if (!dispute) throw Object.assign(new Error('Financial dispute not found.'), { status: 404 });
      const settlement = dispute.financeSettlement;
      if (!settlement) throw Object.assign(new Error('No Finance settlement is awaiting approval.'), { status: 409 });
      if (['VERIFIED', 'RECORDED_OUTSTANDING'].includes(settlement.settlementStatus)) {
        result = { dispute, deduplicated: true };
        return;
      }
      if (settlement.settlementStatus !== 'PROPOSED' || dispute.investigationStatus !== 'PENDING_FINANCE_APPROVAL') {
        throw Object.assign(new Error('This settlement is not awaiting approval.'), { status: 409 });
      }
      if (String(settlement.financeUserId) === String(approverId)) {
        throw Object.assign(new Error('A different authorized finance user must approve this settlement.'), { status: 403 });
      }
      requireEvidenceOpportunity(dispute);
      const application = await JobApplication.findById(dispute.application).session(session);
      const job = await Job.findById(dispute.job).session(session);
      if (!application || !job) throw Object.assign(new Error('Linked job payment records are unavailable.'), { status: 409 });
      job.fundsVersion = Number(job.fundsVersion || 0) + 1;
      await job.save({ session });
      const money = await getDisputeMoneySnapshot({ application, job, session });
      if (toCents(money.alreadyPaidAmount) !== toCents(settlement.alreadyPaidAmount)) {
        throw Object.assign(new Error('Payment records changed after the proposal. Finance must create a new settlement.'), { status: 409 });
      }
      const workerCents = toCents(settlement.workerSettlementAmount);
      const refundCents = toCents(settlement.employerRefundAmount);
      if (workerCents + refundCents > Math.min(toCents(money.fundsHeldAmount), toCents(dispute.disputedAmount))) {
        throw Object.assign(new Error('Available held funds are no longer sufficient for this settlement.'), { status: 409 });
      }

      const approvedAt = new Date();
      settlement.approvedBy = approverId;
      settlement.approvedAt = approvedAt;
      settlement.settlementStatus = 'PROCESSING';
      dispute.settlementStatus = 'PROCESSING';
      dispute.investigationStatus = 'PROCESSING_SETTLEMENT';
      dispute.paymentStatus = 'PROCESSING';
      dispute.auditLogs.push({ userId: approverId, role: 'finance', action: 'SETTLEMENT_APPROVED', previousStatus: 'PENDING_FINANCE_APPROVAL', newStatus: 'PROCESSING_SETTLEMENT' });

      const transactionIds = [];
      const lifecycleCase = Boolean(dispute.evidenceDueAt);
      const closedAssignment = lifecycleCase && (dispute.kind === 'cancellation' || (
        refundCents > 0 && workerCents + refundCents === toCents(money.remainingAgreedAmount)
      ));
      if (closedAssignment) {
        let cancellation = await Cancellation.findOne({ application: application._id, status: { $in: ['staff_review', 'pending'] } }).session(session);
        if (!cancellation) [cancellation] = await Cancellation.create([{
          job: job._id, application: application._id, scope: 'assignment', actor: approverId,
          reason: settlement.decisionReason, status: 'staff_review',
          events: [{ type: 'finance_decision', actor: approverId, note: settlement.decisionReason }],
        }], { session });
        await resolveCancelledAssignment({ application, job, cancellation, workerPayment: fromCents(workerCents), actor: approverId, session, retainBaseFunding: false });
        const entries = await Transaction.find({ jobReference: job._id, reference: { $in: [`cancellation-payment:${application._id}`, `assignment-cancellation-refund:${application._id}`] } }).session(session);
        transactionIds.push(...entries.map((entry) => entry._id));
      }
      if (workerCents > 0 && !closedAssignment) {
        const reference = `financial-dispute:${dispute._id}:${settlement.settlementId}:worker`;
        let transaction = await Transaction.findOne({ reference }).session(session);
        if (!transaction) {
          await User.updateOne({ _id: dispute.worker }, { $inc: { workerBalance: fromCents(workerCents) } }, { session });
          [transaction] = await Transaction.create([{
            sender: null,
            receiver: dispute.worker,
            amount: fromCents(workerCents),
            type: 'PAYOUT',
            status: 'COMPLETED',
            balanceTarget: 'WORKER',
            jobReference: dispute.job,
            reference,
            label: `Financial dispute settlement (${dispute.ticketId})`,
            relatedEntityType: 'financial_dispute',
            relatedEntityId: String(dispute._id),
            actor: approverId,
            meta: { applicationId: String(dispute.application), settlementId: settlement.settlementId, fundingSources: await jobSpendingSources(job, fromCents(workerCents), session) },
          }], { session });
        }
        transactionIds.push(transaction._id);
        dispute.auditLogs.push({
          userId: approverId,
          role: 'finance',
          action: 'PAYMENT_PROCESSED',
          previousStatus: 'PROCESSING_SETTLEMENT',
          newStatus: 'PROCESSING_SETTLEMENT',
          details: { transactionId: String(transaction._id), amount: fromCents(workerCents) },
        });
      }
      if (refundCents > 0 && !closedAssignment) {
        const transaction = await refundJobFunds({ job, amount: fromCents(refundCents),
          reference: `financial-dispute:${dispute._id}:${settlement.settlementId}:employer`,
          actor: approverId, application: application._id, session });
        transactionIds.push(transaction._id);
        dispute.auditLogs.push({ userId: approverId, role: 'finance', action: 'REFUND_PROCESSED',
          previousStatus: 'PROCESSING_SETTLEMENT', newStatus: 'PROCESSING_SETTLEMENT',
          details: { transactionId: String(transaction._id), amount: fromCents(refundCents) } });
      }

      const outstandingCents = toCents(settlement.outstandingAmount);
      settlement.paymentTransactionIds = transactionIds;
      settlement.processedAt = new Date();
      settlement.settlementStatus = outstandingCents > 0 ? 'RECORDED_OUTSTANDING' : 'VERIFIED';
      dispute.settlementStatus = outstandingCents > 0 ? 'RECORDED_OUTSTANDING' : 'VERIFIED';
      dispute.paymentStatus = outstandingCents > 0
        ? 'OUTSTANDING_PAYMENT'
        : settlement.settlementType === 'FULL_REFUND'
          ? 'REFUNDED'
          : settlement.settlementType === 'PARTIAL_PAYMENT' ? 'SETTLED' : 'PAID';
      dispute.investigationStatus = 'RESOLVED';
      dispute.status = 'resolved';
      dispute.active = false;
      dispute.resolutionNotes = settlement.decisionReason;
      dispute.workerPayoutAmount = settlement.workerSettlementAmount;
      dispute.employerRefundAmount = settlement.employerRefundAmount;
      dispute.resolvedBy = approverId;
      dispute.resolvedAt = settlement.processedAt;
      dispute.auditLogs.push({
        userId: approverId,
        role: 'finance',
        action: outstandingCents > 0 ? 'OUTSTANDING_OBLIGATION_RECORDED' : 'PAYMENT_VERIFIED',
        previousStatus: 'PROCESSING_SETTLEMENT',
        newStatus: 'RESOLVED',
        details: { transactionIds: transactionIds.map(String), outstandingAmount: settlement.outstandingAmount },
      });
      dispute.auditLogs.push({
        userId: approverId,
        role: 'finance',
        action: 'TICKET_RESOLVED',
        previousStatus: 'PROCESSING_SETTLEMENT',
        newStatus: 'RESOLVED',
        details: { supportTicketId: dispute.supportTicket ? String(dispute.supportTicket) : null },
      });

      const totalWorkerPaidCents = toCents(settlement.alreadyPaidAmount) + workerCents;
      application.disputePending = false;
      if (!closedAssignment && (!lifecycleCase || Number(dispute.disputedAmount) > 0)) {
        if (outstandingCents > 0) application.paymentStatus = 'Outstanding';
        else if (settlement.settlementType === 'FULL_REFUND') application.paymentStatus = 'Refunded';
        else if (totalWorkerPaidCents >= toCents(settlement.agreedAmount)) {
          application.paymentStatus = 'Paid'; application.workStatus = 'Completed';
          application.paymentReminderClaimedAt = null; application.paymentReminderClaimedStage = null;
          application.paidAt ||= settlement.processedAt; application.completedAt ||= settlement.processedAt;
        } else application.paymentStatus = 'Partially Paid';
        application.paidAmount = fromCents(totalWorkerPaidCents);
      }
      application.timeline.push({
        type: 'financial_dispute_resolved',
        note: settlement.decisionReason,
        actor: approverId,
        meta: {
          disputeId: String(dispute._id),
          settlementType: settlement.settlementType,
          workerSettlementAmount: settlement.workerSettlementAmount,
          employerRefundAmount: settlement.employerRefundAmount,
          outstandingAmount: settlement.outstandingAmount,
        },
        createdAt: settlement.processedAt,
      });
      await application.save({ session });
      const previousJobStatus = job.status;
      if (!lifecycleCase) job.status = {
        FULL_REFUND: 'Full refund', COMPLETE_PAYMENT: 'Completed', PARTIAL_PAYMENT: 'Resolved',
      }[settlement.settlementType];
      else if (!closedAssignment && application.paymentStatus === 'Paid') {
        const unfinished = await JobApplication.exists({ job: job._id, status: { $in: ['Hired', 'Accepted'] }, workStatus: { $nin: ['Completed', 'Cancelled'] } }).session(session);
        if (!unfinished && Number(job.hiredCount) >= Number(job.positionsNeeded)) job.status = 'Completed';
        else await syncCapacity(job, session);
      }
      await job.save({ session });
      dispute.auditLogs.push({
        userId: approverId,
        role: 'finance',
        action: 'JOB_STATUS_UPDATED',
        previousStatus: previousJobStatus,
        newStatus: job.status,
        details: { jobId: String(job._id), settlementType: settlement.settlementType },
      });
      if (dispute.supportTicket) {
        await SupportTicket.updateOne({ _id: dispute.supportTicket }, { $set: { status: 'resolved', resolvedAt: settlement.processedAt } }, { session });
      }
      for (const [recipient, audience] of [[dispute.worker, 'worker'], [dispute.employer, 'employer']]) {
        await queueNotification(`financial-resolution:${dispute._id}:${settlement.settlementId}:${recipient}`, {
          userId: String(recipient), audience, type: 'payment', title: 'Financial dispute resolved',
          message: `${dispute.ticketId}: ${settlement.decisionReason} Worker payment: PHP ${settlement.workerSettlementAmount}. Refund: PHP ${settlement.employerRefundAmount}.`,
          entityType: 'financial_dispute', entityId: String(dispute._id),
        }, session);
      }
      await dispute.save({ session });
      result = { dispute, application, job, deduplicated: false };
    });
  } finally {
    await session.endSession();
  }

  if (!result?.deduplicated) {
    const settlement = result.dispute.financeSettlement;
    const message = `${result.dispute.ticketId}: ${settlement.settlementType.replace(/_/g, ' ')}. Worker receives PHP ${Number(settlement.workerSettlementAmount).toFixed(2)}; employer receives/refunded PHP ${Number(settlement.employerRefundAmount).toFixed(2)}.${settlement.outstandingAmount > 0 ? ` PHP ${Number(settlement.outstandingAmount).toFixed(2)} is recorded as an outstanding external obligation.` : ''}`;
    const participantNotifications = (title, notificationMessage) => [
      createNotification({ userId: result.dispute.worker, audience: 'worker', type: 'payment', title, message: notificationMessage, link: '/worker/financial-disputes', entityType: 'financial_dispute', entityId: result.dispute._id, actor: approverId, push: true }),
      createNotification({ userId: result.dispute.employer, audience: 'employer', type: 'payment', title, message: notificationMessage, link: '/employer/financial-disputes', entityType: 'financial_dispute', entityId: result.dispute._id, actor: approverId, push: true }),
    ];
    const completedTitle = Number(settlement.employerRefundAmount) > 0 && Number(settlement.workerSettlementAmount) === 0
      ? 'Financial dispute refund completed'
      : 'Financial dispute payment completed';
    await Promise.allSettled([
      ...participantNotifications('Financial dispute decision issued', message),
      ...participantNotifications('Financial settlement processing started', `${result.dispute.ticketId}: the approved settlement entered payment processing.`),
      ...participantNotifications(completedTitle, message),
      ...participantNotifications('Financial dispute ticket resolved', `${result.dispute.ticketId} is resolved. The decision and payment record remain available in the dispute history.`),
    ]);
  }
  return result;
}
