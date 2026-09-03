/**
 * Failed-login lockout policy.
 *
 * Kept as a pure module (no Mongoose, no request objects) so the escalation
 * schedule can be unit-tested without a database, matching the style of
 * passwordPolicy.js and adminPermissions.js. The stateful half lives on the
 * User model, which owns the counters this policy interprets.
 *
 * Rate limiting alone cannot close credential stuffing: express-rate-limit
 * buckets are per-process and keyed partly by IP, so a distributed attacker
 * simply spreads attempts across addresses. This counter is stored on the
 * account itself, so it holds regardless of which IP or serverless instance
 * the attempt arrives on.
 */

export const MAX_FAILED_ATTEMPTS = 5;

/**
 * Duration of the Nth consecutive lock. The final entry repeats as the cap, so
 * an attacker sits at one hour per five attempts indefinitely while a genuine
 * user who mistyped their password waits fifteen minutes at worst.
 */
export const LOCK_DURATIONS_MS = [
  15 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
];

/**
 * @param {number} lockCount 1-based count of locks applied to this account
 *   since its last successful login. Values below 1 are treated as the first
 *   lock; values past the end of the table return the cap.
 */
export function getLockDurationMs(lockCount) {
  const index = Math.min(
    Math.max(Math.trunc(Number(lockCount) || 1), 1) - 1,
    LOCK_DURATIONS_MS.length - 1
  );
  return LOCK_DURATIONS_MS[index];
}

/** True when `lockUntil` is set and still in the future. */
export function isLockActive(lockUntil, now = Date.now()) {
  if (!lockUntil) return false;
  const expiry = lockUntil instanceof Date ? lockUntil.getTime() : Number(lockUntil);
  return Number.isFinite(expiry) && expiry > now;
}

export default {
  MAX_FAILED_ATTEMPTS,
  LOCK_DURATIONS_MS,
  getLockDurationMs,
  isLockActive,
};
