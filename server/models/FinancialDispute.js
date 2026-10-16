import mongoose from 'mongoose';

export const INVESTIGATION_STATUSES = [
  'OPEN',
  'ASSIGNED_TO_SUPPORT',
  'UNDER_INVESTIGATION',
  'AWAITING_WORKER_EVIDENCE',
  'AWAITING_EMPLOYER_EVIDENCE',
  'EVIDENCE_UNDER_REVIEW',
  'FOR_FINANCE_REVIEW',
  'SETTLEMENT_PROPOSED',
  'PENDING_FINANCE_APPROVAL',
  'RESOLUTION_ISSUED',
  'UNDER_APPEAL',
  'PROCESSING_SETTLEMENT',
  'RESOLVED',
  'ESCALATED',
];

export const PAYMENT_STATUSES = [
  'UNPAID',
  'PARTIALLY_PAID',
  'FUNDS_HELD',
  'OUTSTANDING_PAYMENT',
  'PROCESSING',
  'PAID',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'SETTLED',
];

const EvidenceSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  statement: { type: String, maxlength: 4000 }, noEvidence: Boolean, at: { type: Date, default: Date.now },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required() { return !this.actor; } },
  uploaderRole: { type: String, enum: ['worker', 'employer', 'support', 'finance', 'admin'], required() { return !this.actor; } },
  evidenceType: {
    type: String,
    enum: ['IMAGE', 'PDF', 'PAYMENT_RECEIPT', 'SCREENSHOT', 'WORK_PHOTO', 'DOCUMENT', 'ATTENDANCE_RECORD', 'JOB_LOG', 'CHAT_REFERENCE', 'OTHER'],
    default: 'OTHER',
  },
  fileUrl: { type: String, default: null, trim: true },
  fileName: { type: String, default: null, trim: true },
  contentType: { type: String, default: null, trim: true },
  description: { type: String, default: '', trim: true, maxlength: 1000 },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: true, versionKey: false });

const TicketMessageSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorRole: { type: String, enum: ['worker', 'employer', 'support', 'finance', 'admin'], required: true },
  body: { type: String, required: true, trim: true, maxlength: 4000 },
  visibleToParties: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: true, versionKey: false });

const AuditEntrySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  role: { type: String, required: true, trim: true },
  action: { type: String, required: true, trim: true },
  previousStatus: { type: String, default: null },
  newStatus: { type: String, default: null },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now },
}, { _id: true, versionKey: false });

const InvestigationReportSchema = new mongoose.Schema({
  status: { type: String, enum: ['DRAFT', 'COMPLETED'], default: 'DRAFT' },
  jobDescription: { type: String, default: '', trim: true, maxlength: 4000 },
  workCompletionFindings: { type: String, default: '', trim: true, maxlength: 4000 },
  paymentFindings: { type: String, default: '', trim: true, maxlength: 4000 },
  timelineSummary: { type: String, default: '', trim: true, maxlength: 4000 },
  supportNotes: { type: String, default: '', trim: true, maxlength: 4000 },
  recommendedFacts: { type: String, default: '', trim: true, maxlength: 4000 },
  completedAt: { type: Date, default: null },
  supportAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { _id: false, versionKey: false });

const FinanceSettlementSchema = new mongoose.Schema({
  settlementId: { type: String, required: true },
  financeUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  settlementType: { type: String, enum: ['FULL_REFUND', 'COMPLETE_PAYMENT', 'PARTIAL_PAYMENT'], required: true },
  agreedAmount: { type: Number, required: true, min: 0 },
  alreadyPaidAmount: { type: Number, required: true, min: 0 },
  workerSettlementAmount: { type: Number, required: true, min: 0 },
  employerRefundAmount: { type: Number, required: true, min: 0 },
  outstandingAmount: { type: Number, required: true, min: 0 },
  decisionReason: { type: String, required: true, trim: true, maxlength: 4000 },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  settlementStatus: {
    type: String,
    enum: ['PROPOSED', 'APPROVED', 'PROCESSING', 'VERIFIED', 'RECORDED_OUTSTANDING', 'FAILED'],
    default: 'PROPOSED',
  },
  processedAt: { type: Date, default: null },
  paymentTransactionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }],
  createdAt: { type: Date, default: Date.now },
}, { _id: false, versionKey: false });

