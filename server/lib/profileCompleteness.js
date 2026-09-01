/**
 * Profile requirements gating two actions: an employer must look like a real
 * business before posting a job, and a worker must have a face before applying
 * to one. Both are read-only checks against a User document — no side effects —
 * so the same function backs the hard server-side gate and any client-side
 * pre-check that wants to avoid a round-trip just to show an error.
 */

export function getEmployerProfileRequirementError(user) {
  const missing = [];
  if (!String(user?.companyName || '').trim()) missing.push('companyName');
  if (!String(user?.avatarUrl || '').trim()) missing.push('avatarUrl');
  if (!missing.length) return null;
  return {
    status: 409,
    code: 'EMPLOYER_PROFILE_INCOMPLETE',
    message: 'Add your company name and logo before posting a job.',
    missing,
  };
}

export function getWorkerProfileRequirementError(user) {
  if (String(user?.avatarUrl || '').trim()) return null;
  return {
    status: 409,
    code: 'WORKER_PROFILE_INCOMPLETE',
    message: 'Add a profile photo before applying to jobs.',
    missing: ['avatarUrl'],
  };
}

export default { getEmployerProfileRequirementError, getWorkerProfileRequirementError };
