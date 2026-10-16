import mongoose from 'mongoose';

const DestinationSnapshotSchema = new mongoose.Schema(
  {
    bic: { type: String, trim: true, maxlength: 20 },
    rail: { type: String, enum: ['instapay', 'pesonet'] },
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
    sourceWallet: { type: String, enum: ['EMPLOYER', 'WORKER'], default() { return this.balanceTarget || 'WORKER'; } },
    processingMode: { type: String, enum: ['manual', 'automatic'], default: 'manual' },
    reviewReason: { type: String, default: null },
    policySnapshot: { minimum: Number, maximum: Number, reviewThreshold: Number, requiresReview: Boolean },
    fee: { type: Number, default: 0, min: 0 },
    totalDebit: Number,
    transferReference: String,
    providerTransferId: { type: String, index: true },
    providerBatchId: String,
    providerRailReference: String,
    providerFee: { type: Number, min: 0, default: 0 },
    dispatchStartedAt: Date,
    lastReconciledAt: Date,
    failureReason: String,
    events: [{ status: String, actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, note: String, at: { type: Date, default: Date.now } }],
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    // Existing records predate employer withdrawals, so they stay worker payouts.
    balanceTarget: {
      type: String,
      enum: ['EMPLOYER', 'WORKER'],
      default: 'WORKER',
      required: true,
      index: true,
    },
    destinationSnapshot: {
      type: DestinationSnapshotSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ['requested', 'approved', 'processing', 'failed', 'rejected', 'paid', 'cancelled'],
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
PayoutRequestSchema.index({ user: 1, balanceTarget: 1, createdAt: -1 });
PayoutRequestSchema.index({ status: 1, createdAt: -1 });
PayoutRequestSchema.index(
  { user: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  }
);

export default mongoose.model('PayoutRequest', PayoutRequestSchema);
