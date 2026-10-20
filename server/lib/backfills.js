import JobApplication from '../models/JobApplication.js';
import Transaction from '../models/Transaction.js';
import Session from '../models/Session.js';
import Job from '../models/Job.js';
import Category from '../models/Category.js';
import Notification from '../models/Notification.js';
import FinancialDispute from '../models/FinancialDispute.js';
import SupportTicket from '../models/SupportTicket.js';
import { LEGACY_APPLICATION_STATUS_MAP, APPLICATION_STATUSES } from './applicationStatus.js';
import { ensureDefaultJobCategories } from './jobCategories.js';
import { getDisputeMoneySnapshot } from '../services/financialDisputeMoney.js';

function inferBalanceTarget(tx) {
  if (tx.balanceTarget) return tx.balanceTarget;
  const type = String(tx.type || '').toUpperCase();
  const target = String(tx.meta?.target || '').toUpperCase();
  if (type === 'TOP_UP') {
    if (target === 'WORKER') return 'WORKER';
    if (target === 'BOTH') return 'SYSTEM';
    return 'EMPLOYER';
  }
  if (type === 'PAYOUT') return 'WORKER';
  if (type === 'REFUND') return 'EMPLOYER';
  if (type === 'ESCROW') return 'ESCROW';
  return 'SYSTEM';
}

function inferProvider(tx) {
  if (tx.provider) return tx.provider;
  const source = String(tx.meta?.source || '').trim();
  return source || null;
}

function inferProviderReference(tx) {
  if (tx.providerReference) return tx.providerReference;
  return tx.meta?.checkout_id || tx.meta?.payment_intent_id || tx.reference || null;
}

function inferRelatedEntityType(tx) {
  if (tx.relatedEntityType) return tx.relatedEntityType;
  if (tx.payoutRequest) return 'payout_request';
  if (tx.jobReference) return 'job';
  return null;
}

function inferRelatedEntityId(tx) {
  if (tx.relatedEntityId) return tx.relatedEntityId;
  if (tx.payoutRequest) return String(tx.payoutRequest);
  if (tx.jobReference) return String(tx.jobReference);
  return null;
}

function inferStatus(tx) {
  if (tx.status) return tx.status;
  return 'COMPLETED';
}

function initialTimelineEntry(status, createdAt) {
  return {
    type: 'status_changed',
    status,
    note: `Application is ${status}.`,
    createdAt: createdAt || new Date(),
    meta: { source: 'backfill' },
  };
}

