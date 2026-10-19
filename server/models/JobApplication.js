import mongoose from 'mongoose';
import { APPLICATION_STATUSES } from '../lib/applicationStatus.js';

const InterviewSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
    completedAt: Date,
    scheduledAt: {
      type: Date,
      required: true,
    },
    location: {
      type: String,
      trim: true,
      default: null,
    },
    mode: {
      type: String,
      trim: true,
      default: 'other',
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: 2000,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

const TimelineItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      default: null,
      trim: true,
    },
    note: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true, versionKey: false }
);

const JobApplicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    resume: {
      type: String,
      default: null,
    },
    hireChecklist: {
      type: [{ description: { type: String, required: true, trim: true, maxlength: 500 }, completed: { type: Boolean, default: false } }],
      default: [],
      validate: { validator: (items) => items.length <= 20, message: 'A hire checklist can contain at most 20 items.' },
    },
    completionEvidence: [{
      workDate: String,
      statement: { type: String, maxlength: 4000 },
      fileUrl: String,
      fileName: String,
      contentType: String,
      storage: { type: String, enum: ['azure'] },
      actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      submittedAt: { type: Date, default: Date.now },
    }],
    coverLetter: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: 'Applied',
      index: true,
    },
    interviews: {
      type: [InterviewSchema],
      default: [],
    },
    timeline: {
      type: [TimelineItemSchema],
      default: [],
    },
    applicantReadAt: {
      type: Date,
      default: null,
    },
    employerReadAt: {
      type: Date,
      default: null,
    },
    employerHidden: {
      type: Boolean,
      default: false,
    },
    employerHiddenAt: {
      type: Date,
      default: null,
    },
    withdrawnAt: {
      type: Date,
      default: null,
    },
    startedAt: { type: Date, default: null },
    nextPaymentReminderAt: { type: Date, default: null },
    reminderStages: { type: [Number], default: [] },
    disputePending: { type: Boolean, default: false },
    firstSubmittedAt: { type: Date, default: null },
    nonpaymentAlertedAt: { type: Date, default: null },
    cancellation: { type: mongoose.Schema.Types.ObjectId, ref: 'Cancellation', default: null },
    cancellationPending: { type: Boolean, default: false },
    paidAmount: { type: Number, default: 0 },
    completedAt: {
      type: Date,
      default: null,
      index: true,
    },
    hiredAt: {
      type: Date,
      default: null,
      index: true,
    },
    agreedAmount: { type: Number, default: null, min: 1 },
    agreedDailyRate: { type: Number, default: null, min: 480 },
    dailyPayments: {
      type: [new mongoose.Schema({
        workDate: { type: String, required: true },
        amount: { type: Number, required: true, min: 480 },
        submittedAt: { type: Date, default: null },
        paidAt: { type: Date, default: null },
        nextReminderAt: { type: Date, default: null },
        nonpaymentAlertedAt: { type: Date, default: null },
      }, { _id: false })],
      default: [],
    },
    workStatus: {
      type: String,
      enum: ['Not started', 'In Progress', 'Submitted', 'Changes Requested', 'Completed', 'Cancelled'],
      default: 'In Progress',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['Secured', 'Authorized', 'Processing', 'Disputed', 'Paid', 'Partially Paid', 'Partially paid', 'Refunded', 'Outstanding', 'Failed'],
      default: 'Secured',
      index: true,
    },
    paymentAuthorizedAt: { type: Date, default: null },
    workSubmittedAt: { type: Date, default: null },
    paymentReminderClaimedAt: { type: Date, default: null },
    paymentReminderClaimedStage: { type: String, default: null },
    paymentReminderSentAt: { type: Date, default: null },
    paymentReminder3hSentAt: { type: Date, default: null },
    paymentReminder5hSentAt: { type: Date, default: null },
    paymentReminder48hSentAt: { type: Date, default: null },
    paymentReminder24hSentAt: { type: Date, default: null },
    changesRequestedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    appliedDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true, versionKey: false }
);

JobApplicationSchema.index({ job: 1, applicant: 1 }, { unique: true });
JobApplicationSchema.index({ applicant: 1, status: 1, updatedAt: -1 });
JobApplicationSchema.index({ job: 1, status: 1, updatedAt: -1 });
JobApplicationSchema.index({ workStatus: 1, paymentStatus: 1, workSubmittedAt: 1, paymentReminder3hSentAt: 1 });
JobApplicationSchema.index({ 'completionEvidence.fileUrl': 1 }, { sparse: true });
JobApplicationSchema.index({ 'dailyPayments.nextReminderAt': 1 });

export default mongoose.model('JobApplication', JobApplicationSchema);
