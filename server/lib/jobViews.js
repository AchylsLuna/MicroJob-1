import crypto from 'node:crypto';
import Job from '../models/Job.js';
import JobView from '../models/JobView.js';

/**
 * Builds the uniqueness key for a view. Signed-in viewers are deduped by user id
 * so the count is "unique people". Anonymous viewers are deduped by a salted hash
 * of IP + user agent + calendar day: raw IPs are never stored, a refresh does not
 * inflate the count, and a real return visit on another day counts again.
 */
function buildDedupeKey({ viewerId, ip, userAgent }) {
  if (viewerId) return `u:${viewerId}`;
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.JWT_SECRET || 'microjobs-view-salt';
  const hash = crypto
    .createHash('sha256')
    .update(`${salt}|${ip || 'noip'}|${userAgent || 'noua'}|${day}`)
    .digest('hex')
    .slice(0, 32);
  return `a:${hash}`;
}

/**
 * Records one view of a job, incrementing `Job.viewCount` only when this viewer
 * has not been counted before. Never throws: a failed view write must not break
 * the job detail response.
 *
 * @returns {Promise<boolean>} true when this call counted a new unique view.
 */
export async function recordJobView(job, { viewerId = null, ip = null, userAgent = null } = {}) {
  try {
    if (!job?._id) return false;
    // A poster looking at their own listing is not audience interest.
    if (viewerId && String(job.jobPoster?._id || job.jobPoster) === String(viewerId)) return false;

    const dedupeKey = buildDedupeKey({ viewerId, ip, userAgent });
    await JobView.create({ job: job._id, viewer: viewerId, dedupeKey });
    await Job.updateOne({ _id: job._id }, { $inc: { viewCount: 1 } });
    return true;
  } catch (error) {
    // 11000 = duplicate key: this viewer is already counted, which is the
    // expected path on any repeat visit, not an error worth logging.
    if (error?.code !== 11000) {
      console.error('Failed to record job view', error);
    }
    return false;
  }
}

export default { recordJobView };
