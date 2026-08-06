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

export default mongoose.models.StoredUpload || mongoose.model('StoredUpload', storedUploadSchema);