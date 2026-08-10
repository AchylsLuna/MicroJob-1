import mongoose from 'mongoose';
import { APPLICATION_STATUSES } from '../lib/applicationStatus.js';

const InterviewSchema = new mongoose.Schema(
  {
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
    completedAt: {
      type: Date,
      default: null,
      index: true,
    },
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

export default mongoose.model('JobApplication', JobApplicationSchema);