async function migrateLegacyFinancialDisputes() {
  const legacyDisputes = await FinancialDispute.collection.find({
    application: { $type: 'objectId' },
    $or: [
      { ticketId: { $exists: false } },
      { job: { $exists: false } },
      { worker: { $exists: false } },
      { employer: { $exists: false } },
      { investigationStatus: { $exists: false } },
    ],
  }).toArray();

  for (const dispute of legacyDisputes) {
    const application = await JobApplication.findById(dispute.application).lean();
    if (!application) continue;
    const job = await Job.findById(application.job).lean();
    if (!job?.jobPoster || !application.applicant) continue;
    const money = await getDisputeMoneySnapshot({ application, job });
    const disputedAmount = Math.max(0, Number(dispute.amount || money.remainingAgreedAmount || money.agreedAmount || 0));
    const fundsHeldAmount = Math.min(disputedAmount, money.fundsHeldAmount);
    const outstandingAmount = Math.max(0, Number((disputedAmount - fundsHeldAmount).toFixed(2)));
    const active = !['resolved', 'rejected'].includes(String(dispute.status || '').toLowerCase());
    const ticketId = dispute.ticketId || `FIN-LEGACY-${String(dispute._id).slice(-12).toUpperCase()}`;
    const raisedBy = dispute.raisedBy || application.applicant;
    const paymentStatus = active
      ? money.alreadyPaidAmount > 0 ? 'PARTIALLY_PAID' : fundsHeldAmount > 0 ? 'FUNDS_HELD' : 'OUTSTANDING_PAYMENT'
      : Number(dispute.workerPayoutAmount || 0) > 0 ? 'PAID' : Number(dispute.employerRefundAmount || 0) > 0 ? 'REFUNDED' : 'SETTLED';
    let supportTicketId = dispute.supportTicket || null;
    if (!supportTicketId) {
      const supportTicket = await SupportTicket.create({
        requester: raisedBy,
        financialDispute: dispute._id,
        relatedUsers: [application.applicant, job.jobPoster],
        subject: `[${ticketId}] ${dispute.subject || 'Financial dispute'}`,
        category: 'financial_dispute',
        priority: 'high',
        status: active ? 'in_progress' : 'resolved',
        resolvedAt: active ? null : dispute.resolvedAt || dispute.updatedAt || new Date(),
        messages: dispute.reason ? [{ author: raisedBy, actorRole: 'user', body: String(dispute.reason).slice(0, 4000) }] : [],
      });
      supportTicketId = supportTicket._id;
    }
    const uploaderRole = String(raisedBy) === String(job.jobPoster) ? 'employer' : 'worker';
    await FinancialDispute.collection.updateOne(
      { _id: dispute._id },
      {
        $set: {
          ticketId,
          raisedBy,
          job: job._id,
          worker: application.applicant,
          employer: job.jobPoster,
          supportTicket: supportTicketId,
          agreedJobAmount: money.agreedAmount,
          alreadyPaidAmount: money.alreadyPaidAmount,
          disputedAmount,
          fundsHeldAmount,
          outstandingAmount,
          fundStatus: fundsHeldAmount === 0 ? 'OUTSTANDING_PAYMENT' : outstandingAmount > 0 ? 'PARTIALLY_HELD' : 'FUNDS_HELD',
          workerClaim: String(dispute.reason || 'Legacy payment dispute'),
          investigationStatus: active ? 'UNDER_INVESTIGATION' : 'RESOLVED',
          active,
          settlementStatus: active ? 'NONE' : 'VERIFIED',
          paymentStatus,
          messages: Array.isArray(dispute.messages) && dispute.messages.length > 0
            ? dispute.messages
            : [{ author: raisedBy, authorRole: uploaderRole, body: String(dispute.reason || 'Legacy payment dispute'), visibleToParties: true, createdAt: dispute.raisedAt || new Date() }],
          auditLogs: Array.isArray(dispute.auditLogs) && dispute.auditLogs.length > 0
            ? dispute.auditLogs
            : [{ userId: null, role: 'system', action: 'LEGACY_DISPUTE_MIGRATED', previousStatus: dispute.status || null, newStatus: active ? 'UNDER_INVESTIGATION' : 'RESOLVED', details: {}, timestamp: new Date() }],
        },
      },
    );
  }

  const indexes = await FinancialDispute.collection.indexes().catch(() => []);
  const obsoleteIndex = indexes.find((index) => index.unique && index.key?.application === 1 && !index.partialFilterExpression?.active);
  if (obsoleteIndex) await FinancialDispute.collection.dropIndex(obsoleteIndex.name);
  await FinancialDispute.collection.createIndex(
    { application: 1 },
    { name: 'active_financial_dispute_application', unique: true, partialFilterExpression: { application: { $type: 'objectId' }, active: true } },
  );
}

