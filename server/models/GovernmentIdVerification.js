import mongoose from 'mongoose';

// One current verification record per user, retained when verification is revoked.
const GovernmentIdVerificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  userName: { type: String, required: true, trim: true },
  govIdName: { type: String, required: true, trim: true },
  documentType: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  verified: { type: Boolean, required: true, default: true },
  revokedAt: { type: Date },
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, versionKey: false });

GovernmentIdVerificationSchema.index({ date: -1 });

export default mongoose.models.GovernmentIdVerification
  || mongoose.model('GovernmentIdVerification', GovernmentIdVerificationSchema);
