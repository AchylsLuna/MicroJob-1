import mongoose from 'mongoose';

const PhoneVerificationSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        pinCode: { type: String, required: true },
        expiresAt: { type: Date, required: true },  
    }
)

export default mongoose.model('PhoneVerification', PhoneVerificationSchema);
