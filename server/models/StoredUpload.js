import mongoose from 'mongoose';

const storedUploadSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true, unique: true, index: true },
    contentType: { type: String, default: 'application/octet-stream' },
    data: { type: Buffer, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

storedUploadSchema.index({ 'metadata.purgeAt': 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.StoredUpload || mongoose.model('StoredUpload', storedUploadSchema);
