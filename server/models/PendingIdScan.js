import mongoose from 'mongoose';

const PendingIdScanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  decision: { type: String, required: true },
  profileMatch: { type: Boolean, required: true },
  accepted: { type: Boolean, required: true },
  selectedDocumentType: { type: String, required: true },
  extracted: { type: mongoose.Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false });

// TTL cleanup is eventually consistent, so callers also verify expiresAt.
PendingIdScanSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.PendingIdScan || mongoose.model('PendingIdScan', PendingIdScanSchema);
