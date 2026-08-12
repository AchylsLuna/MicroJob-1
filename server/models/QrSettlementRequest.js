import mongoose from 'mongoose';

const QrSettlementRequestSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'JobApplication', required: true },
  requestingWorker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  employer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  salarySnapshot: { type: Number, required: true, min: 0 },
  hiredWorkerSnapshot: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  tokenHash: { type: String, required: true, unique: true, index: true },
  shortCodeHash: { type: String, required: true, unique: true, index: true },
  shortCodeCipher: { type: String, default: null, select: false },
  qrImageName: { type: String, default: null },
  chatMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  employerNotification: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification', default: null },
  status: { type: String, enum: ['active', 'settling', 'settled', 'cancelled', 'expired'], default: 'active', index: true },
  expiresAt: { type: Date, required: true, index: true },
  purgeAt: { type: Date, required: true },
  settlementTransactions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }],
  settledAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

QrSettlementRequestSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
QrSettlementRequestSchema.index({ job: 1, status: 1 });
QrSettlementRequestSchema.index(
  { job: 1, requestingWorker: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);

export default mongoose.model('QrSettlementRequest', QrSettlementRequestSchema);
