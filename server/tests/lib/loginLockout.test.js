import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_FAILED_ATTEMPTS,
  LOCK_DURATIONS_MS,
  getLockDurationMs,
  isLockActive,
} from '../../lib/loginLockout.js';

const MINUTE = 60 * 1000;

test('the escalation schedule lengthens with each consecutive lock', () => {
  assert.equal(getLockDurationMs(1), 15 * MINUTE);
  assert.equal(getLockDurationMs(2), 30 * MINUTE);
  assert.equal(getLockDurationMs(3), 60 * MINUTE);
});

test('the schedule caps rather than growing without bound', () => {
  // An attacker must not be able to push a real user's lock out to days by
  // continuing to fail against their account.
  assert.equal(getLockDurationMs(4), 60 * MINUTE);
  assert.equal(getLockDurationMs(50), 60 * MINUTE);
  assert.equal(getLockDurationMs(Number.MAX_SAFE_INTEGER), 60 * MINUTE);
});

test('a missing or nonsensical lock count is treated as the first lock', () => {
  assert.equal(getLockDurationMs(0), 15 * MINUTE);
  assert.equal(getLockDurationMs(-3), 15 * MINUTE);
  assert.equal(getLockDurationMs(undefined), 15 * MINUTE);
  assert.equal(getLockDurationMs(NaN), 15 * MINUTE);
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

test('every duration in the table is positive and ordered', () => {
  let previous = 0;
  for (const duration of LOCK_DURATIONS_MS) {
    assert.ok(duration > previous, 'durations must increase');
    previous = duration;
  }
});
