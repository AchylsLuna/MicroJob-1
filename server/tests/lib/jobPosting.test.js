import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_JOB_TYPES,
  CURRENT_JOB_TYPES,
  JOB_HIGHLIGHT_FEE,
  JOB_POSTING_FEE,
  getJobPostingCosts,
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

test('posting costs keep worker pay separate from fixed listing fees', () => {
  assert.equal(JOB_POSTING_FEE, 20);
  assert.equal(JOB_HIGHLIGHT_FEE, 50);
  assert.deepEqual(
    getJobPostingCosts({ payPerWorker: 500, positionsNeeded: 2, highlighted: true }),
    { workerPay: 1000, postingFee: 20, highlightFee: 50, total: 1070 },
  );
  assert.deepEqual(
    getJobPostingCosts({ payPerWorker: 500, positionsNeeded: 1 }),
    { workerPay: 500, postingFee: 20, highlightFee: 0, total: 520 },
  );
});
