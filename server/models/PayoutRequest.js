import mongoose from 'mongoose';

const DestinationSnapshotSchema = new mongoose.Schema(
  {
    methodType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    institutionName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    accountName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
    },
    accountNumberMasked: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { _id: false, versionKey: false }
);

const PayoutRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    destinationSnapshot: {
      type: DestinationSnapshotSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ['requested', 'approved', 'rejected', 'paid', 'cancelled'],
      default: 'requested',
      index: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNotes: {
      type: String,
      trim: true,
      default: null,
      maxlength: 2000,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      default: null,
      maxlength: 120,
    },
  },
  { timestamps: true, versionKey: false }
);

PayoutRequestSchema.index({ user: 1, createdAt: -1 });
PayoutRequestSchema.index({ status: 1, createdAt: -1 });
PayoutRequestSchema.index(
  { user: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  }
);

export default mongoose.model('PayoutRequest', PayoutRequestSchema);
