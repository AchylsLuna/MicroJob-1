import mongoose from 'mongoose';

const phoneVerificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    phoneE164: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    provider: {
      type: String,
      enum: ['twilio-verify', 'twilio-sms', 'textbee', 'development'],
      required: true,
    },
    codeHash: {
      type: String,
      default: null,
      select: false,
    },
    attempts: {
      type: Number,
      min: 0,
      default: 0,
    },
    lastSentAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);

phoneVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.PhoneVerification ||
  mongoose.model('PhoneVerification', phoneVerificationSchema);
