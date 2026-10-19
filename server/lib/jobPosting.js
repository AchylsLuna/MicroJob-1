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

// These charges are intentionally fixed and are collected when a new listing
// is created. They are separate from escrow, so they never reduce worker pay
// and are never included in an escrow refund.
export const JOB_POSTING_FEE = 20;
export const JOB_HIGHLIGHT_FEE = 50;

export function getMinimumJobPay(jobType) {
  if (jobType.trim() === 'Recruiting') return 480;
  return ['Short-term', 'Side hustle'].includes(jobType.trim()) ? 50 : 0;
}

export function getJobPostingCosts({ payPerWorker, positionsNeeded, highlighted = false, workdays = 1 }) {
  const workerPay = Number((Number(payPerWorker) * Number(positionsNeeded) * workdays).toFixed(2));
  const postingFee = JOB_POSTING_FEE;
  const highlightFee = highlighted ? JOB_HIGHLIGHT_FEE : 0;
  return {
    workerPay,
    postingFee,
    highlightFee,
    total: workerPay + postingFee + highlightFee,
  };
}

export function isSupportedJobType(value) {
  return typeof value === 'string' && ALL_JOB_TYPES.includes(value.trim());
}

export function parseMinimumPay(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\s*\d+(?:\.\d{1,2})?\s*$/.test(value)) return null;

  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}
