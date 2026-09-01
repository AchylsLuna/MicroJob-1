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
 * Orders a national result set so the viewer's own city surfaces first, then
 * their province, then everywhere else — each group newest-first. Jobs are never
 * removed: a worker in a quiet municipality still sees the whole country.
 */
export function sortByProximity(jobs, locality) {
  return [...jobs].sort((a, b) => {
    const rankDiff = PROXIMITY_RANK[proximityOf(a, locality)] - PROXIMITY_RANK[proximityOf(b, locality)];
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
}

export function serializePublicJob(job) {
  const value = job?.toObject ? job.toObject() : { ...job };
  const poster = value?.jobPoster;
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
