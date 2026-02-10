import mongoose from 'mongoose';

const WalletSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

export default mongoose.model('Wallet', WalletSchema);