import mongoose from 'mongoose';

const PhoneVerificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pinCodeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

PhoneVerificationSchema.index({ user: 1 }, { unique: true });
// MongoDB's TTL monitor is eventual; verifyPhoneCode still rejects an expired
// record immediately, while this index removes stale OTP hashes automatically.
PhoneVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('PhoneVerification', PhoneVerificationSchema);
