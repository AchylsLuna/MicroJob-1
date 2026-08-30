import mongoose from 'mongoose';

const ModerationReportSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ['user', 'job'],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    targetName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    reportedBy: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ['pending', 'resolved', 'dismissed'],
      default: 'pending',
      index: true,
    },
    resolution: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model('ModerationReport', ModerationReportSchema);
