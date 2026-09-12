import mongoose from 'mongoose';

const TrustedDeviceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, index: true },
  label: { type: String, default: '' },
  ip: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

// TTL index to remove expired trusted devices automatically after `expiresAt`.
TrustedDeviceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('TrustedDevice', TrustedDeviceSchema);
