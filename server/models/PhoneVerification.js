import mongoose from 'mongoose';

const PhoneVerificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pinCode: { type: String, required: true, trim: true },
    expiresAt: { type: Date, required: true, index: true },
    purpose: { type: String, default: 'phone-verification', trim: true },
    attempts: { type: Number, default: 0 },
    ip: { type: String, trim: true, default: null },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model('PhoneVerification', PhoneVerificationSchema);
