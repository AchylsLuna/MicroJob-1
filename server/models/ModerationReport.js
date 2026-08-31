import mongoose from 'mongoose';

const ModerationReportSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ['user', 'job'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetName: { type: String, required: true, trim: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending', index: true },
    resolution: { type: String, default: null, trim: true, maxlength: 2000 },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'reportedAt', updatedAt: true } },
);

ModerationReportSchema.index({ reportedAt: -1 });

export default mongoose.model('ModerationReport', ModerationReportSchema);
