import crypto from 'node:crypto';
import Bucket from '../models/AuthRateBucket.js';
const bucketKey = (prefix, key) => `${prefix}:${crypto.createHash('sha256').update(key).digest('hex')}`;

/** Shared across API instances; fixed windows are never extended by retries. */
export class MongoRateLimitStore {
  constructor(prefix) { this.prefix = prefix; this.localKeys = false; }
  init(options) { this.windowMs = options.windowMs; }
  async increment(key) {
    const now = new Date(); const expired = { $lte: [{ $ifNull: ['$resetTime', new Date(0)] }, now] };
    const increment = () => Bucket.findOneAndUpdate({ key: bucketKey(this.prefix, key) }, [{ $set: { totalHits: { $cond: [expired, 1, { $add: [{ $ifNull: ['$totalHits', 0] }, 1] }] }, resetTime: { $cond: [expired, new Date(now.getTime() + this.windowMs), '$resetTime'] } } }], { upsert: true, returnDocument: 'after', updatePipeline: true });
    let bucket;
    try { bucket = await increment(); } catch (error) { if (error.code !== 11000) throw error; bucket = await increment(); }
    return { totalHits: bucket.totalHits, resetTime: bucket.resetTime };
  }
  async decrement(key) { await Bucket.updateOne({ key: bucketKey(this.prefix, key), totalHits: { $gt: 0 } }, { $inc: { totalHits: -1 } }); }
  async resetKey(key) { await Bucket.deleteOne({ key: bucketKey(this.prefix, key) }); }
}
