import JobApplication from '../models/JobApplication.js';
import Transaction from '../models/Transaction.js';
import Session from '../models/Session.js';
import Job from '../models/Job.js';
import Category from '../models/Category.js';
import { LEGACY_APPLICATION_STATUS_MAP, APPLICATION_STATUSES } from './applicationStatus.js';
import { ensureDefaultJobCategories } from './jobCategories.js';

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

  const legacyEntries = Object.entries(LEGACY_APPLICATION_STATUS_MAP);
  for (const [legacy, canonical] of legacyEntries) {
    await JobApplication.updateMany({ status: legacy }, { $set: { status: canonical } });
  }

  await JobApplication.updateMany(
    { status: { $nin: APPLICATION_STATUSES } },
    { $set: { status: 'Applied' } }
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
}
