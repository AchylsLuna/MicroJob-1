import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['application', 'payment', 'message', 'alert', 'achievement', 'system', 'payout', 'support', 'interview', 'account'],
      default: 'system',
      index: true,
    },
    audience: {
      type: String,
      enum: ['worker', 'employer', 'shared'],
      default: 'shared',
      index: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    link: { type: String, default: '' },
    entityType: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    entityId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    readAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, audience: 1, readAt: 1, _id: -1 });

export default mongoose.model('Notification', NotificationSchema);
