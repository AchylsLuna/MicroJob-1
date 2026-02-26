import mongoose from 'mongoose';

const AlertSchema = new mongoose.Schema({
    type: { type: String, required: true },
    description: { type: String, required: true },
    count: { type: Number, default: 1 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: { createdAt: true, updatedAt: false } });

AlertSchema.index({ createdAt: -1 });

export default mongoose.model('Alert', AlertSchema);
