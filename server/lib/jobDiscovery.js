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

export async function resolveDiscoveryCity({ userId, role, requestedCity, allowUnscoped }) {
  if (userId && WORKER_ROLES.has(role)) {
    const worker = await User.findById(userId).select('city');
    const city = String(worker?.city || '').trim();
    return city ? { city } : { error: true };
  }

  const city = String(requestedCity || '').trim();
  if (city) return { city };
  if (userId && allowUnscoped) return { city: '' };
  return { error: true };
}

export function addCityFilter(filter, city) {
  if (!city) return filter;
  const citySegment = `(?:^|,\\s*)${escapeRegExp(city)}(?:\\s*,|$)`;
  return { ...filter, location: { $regex: citySegment, $options: 'i' } };
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
