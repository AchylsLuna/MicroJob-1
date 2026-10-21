import test from 'node:test';
import assert from 'node:assert/strict';
import { withdrawalPolicy, validateWithdrawalAmount } from '../../lib/withdrawalPolicy.js';

test('both wallets accept PHP 50 through PHP 50000 and reject amounts outside those limits', () => {
  for (const wallet of ['EMPLOYER', 'WORKER']) {
    assert.deepEqual(withdrawalPolicy(wallet), { minimum: 50, maximum: 50000, reviewThreshold: 50000 });
    for (const amount of [50, 50000]) assert.doesNotThrow(() => validateWithdrawalAmount(amount, wallet));
    assert.throws(() => validateWithdrawalAmount(49.99, wallet), /at least PHP 50.00/);
    assert.throws(() => validateWithdrawalAmount(50000.01, wallet), /maximum is PHP 50000.00/);
  }
  assert.equal(validateWithdrawalAmount(100, 'WORKER').processingMode, 'manual');
  for (const wallet of ['EMPLOYER', 'WORKER']) {
    for (const amount of [50, 100, 50000]) {
      const preview = validateWithdrawalAmount(amount, wallet);
      assert.equal(preview.processingMode, 'manual');
      assert.equal(preview.requiresReview, true);
      assert.match(preview.reviewReason, /Finance approval/);
    }
  }
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
