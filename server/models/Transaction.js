import mongoose from 'mongoose';


const TransactionSchema = new mongoose.Schema({
    sender: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        default: null,
    }, // null if from external provider
    receiver: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        default: null,
    }, // null if held in escrow or system-level
    amount: { 
        type: Number, 
        required: true 
    },
    type: { 
        type: String, 
        enum: ['TOP_UP', 'ESCROW', 'PAYOUT', 'REFUND'], 
        required: true 
    },
    jobReference: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Job',
        default: null,
    },
    // optional reference string for external systems or internal traceability
    reference: {
        type: String,
        default: null,
    },
    // Human-friendly label to display in transaction lists
    label: {
        type: String,
        default: null,
    },
    // free-form metadata for auditing (payment provider ids, webhook payloads, etc.)
    meta: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    // who triggered the transaction (if applicable)
    actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    }
}, { timestamps: true });

// index to speed up queries by creation time
TransactionSchema.index({ createdAt: -1 });

export default mongoose.model('Transaction', TransactionSchema);