const FinancialDisputeSchema = new mongoose.Schema(
  {
    ticketId: { type: String, default() { return `FD-${this._id}`; }, unique: true, sparse: true, index: true },
    disputeType: { type: String, default: 'INCORRECT_OR_MISSING_PAYMENT', trim: true },
    kind: { type: String, enum: ['nonpayment', 'cancellation', 'other'], default: 'other' },
    evidenceDueAt: Date,
    escalatedAt: { type: Date, default: null },
    workerPayment: { type: Number, default: null },
    events: [{ actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, type: { type: String }, note: String, at: { type: Date, default: Date.now } }],
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'JobApplication', required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    supportTicket: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket', default: null },
    assignedSupportUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedFinanceUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    agreedJobAmount: { type: Number, required: true, min: 0, default() { return this.amount; } },
    alreadyPaidAmount: { type: Number, required: true, min: 0, default: 0 },
    disputedAmount: { type: Number, required: true, min: 0, default() { return this.amount; } },
    fundsHeldAmount: { type: Number, required: true, min: 0, default: 0 },
    outstandingAmount: { type: Number, required: true, min: 0, default: 0 },
    fundStatus: { type: String, enum: ['FUNDS_HELD', 'OUTSTANDING_PAYMENT', 'PARTIALLY_HELD'], required: true, default: 'FUNDS_HELD' },

    workerClaim: { type: String, required: true, trim: true, maxlength: 4000, default() { return this.reason; } },
    employerResponse: { type: String, default: '', trim: true, maxlength: 4000 },
    investigationStatus: { type: String, enum: INVESTIGATION_STATUSES, default: 'UNDER_INVESTIGATION', index: true },
    active: { type: Boolean, default: true, index: true },
    settlementStatus: { type: String, enum: ['NONE', 'PROPOSED', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'VERIFIED', 'RECORDED_OUTSTANDING'], default: 'NONE', index: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'FUNDS_HELD', index: true },
    evidence: { type: [EvidenceSchema], default: [] },
    messages: { type: [TicketMessageSchema], default: [] },
    investigationReport: { type: InvestigationReportSchema, default: () => ({}) },
    investigationReportHistory: { type: [InvestigationReportSchema], default: [] },
    financeSettlement: { type: FinanceSettlementSchema, default: null },
    settlementHistory: { type: [FinanceSettlementSchema], default: [] },
    auditLogs: { type: [AuditEntrySchema], default: [] },
    appealReason: { type: String, default: '', trim: true, maxlength: 2000 },
    appealSubmittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    appealSubmittedAt: { type: Date, default: null },

    // Legacy fields retained for old seed data and older clients.
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true, maxlength: 4000 },
    status: { type: String, enum: ['open', 'investigating', 'resolved', 'rejected'], default: 'investigating', index: true },
    resolutionNotes: { type: String, default: null, trim: true, maxlength: 4000 },
    workerPayoutAmount: { type: Number, default: null, min: 0 },
    employerRefundAmount: { type: Number, default: null, min: 0 },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'raisedAt', updatedAt: true } },
);

FinancialDisputeSchema.index({ raisedAt: -1 });
FinancialDisputeSchema.index(
  { application: 1 },
  { name: 'active_financial_dispute_application', unique: true, partialFilterExpression: { application: { $type: 'objectId' }, active: true } },
);
FinancialDisputeSchema.index({ worker: 1, raisedAt: -1 });
FinancialDisputeSchema.index({ employer: 1, raisedAt: -1 });

export default mongoose.model('FinancialDispute', FinancialDisputeSchema);
