export const CURRENT_JOB_TYPES = Object.freeze([
  'Short-term',
  'Side hustle',
  'Recruiting',
]);

export const LEGACY_JOB_TYPES = Object.freeze([
  'Fulltime',
  'Freelance',
  'Remote',
  'Part-time',
  'Contract',
]);

export const ALL_JOB_TYPES = Object.freeze([
  ...CURRENT_JOB_TYPES,
  ...LEGACY_JOB_TYPES,
]);

export function isSupportedJobType(value) {
  return typeof value === 'string' && ALL_JOB_TYPES.includes(value.trim());
}

export function parseMinimumPay(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\s*\d+(?:\.\d{1,2})?\s*$/.test(value)) return null;

  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}
