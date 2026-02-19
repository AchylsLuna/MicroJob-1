import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
    sender: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }, // null if from PayMongo
    receiver: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }, // null if held in escrow
    amount: { 
        type: Number, 
        required: true 
    },
    type: { 
        type: String, 
        enum: ['TOP_UP', 'ESCROW', 'PAYOUT'], 
        required: true 
    },
    jobReference: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Job' 
    },
}, { timestamps: true });

export default mongoose.model('Transaction', TransactionSchema);