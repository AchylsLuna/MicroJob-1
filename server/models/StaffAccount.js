import mongoose from 'mongoose';

const StaffAccountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    staffRole: {
      type: String,
      enum: ['admin_team', 'moderator', 'finance_team', 'analytics_team', 'support_staff'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
      index: true,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true, versionKey: false }
);

StaffAccountSchema.index({ email: 1 }, { unique: true, sparse: true });

export default mongoose.model('StaffAccount', StaffAccountSchema);
