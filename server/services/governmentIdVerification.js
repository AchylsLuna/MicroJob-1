import User from '../models/User.js';
import GovernmentIdVerification from '../models/GovernmentIdVerification.js';
import { buildVerificationPayload } from '../models/IdAnalyzerModel.js';

// Called inside the same transaction as pending-scan consumption.
export async function persistIdVerification(userId, scan, session) {
  const user = await User.findById(userId).select('firstName lastName status').session(session);
  if (!user || user.status === 'deleted') {
    throw Object.assign(new Error('User not found.'), { status: 404 });
  }
  const payload = buildVerificationPayload(scan);
  const date = payload.update['verification.identityDocument.reviewedAt'];
  if (scan.accepted) {
    const govIdName = scan.extracted?.fullName?.trim()
      || [scan.extracted?.firstName, scan.extracted?.lastName].filter(Boolean).join(' ').trim();
    await GovernmentIdVerification.findOneAndUpdate(
      { user: userId },
      {
        $set: {
          userName: `${user.firstName} ${user.lastName}`.trim(),
          govIdName,
          documentType: scan.selectedDocumentType,
          date,
          verified: true,
        },
        $unset: { revokedAt: 1, revokedBy: 1 },
      },
      { session, upsert: true, runValidators: true },
    );
  } else {
    // A failed later attempt must not leave a previous record marked verified.
    await GovernmentIdVerification.updateOne({ user: userId }, { $set: { verified: false } }, { session });
  }
  const update = { $set: { ...payload.update } };
  if (scan.accepted) {
    delete update.$set['verification.identityDocument.rejectionReason'];
    update.$unset = { 'verification.identityDocument.rejectionReason': 1 };
  }
  await User.findByIdAndUpdate(userId, update, { session });
  return payload;
}
