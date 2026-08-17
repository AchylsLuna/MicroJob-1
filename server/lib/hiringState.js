// Hiring-state transitions for job posts and applications.
//
// This module exists to enforce three rules that were previously implicit and
// inconsistent between the two hiring paths (the plain application-status route
// and the offer flow in JobOfferController):
//
//   1. Hiring is *not* a plain status edit. A hire reserves a position, pins an
//      agreed amount, and secures escrow, so it must go through the offer flow.
//      EMPLOYER_MUTABLE_STATUSES is the authoritative list of statuses an
//      employer may set directly, and deliberately excludes 'Hired'.
//   2. A job post's Available/Closed state must reflect *committed* positions,
//      which include positions held by pending offers (reservedOfferCount), not
//      just completed hires.
//   3. A job the employer closed by hand must not silently reopen because some
//      unrelated application changed status.
//
// Terminal/explicit job states are never auto-managed here; only the
// Available <-> Closed pair is derived from capacity.

export const EMPLOYER_MUTABLE_STATUSES = [
  'Applied',
  'Shortlisted',
  'Interview Scheduled',
  'Interviewed',
  'Offer Sent',
  'Rejected',
];

// 'Accepted' is a legacy spelling of 'Hired' still present in older records;
// JobController's payout flow already treats the two as equivalent.
export const HIRED_STATUSES = ['Hired', 'Accepted'];

// Job statuses that represent an explicit decision and must never be
// overwritten by capacity math.
export const TERMINAL_JOB_STATUSES = ['Completed', 'Cancelled', 'In Progress'];

// Un-hiring returns escrow and frees a position. That is only safe while the
// money is still sitting in escrow; once payment is authorized or in flight the
// un-hire has to be resolved through the payment lifecycle instead.
export const UNHIRE_SAFE_PAYMENT_STATUSES = ['Secured', 'Failed'];

export function toCount(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

export function isHiredStatus(status) {
  return HIRED_STATUSES.includes(String(status || '').trim());
}

export function isEmployerMutableStatus(status) {
  return EMPLOYER_MUTABLE_STATUSES.includes(String(status || '').trim());
}

/**
 * Positions that are spoken for: filled by a hire or held by a pending offer.
 */
export function countCommittedPositions({ hiredCount, reservedOfferCount } = {}) {
  return toCount(hiredCount) + toCount(reservedOfferCount);
}

export function isAtCapacity({ hiredCount, reservedOfferCount, positionsNeeded } = {}) {
  const capacity = Math.max(1, toCount(positionsNeeded, 1));
  return countCommittedPositions({ hiredCount, reservedOfferCount }) >= capacity;
}

/**
 * Derive the job post status after a hiring-state change.
 *
 * Returns the status unchanged when it is terminal, when the employer closed the
 * post by hand, or when no transition applies — callers can compare against the
 * current value to decide whether a write is needed.
 */
export function resolveJobAvailability({
  status,
  hiredCount,
  reservedOfferCount,
  positionsNeeded,
  closedManually = false,
} = {}) {
  const current = String(status || '').trim();
  if (TERMINAL_JOB_STATUSES.includes(current)) return current;

  const atCapacity = isAtCapacity({ hiredCount, reservedOfferCount, positionsNeeded });
  if (atCapacity) return 'Closed';

  // Below capacity: only reopen a post that capacity itself had closed.
  if (current === 'Closed') return closedManually ? 'Closed' : 'Available';
  return current || 'Available';
}

/**
 * hiredCount delta for an application status transition.
 *
 * Uses hired-status equivalence so a legacy 'Accepted' -> 'Hired' migration does
 * not double-count the same hire.
 */
export function nextHiredCount({ previousStatus, nextStatus, hiredCount } = {}) {
  const current = toCount(hiredCount);
  const wasHired = isHiredStatus(previousStatus);
  const willBeHired = isHiredStatus(nextStatus);

  if (!wasHired && willBeHired) return current + 1;
  if (wasHired && !willBeHired) return Math.max(0, current - 1);
  return current;
}

export function isUnhireTransition({ previousStatus, nextStatus } = {}) {
  return isHiredStatus(previousStatus) && !isHiredStatus(nextStatus);
}

/**
 * Whether a hired application may be un-hired, and why not when it may not.
 */
export function canUnhireApplication({ paymentStatus } = {}) {
  const current = String(paymentStatus || 'Secured').trim();
  if (UNHIRE_SAFE_PAYMENT_STATUSES.includes(current)) {
    return { allowed: true, reason: null };
  }
  if (current === 'Paid') {
    return { allowed: false, reason: 'This worker has already been paid for this job.' };
  }
  return {
    allowed: false,
    reason: `Payment for this worker is already ${current.toLowerCase()}. Resolve the payment before changing the hire.`,
  };
}

/**
 * Escrow to return to the employer when a hire is undone.
 *
 * Base salary escrow is collected per position when the job is posted and stays
 * held for the now-vacant position (it is released or refunded when the job is
 * completed). Only the negotiated amount above base salary, which was debited
 * for this specific worker, is refunded here — mirroring the refund on offer
 * rejection/cancellation.
 */
export function computeUnhireRefund({ offerAmount, additionalEscrow, jobSalary } = {}) {
  const explicit = Number(additionalEscrow);
  if (Number.isFinite(explicit) && explicit > 0) {
    return Number(explicit.toFixed(2));
  }

  const agreed = Number(offerAmount);
  const base = Number(jobSalary);
  if (!Number.isFinite(agreed) || !Number.isFinite(base)) return 0;

  const extra = Number((agreed - base).toFixed(2));
  return extra > 0 ? extra : 0;
}