export async function runDataBackfills() {
  await ensureDefaultJobCategories(Category);
  const fallbackCategory = await Category.findOne({ name: 'Other Skilled Jobs' }).select('_id').lean();
  if (fallbackCategory) {
    const validCategoryIds = await Category.distinct('_id');
    await Job.updateMany(
      { category: { $nin: validCategoryIds } },
      { $set: { category: fallbackCategory._id } }
    );
  }

  // Access tokens are bearer credentials and must not remain stored in plaintext.
  // Use the native collection because the legacy field is intentionally absent
  // from the current strict Mongoose schema.
  await Session.collection.updateMany({ token: { $exists: true } }, { $unset: { token: 1 } });

  // Legacy notifications predate role-specific feeds. Shared is the safe,
  // non-destructive fallback; relationship-backed records are refined below.
  await Notification.updateMany(
    { $or: [{ audience: { $exists: false } }, { audience: null }] },
    { $set: { audience: 'shared' } },
  );
  await Notification.updateMany(
    { audience: 'shared', entityType: 'payment_request' },
    { $set: { audience: 'employer' } },
  );
  const legacyApplicationNotifications = await Notification.find({
    audience: 'shared',
    entityType: 'application',
    entityId: { $nin: [null, ''] },
  }).select('_id user entityId').lean();
  for (const notification of legacyApplicationNotifications) {
    const application = await JobApplication.findById(notification.entityId).select('applicant job').lean();
    if (!application) continue;
    const job = await Job.findById(application.job).select('jobPoster').lean();
    const audience = String(application.applicant) === String(notification.user)
      ? 'worker'
      : String(job?.jobPoster || '') === String(notification.user) ? 'employer' : 'shared';
    if (audience !== 'shared') await Notification.updateOne({ _id: notification._id }, { $set: { audience } });
  }

  const legacyEntries = Object.entries(LEGACY_APPLICATION_STATUS_MAP);
  for (const [legacy, canonical] of legacyEntries) {
    await JobApplication.updateMany({ status: legacy }, { $set: { status: canonical } });
  }

  await JobApplication.updateMany(
    { status: { $nin: APPLICATION_STATUSES } },
    { $set: { status: 'Applied' } }
  );
  await Job.updateMany({ reservedOfferCount: { $exists: false } }, { $set: { reservedOfferCount: 0 } });

  const lifecycleMissing = await JobApplication.find({ status: 'Hired', $or: [{ agreedAmount: null }, { agreedAmount: { $exists: false } }] }).select('_id job').lean();
  for (const application of lifecycleMissing) {
    const job = await Job.findById(application.job).select('salary status').lean();
    if (!job) continue;
    const paid = await Transaction.findOne({ jobReference: job._id, receiver: { $exists: true }, type: 'PAYOUT', relatedEntityId: String(application._id), status: 'COMPLETED' }).lean();
    await JobApplication.updateOne({ _id: application._id }, { $set: { agreedAmount: Number(job.salary || 0), workStatus: paid || job.status === 'Completed' ? 'Completed' : 'In Progress', paymentStatus: paid ? 'Paid' : 'Secured', ...(paid ? { paidAt: paid.createdAt, completedAt: paid.createdAt } : {}) } });
  }

  // Whole-job QR invoices predate per-worker settlement. Keep settled records as
  // history and cancel active incompatible requests so workers can regenerate.
  const qrCollection = JobApplication.db.collection('qrsettlementrequests');
  await qrCollection.updateMany(
    { status: { $in: ['active', 'settling'] }, application: { $exists: false } },
    { $set: { status: 'cancelled', migrationReason: 'per_worker_settlement' } },
  );

  const applicationsWithoutTimeline = await JobApplication.find({
    $or: [{ timeline: { $exists: false } }, { timeline: { $size: 0 } }],
  })
    .select('_id status createdAt')
    .lean();

  for (const application of applicationsWithoutTimeline) {
    await JobApplication.updateOne(
      { _id: application._id },
      {
        $set: { timeline: [initialTimelineEntry(application.status || 'Applied', application.createdAt)] },
      }
    );
  }

  const txs = await Transaction.find({
    $or: [
      { status: { $exists: false } },
      { balanceTarget: { $exists: false } },
      { provider: { $exists: false } },
      { providerReference: { $exists: false } },
      { relatedEntityType: { $exists: false } },
      { relatedEntityId: { $exists: false } },
    ],
  }).lean();

  for (const tx of txs) {
    await Transaction.updateOne(
      { _id: tx._id },
      {
        $set: {
          status: inferStatus(tx),
          balanceTarget: inferBalanceTarget(tx),
          provider: inferProvider(tx),
          providerReference: inferProviderReference(tx),
          relatedEntityType: inferRelatedEntityType(tx),
          relatedEntityId: inferRelatedEntityId(tx),
        },
      }
    );
  }

  await migrateLegacyFinancialDisputes();
}
