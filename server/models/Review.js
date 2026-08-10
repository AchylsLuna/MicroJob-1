import mongoose from 'mongoose';

const ReviewSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobApplication',
      required: true,
      index: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reviewee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reviewerRole: {
      type: String,
      enum: ['worker', 'employer'],
      required: true,
    },
    revieweeRole: {
      type: String,
      enum: ['worker', 'employer'],
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be a whole number from 1 to 5.',
      },
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    ownerReply: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    ownerReplyAt: {
      type: Date,
      default: null,
    },
    likedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    dislikedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    criteria: {
      type: Map,
      of: {
        type: Number,
        min: 1,
        max: 5,
      },
      default: {},
    },
  },
  { timestamps: true, versionKey: false }
);

ReviewSchema.index({ application: 1, reviewer: 1 }, { unique: true });
ReviewSchema.index({ reviewee: 1, revieweeRole: 1, createdAt: -1 });

export default mongoose.model('Review', ReviewSchema);
