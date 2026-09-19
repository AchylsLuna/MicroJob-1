import mongoose from 'mongoose';

const PhoneVerificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pinCodeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

PhoneVerificationSchema.index({ user: 1, expiresAt: -1 });

export default mongoose.model('PhoneVerification', PhoneVerificationSchema);
