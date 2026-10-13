import mongoose from 'mongoose';
import User from '../models/User.js';
import PendingIdScan from '../models/PendingIdScan.js';
import GovernmentIdVerification from '../models/GovernmentIdVerification.js';

export async function getGovernmentIdVerifications(req, res) {
  try {
    const records = await GovernmentIdVerification.find()
      .select('user userName govIdName documentType date verified')
      .populate({ path: 'user', select: '_id role', match: { status: { $ne: 'deleted' } } })
      .sort({ date: -1 })
      .lean();
    return res.status(200).json(records.filter((record) => record.user));
  } catch {
    return res.status(500).json({ message: 'Failed to fetch government ID verifications.' });
  }
}

export async function revokeGovernmentIdVerification(req, res) {
  const { verificationId } = req.params;
  if (!mongoose.isObjectIdOrHexString(verificationId)) {
    return res.status(400).json({ message: 'Invalid verification ID.' });
  }
  try {
    const record = await mongoose.connection.transaction(async (session) => {
      const record = await GovernmentIdVerification.findById(verificationId).session(session);
      if (!record) throw Object.assign(new Error('Verification record not found.'), { status: 404 });
      const user = await User.findOneAndUpdate(
        { _id: record.user, status: { $ne: 'deleted' } },
        {
          $set: {
            'verification.identityVerified': false,
            'verification.identityDocument.status': 'pending',
            'verification.identityDocument.reviewedAt': new Date(),
            'verification.identityDocument.reviewedBy': req.user.id,
          },
          $unset: { 'verification.identityDocument.rejectionReason': 1 },
        },
        { session },
      );
      if (!user) throw Object.assign(new Error('User not found.'), { status: 404 });
      if (record.verified) {
        record.verified = false;
        record.revokedAt = new Date();
        record.revokedBy = req.user.id;
        await record.save({ session });
      }
      // Prevent an old, already accepted scan from restoring a revoked status.
      await PendingIdScan.deleteOne({ user: record.user }, { session });
      return record;
    });
    return res.status(200).json({ message: 'Government ID verification revoked.', verificationId: record._id, verified: false });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.status ? error.message : 'Failed to revoke government ID verification.' });
  }
}
