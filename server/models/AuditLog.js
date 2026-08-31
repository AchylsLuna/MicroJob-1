import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: null },
    action: { type: String, required: true },
    target: { type: String, default: null },
    reason: { type: String, default: null },
    // 'system' for a normal recorded action, 'error' when the action failed —
    // drives the Audit Logs admin page's category filter/pills.
    category: { type: String, enum: ['system', 'error'], default: 'system' },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    device: { type: String, default: null },
    amount: { type: Number, default: null },
    status: { type: String, default: 'initiated' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: { createdAt: true, updatedAt: false } });

// keep logs immutable by not relying on updates; index for queries
AuditLogSchema.index({ createdAt: -1 });

export default mongoose.model('AuditLog', AuditLogSchema);
