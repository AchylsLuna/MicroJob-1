import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
    wallet: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet',
        required: true
    },
    type: {
        type: String,
        enum: ['TOPUP', 'JOB_PAYMENT', 'JOB_EARNING', 'REFUND'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: String,
    referenceId: String,
    status: {
        type: String,
        enum: ['PENDING', 'COMPLETED', 'FAILED'],
        default: 'PENDING'
    }
}, { timestamps: true });

export default mongoose.model('Transaction', TransactionSchema);