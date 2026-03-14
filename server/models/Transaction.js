import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['TOP_UP', 'ESCROW', 'PAYOUT', 'REFUND'],
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'COMPLETED',
      index: true,
    },
    balanceTarget: {
      type: String,
      enum: ['EMPLOYER', 'WORKER', 'ESCROW', 'SYSTEM'],
      default: 'SYSTEM',
      index: true,
    },
    jobReference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      default: null,
    },
    payoutRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayoutRequest',
      default: null,
      index: true,
    },
    reference: {
      type: String,
      default: null,
      index: true,
    },
    provider: {
      type: String,
      default: null,
      trim: true,
    },
    providerReference: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    label: {
      type: String,
      default: null,
    },
    relatedEntityType: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    relatedEntityId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    linkedTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ sender: 1, createdAt: -1 });
TransactionSchema.index({ receiver: 1, createdAt: -1 });

export default mongoose.model('Transaction', TransactionSchema);
