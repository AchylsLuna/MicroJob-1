import mongoose from 'mongoose';
import FinancialDispute from '../models/FinancialDispute.js';
import User from '../models/User.js';
import { HOUR, httpError } from '../lib/lifecyclePolicy.js';
import { queueNotification } from './notificationOutbox.js';

export function disputeReviewPeriodMs() {
  const hours = Number(process.env.FINANCIAL_DISPUTE_REVIEW_HOURS || 168);
  if (!Number.isFinite(hours) || hours <= 0) throw httpError(503, 'The financial dispute review period is incorrectly configured.');
  return hours * HOUR;
}

// Escalation routes a case to senior reviewers; it never decides who receives funds.
export async function escalateOverdueDisputes({ now = new Date(), deadline = Date.now() + 40000 } = {}) {
  const period = disputeReviewPeriodMs();
  const due = await FinancialDispute.find({ active: true, status: { $in: ['open', 'investigating'] }, escalatedAt: null,
    raisedAt: { $lte: new Date(now.getTime() - period) },
    $or: [{ evidenceDueAt: null }, { evidenceDueAt: { $lte: now } }],
  }).select('_id').sort({ raisedAt: 1 }).limit(50);
  let escalated = 0;
  for (const item of due) {
    if (Date.now() > deadline) break;
    const session = await mongoose.startSession();
    try {
      let changed = false;
      await session.withTransaction(async () => {
        changed = false;
        const dispute = await FinancialDispute.findOneAndUpdate({ _id: item._id, active: true, status: { $in: ['open', 'investigating'] }, escalatedAt: null,
          raisedAt: { $lte: new Date(now.getTime() - period) }, $or: [{ evidenceDueAt: null }, { evidenceDueAt: { $lte: now } }],
        }, { $set: { escalatedAt: now }, $push: {
          events: { type: 'review_escalated', note: 'The configured review period elapsed. Senior review is required; held funds remain reserved.', at: now },
          auditLogs: { role: 'system', action: 'REVIEW_ESCALATED', timestamp: now, details: { reviewPeriodHours: period / HOUR } },
        } }, { session, returnDocument: 'after' });
        if (!dispute) return;
        // Preserve settlement/appeal stages so escalation cannot bypass approval.
        if (!['FOR_FINANCE_REVIEW', 'PENDING_FINANCE_APPROVAL', 'PROCESSING_SETTLEMENT', 'SETTLEMENT_PROPOSED', 'UNDER_APPEAL', 'RESOLUTION_ISSUED'].includes(dispute.investigationStatus)) {
          dispute.investigationStatus = 'ESCALATED';
          await dispute.save({ session });
        }
        const reviewers = await User.find({ status: 'active', $or: [{ role: 'superadmin' }, { role: 'admin', staffRole: 'admin_team' }] }).select('_id').session(session);
        const recipients = [...reviewers.map((user) => [user._id, 'shared']), [dispute.worker, 'worker'], [dispute.employer, 'employer']];
        for (const [userId, audience] of recipients) await queueNotification(`dispute-escalated:${dispute._id}:${userId}`, {
          userId: String(userId), audience, type: 'payment', title: 'Financial dispute escalated',
          message: `${dispute.ticketId} exceeded its review period and requires senior review. No payment or refund has been made by this escalation.`,
          entityType: 'financial_dispute', entityId: String(dispute._id),
        }, session);
        changed = true;
      });
      if (changed) escalated += 1;
    } finally { await session.endSession(); }
  }
  return escalated;
}
