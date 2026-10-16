import test from 'node:test';
import assert from 'node:assert/strict';
import { withdrawalPolicy, validateWithdrawalAmount } from '../../lib/withdrawalPolicy.js';

test('withdrawal policy preserves existing limits and routes above-threshold withdrawals to review', () => {
  assert.deepEqual(withdrawalPolicy('EMPLOYER'), { minimum: 1, maximum: 50000, reviewThreshold: 50000 });
  assert.equal(withdrawalPolicy('WORKER').maximum, null);
  assert.equal(validateWithdrawalAmount(100, 'WORKER').processingMode, 'manual');
  assert.equal(validateWithdrawalAmount(50000, 'EMPLOYER').processingMode, 'automatic');
  assert.equal(validateWithdrawalAmount(50000.01, 'WORKER').requiresReview, true);
  assert.match(validateWithdrawalAmount(50000.01, 'WORKER').reviewReason, /threshold/);
  for (const value of [NaN, Infinity, -1, 0, 1.001]) assert.throws(() => validateWithdrawalAmount(value, 'WORKER'));
});

test('invalid configuration fails closed and configured fractional currency limits are supported', () => {
  const previous = process.env.WITHDRAWAL_MIN_AMOUNT;
  try {
    for (const value of ['invalid', '-1', '0', '0.001', 'Infinity']) {
      process.env.WITHDRAWAL_MIN_AMOUNT = value;
      assert.throws(() => withdrawalPolicy('WORKER'), (error) => error.status === 503);
    }
    process.env.WITHDRAWAL_MIN_AMOUNT = '0.50';
    assert.equal(validateWithdrawalAmount(0.50, 'WORKER').minimum, 0.50);
  } finally { if (previous === undefined) delete process.env.WITHDRAWAL_MIN_AMOUNT; else process.env.WITHDRAWAL_MIN_AMOUNT = previous; }
});
