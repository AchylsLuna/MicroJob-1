import User from '../models/User.js';

export const PUBLIC_JOB_POSTER_SELECT = '_id firstName lastName companyName avatarUrl';
export const APPLICANT_SELECT = [
  '_id', 'firstName', 'lastName', 'email', 'phoneNumber', 'role', 'status',
  'city', 'province', 'jobPosition', 'about', 'skills', 'totalExperience',
  'projectsCompleted', 'jobsApplied', 'successRate', 'avatarUrl', 'resumeUrl',
  'resumeFileName',
].join(' ');

const WORKER_ROLES = new Set(['work', 'worker', 'user', 'patient', 'both']);
const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Resolves the viewer's home locality. Discovery is national — this is a
 * *ranking* signal, never a filter, so a missing city is a normal state rather
 * than an error: the viewer simply sees the national list unranked.
 */
export async function resolveDiscoveryCity({ userId, role, requestedCity }) {
  if (userId && WORKER_ROLES.has(role)) {
    const worker = await User.findById(userId).select('city province');
    return {
      city: String(worker?.city || '').trim(),
      province: String(worker?.province || '').trim(),
    };
  }

  return { city: String(requestedCity || '').trim(), province: '' };
}

/** True when `location` names this locality as a whole comma-separated segment. */
function locationMatches(location, locality) {
  if (!locality) return false;
  const pattern = new RegExp(`(?:^|,\\s*)${escapeRegExp(locality)}(?:\\s*,|$)`, 'i');
  return pattern.test(String(location || ''));
}

/**
 * Tags how close a job is to the viewer, so the client can label a group
 * ("Nearest in your city") without re-deriving the match itself.
 */
export function proximityOf(job, { city, province } = {}) {
  if (locationMatches(job?.location, city)) return 'city';
  if (locationMatches(job?.location, province)) return 'province';
  return 'national';
}

const PROXIMITY_RANK = { city: 0, province: 1, national: 2 };

/**
 * Job discovery may inspect these populated fields to rank an employer, but
 * serializePublicJob deliberately strips them from the response. A worker can
 * learn that verified employers are prioritized without receiving document or
 * per-step verification data.
 */
function hasFullyVerifiedEmployer(job) {
  const verification = job?.jobPoster?.verification;
  return verification?.emailVerified === true
    && verification?.phoneVerified === true
    && verification?.identityDocument?.status === 'complete'
    && verification?.addressDocument?.status === 'complete';
}

/**
 * Public discovery tier. It discloses only the ordering outcome—not any
 * verification data—so clients can preserve the server's priority when they
 * apply a user-selected secondary sort.
 */
export function getDiscoveryPriority(job, { prioritizeVerifiedEmployers = false } = {}) {
  if (job?.highlighted) return 0;
  if (prioritizeVerifiedEmployers && hasFullyVerifiedEmployer(job)) return 1;
  return 2;
}

/**
 * Orders a national result set so the viewer's own city surfaces first, then
 * their province, then everywhere else — each group newest-first. Jobs are never
 * removed: a worker in a quiet municipality still sees the whole country.
 */
export function sortByProximity(jobs, locality, { prioritizeVerifiedEmployers = false } = {}) {
  return [...jobs].sort((a, b) => {
    // Discovery has three fixed tiers for workers: highlighted, verified
    // employer, then normal. Proximity and recency only rank jobs *within*
    // one of those tiers.
    const priorityRank =
      getDiscoveryPriority(a, { prioritizeVerifiedEmployers })
      - getDiscoveryPriority(b, { prioritizeVerifiedEmployers });
    if (priorityRank !== 0) return priorityRank;
    const rankDiff = PROXIMITY_RANK[proximityOf(a, locality)] - PROXIMITY_RANK[proximityOf(b, locality)];
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
}

export function serializePublicJob(job) {
  const value = job?.toObject ? job.toObject() : { ...job };
  const poster = value?.jobPoster;
  // Expose only the final verification outcome for search presentation. The
  // source records remain on the populated job object and are stripped below.
  value.employerVerified = hasFullyVerifiedEmployer(job);
  if (poster && typeof poster === 'object') {
    value.jobPoster = {
      _id: poster._id,
      firstName: poster.firstName,
      lastName: poster.lastName,
      companyName: poster.companyName,
      avatarUrl: poster.avatarUrl,
    };
  }
  return value;
}

export function serializeApplicant(applicant) {
  const value = applicant?.toObject ? applicant.toObject() : applicant;
  return Object.fromEntries(
    APPLICANT_SELECT.split(' ')
      .filter((field) => value?.[field] !== undefined)
      .map((field) => [field, value[field]])
  );
}
