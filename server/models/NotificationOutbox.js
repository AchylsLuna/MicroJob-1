import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['pending', 'delivering', 'delivered'], default: 'pending', index: true },
  attempts: { type: Number, default: 0 },
  availableAt: { type: Date, default: Date.now, index: true },
  lastError: String,
  deliveredAt: Date,
}, { timestamps: true });
export default mongoose.model('NotificationOutbox', schema);
