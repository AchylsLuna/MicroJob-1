import mongoose from 'mongoose';

const OtpChallengeSchema = new mongoose.Schema({
  purpose: { type: String, required: true, enum: ['email-verification', 'password-reset', 'password-change', 'login'], index: true },
  subject: { type: String, required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  challengeId: { type: String, required: true, unique: true },
  codeHash: { type: String, required: true, select: false },
  attempts: { type: Number, default: 0, min: 0 },
  maxAttempts: { type: Number, default: 5, min: 1 },
  expiresAt: { type: Date, required: true },
  verifiedAt: { type: Date, default: null },
  consumedAt: { type: Date, default: null },
  invalidatedAt: { type: Date, default: null },
  active: { type: Boolean, default: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true, versionKey: false });

OtpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
OtpChallengeSchema.index({ purpose: 1, subject: 1, consumedAt: 1, invalidatedAt: 1, createdAt: -1 });
OtpChallengeSchema.index(
  { purpose: 1, subject: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);

export default mongoose.model('OtpChallenge', OtpChallengeSchema);
