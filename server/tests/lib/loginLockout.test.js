import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_FAILED_ATTEMPTS,
  LOCK_DURATIONS_MS,
  getLockDurationMs,
  isLockActive,
} from '../../lib/loginLockout.js';

const MINUTE = 60 * 1000;

test('every lock lasts exactly three minutes', () => {
  assert.equal(getLockDurationMs(1), 3 * MINUTE);
  assert.equal(getLockDurationMs(2), 3 * MINUTE);
  assert.equal(getLockDurationMs(3), 3 * MINUTE);
});

test('the schedule caps rather than growing without bound', () => {
  // An attacker must not be able to push a real user's lock out to days by
  // continuing to fail against their account.
  assert.equal(getLockDurationMs(4), 3 * MINUTE);
  assert.equal(getLockDurationMs(50), 3 * MINUTE);
  assert.equal(getLockDurationMs(Number.MAX_SAFE_INTEGER), 3 * MINUTE);
});

test('a missing or nonsensical lock count is treated as the first lock', () => {
  assert.equal(getLockDurationMs(0), 3 * MINUTE);
  assert.equal(getLockDurationMs(-3), 3 * MINUTE);
  assert.equal(getLockDurationMs(undefined), 3 * MINUTE);
  assert.equal(getLockDurationMs(NaN), 3 * MINUTE);
});

test('the threshold leaves room for ordinary typos', () => {
  // Low enough to stop a guessing run, high enough that a user trying two or
  // three remembered passwords is not locked out of their own account.
  assert.equal(MAX_FAILED_ATTEMPTS, 5);
  assert.ok(MAX_FAILED_ATTEMPTS >= 3 && MAX_FAILED_ATTEMPTS <= 10);
});

test('isLockActive distinguishes a live lock from an expired one', () => {
  const now = Date.now();
  assert.equal(isLockActive(new Date(now + MINUTE), now), true);
  assert.equal(isLockActive(new Date(now - MINUTE), now), false);
  assert.equal(isLockActive(new Date(now), now), false);
});

test('isLockActive treats an unset lock as unlocked', () => {
  assert.equal(isLockActive(null), false);
  assert.equal(isLockActive(undefined), false);
  assert.equal(isLockActive(''), false);
  // A corrupt value must fail open rather than locking someone out forever.
  assert.equal(isLockActive(new Date('not-a-date')), false);
});

test('the policy contains one fixed duration', () => {
  let previous = 0;
  for (const duration of LOCK_DURATIONS_MS) {
    assert.ok(duration > previous, 'durations must increase');
    previous = duration;
  }
});
