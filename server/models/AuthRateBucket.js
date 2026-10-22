import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  totalHits: { type: Number, default: 0 },
  resetTime: { type: Date, expires: 0 },
}, { versionKey: false });
export default mongoose.model('AuthRateBucket', schema);
