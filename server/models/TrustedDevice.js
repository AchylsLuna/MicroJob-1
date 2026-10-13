import mongoose from 'mongoose';

const TrustedDeviceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, index: true },
  label: { type: String, default: '' },
  ip: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  // Sign-out ends automatic session restoration but keeps the OTP exemption
  // for a subsequent login that verifies the password.
  requiresPassword: { type: Boolean, default: false },
});

// TTL index to remove expired trusted devices automatically after `expiresAt`.
TrustedDeviceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('TrustedDevice', TrustedDeviceSchema);
