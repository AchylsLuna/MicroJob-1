/** Five failed password attempts restrict the account for exactly three minutes. */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_DURATIONS_MS = [180000];
export function getLockDurationMs() { return 180000; }
export function isLockActive(lockUntil, now = Date.now()) {
  if (!lockUntil) return false;
  const expiry = lockUntil instanceof Date ? lockUntil.getTime() : Number(lockUntil);
  return Number.isFinite(expiry) && expiry > now;
}
export default { MAX_FAILED_ATTEMPTS, LOCK_DURATIONS_MS, getLockDurationMs, isLockActive };
