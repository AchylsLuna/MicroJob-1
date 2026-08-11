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
      enum: ['application', 'payment', 'message', 'review', 'alert', 'achievement', 'system', 'payout', 'support', 'interview', 'account'],
      default: 'system',
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
    dedupeKey: {
      type: String,
      default: null,
      trim: true,
      maxlength: 240,
    },
  },
  { timestamps: true, versionKey: false }
);

NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index(
  { user: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } }
);

export default mongoose.model('Notification', NotificationSchema);
