import mongoose from 'mongoose';

/**
 * One row per unique viewer of a job. `dedupeKey` is what makes a view unique:
 * `u:<userId>` for a signed-in viewer (counted once, forever) or
 * `a:<hash>` for an anonymous one (hash of IP + user agent + calendar day, so a
 * refresh does not inflate the count but a genuine return visit tomorrow does).
 *
 * The unique compound index is the deduplication mechanism itself — the recorder
 * attempts an insert and treats a duplicate-key error as "already counted",
 * which is atomic and safe under concurrent requests.
 */
const JobViewSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    viewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    dedupeKey: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

JobViewSchema.index({ job: 1, dedupeKey: 1 }, { unique: true });

export default mongoose.model('JobView', JobViewSchema);
