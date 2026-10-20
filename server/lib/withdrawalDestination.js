import crypto from 'node:crypto';
import PayoutRequest from '../models/PayoutRequest.js';

// Bind a Finance check to the owner and exact destination, never just a name.
export function destinationFingerprint(userId, destination) {
  return crypto.createHash('sha256').update(JSON.stringify([
    String(userId), ...['methodType', 'institutionName', 'accountName', 'accountNumber', 'bic'].map((key) => String(destination[key] || '').trim()),
  ])).digest('hex');
}

export async function verifiedDestination(userId, destination, session) {
  return PayoutRequest.findOne({ user: userId, status: { $in: ['approved', 'paid'] },
    'ownershipVerification.fingerprint': destinationFingerprint(userId, destination),
    'ownershipVerification.verifiedAt': { $gt: new Date(Date.now() - 90 * 86400000) },
    'ownershipVerification.reference': { $type: 'string', $ne: '' },
    'ownershipVerification.verifiedBy': { $ne: null },
  }).select('ownershipVerification').session(session || null);
}

export function destinationReview(policy, verified) {
  if (verified) return policy;
  return { ...policy, requiresReview: true, processingMode: 'manual', reviewCodes: [...(policy.reviewCodes || []), 'ownership'], reviewReason: [policy.reviewReason,
    'Finance must verify ownership of this destination against account-holder evidence before approving an external transfer.',
  ].filter(Boolean).join(' ') };
}
