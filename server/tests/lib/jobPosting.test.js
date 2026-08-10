import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_JOB_TYPES,
  CURRENT_JOB_TYPES,
  isSupportedJobType,
  parseMinimumPay,
} from '../../lib/jobPosting.js';

test('current opportunity types support short-term work, side hustles, and recruiting', () => {
  assert.deepEqual(CURRENT_JOB_TYPES, ['Short-term', 'Side hustle', 'Recruiting']);
  assert.equal(isSupportedJobType('Short-term'), true);
  assert.equal(isSupportedJobType('Side hustle'), true);
  assert.equal(isSupportedJobType('Recruiting'), true);
  assert.equal(ALL_JOB_TYPES.includes('Freelance'), true);
  assert.equal(isSupportedJobType('Permanent secret option'), false);
});

test('minimum pay accepts positive numbers and rejects malformed or non-positive values', () => {
  assert.equal(parseMinimumPay(1500), 1500);
  assert.equal(parseMinimumPay('2500.50'), 2500.5);
  assert.equal(parseMinimumPay(0), null);
  assert.equal(parseMinimumPay(-10), null);
  assert.equal(parseMinimumPay('1,500'), null);
  assert.equal(parseMinimumPay({ amount: 1500 }), null);
});
