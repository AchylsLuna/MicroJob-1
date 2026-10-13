import mongoose from 'mongoose';

const ModerationReportSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ['user', 'job'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetName: { type: String, required: true, trim: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, required: true, trim: true, maxlength: 2000 },
    source: { type: String, enum: ['manual', 'message'], default: 'manual' },
    category: { type: String, enum: ['abuse', 'scam', 'threats', 'other'] },
    conversationJob: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
    // Keep a server-generated snapshot: editing or deleting the chat must not
    // remove the evidence submitted for moderation.
    evidence: [{
      _id: false,
      messageId: { type: mongoose.Schema.Types.ObjectId, required: true },
      author: { type: String, enum: ['reporter', 'reportedUser'], required: true },
      content: { type: String, required: true },
      createdAt: { type: Date, required: true },
    }],
    status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending', index: true },
    resolution: { type: String, default: null, trim: true, maxlength: 2000 },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'reportedAt', updatedAt: true } },
);

ModerationReportSchema.index({ reportedAt: -1 });
ModerationReportSchema.index(
  { reportedBy: 1, targetId: 1, conversationJob: 1 },
  { unique: true, partialFilterExpression: { source: 'message', status: 'pending' } },
);

export default mongoose.model('ModerationReport', ModerationReportSchema);
