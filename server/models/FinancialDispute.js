import mongoose from 'mongoose';

const FinancialDisputeSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    raisedBy: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ['open', 'investigating', 'resolved', 'rejected'],
      default: 'open',
      index: true,
    },
    resolutionNotes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model('FinancialDispute', FinancialDisputeSchema);
