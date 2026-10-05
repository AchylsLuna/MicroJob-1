import mongoose from 'mongoose';

// A bucket represents one subject during one fixed rate-limit window. Keeping
// this in Mongo makes limits apply to every serverless instance, rather than
// only to the process that happened to receive the previous request.
const RateLimitBucketSchema = new mongoose.Schema({
  key: { type: String, required: true },
  windowStart: { type: Date, required: true },
  count: { type: Number, required: true, default: 0, min: 0 },
  expiresAt: { type: Date, required: true },
}, { versionKey: false });

RateLimitBucketSchema.index({ key: 1, windowStart: 1 }, { unique: true });
RateLimitBucketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.RateLimitBucket || mongoose.model('RateLimitBucket', RateLimitBucketSchema);
