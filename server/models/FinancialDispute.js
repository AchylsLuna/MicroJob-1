import mongoose from 'mongoose';

const FinancialDisputeSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: ['open', 'investigating', 'resolved', 'rejected'], default: 'open', index: true },
    resolutionNotes: { type: String, default: null, trim: true, maxlength: 2000 },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'raisedAt', updatedAt: true } },
);

FinancialDisputeSchema.index({ raisedAt: -1 });

export default mongoose.model('FinancialDispute', FinancialDisputeSchema);
