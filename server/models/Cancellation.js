import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'JobApplication', default: null, index: true },
  offer: { type: mongoose.Schema.Types.ObjectId, ref: 'JobOffer', default: null },
  scope: { type: String, enum: ['job', 'assignment', 'offer'], required: true },
  legacy: { type: Boolean, default: false },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required() { return !this.legacy; }, default: null },
  reason: { type: String, required: true, maxlength: 2000 },
  status: { type: String, enum: ['pending', 'staff_review', 'resolved', 'rejected'], default: 'pending', index: true },
  workerPayment: { type: Number, default: 0, min: 0 },
  responseDueAt: Date,
  occurredAt: { type: Date, default: Date.now },
  resolvedAt: Date,
  policyVersion: String,
  events: [{ actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, type: { type: String }, note: String, amount: Number, at: { type: Date, default: Date.now } }],
}, { timestamps: true });
export default mongoose.model('Cancellation', schema);
