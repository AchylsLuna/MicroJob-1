import test from 'node:test';
import assert from 'node:assert/strict';
import { getTransactionDescription as web } from '../../client/src/lib/transactionDescription.ts';
import { getTransactionDescription as mobile } from '../../Mobile/lib/transactionDescription.ts';

const id = '6ad61487b4e116bfb976cf0f';
for (const [platform, description] of [['web', web], ['mobile', mobile]] as const) {
  test(`${platform}: existing ledger labels use readable wording and populated job titles`, () => {
    for (const [label, key] of [['Escrow', 'fundsReserved'], ['Non-refundable posting fee', 'postingFee'], ['Non-refundable highlight fee', 'highlightFee'], ['Escrow adjustment on job update', 'reservationAdjustment']]) {
      const result = description({ type: 'ESCROW', label: `${label} (Job ${id})`, jobReference: { _id: id, title: 'House Cleaning' } });
      assert.equal(result.key, key);
      assert.equal(result.label, label);
      assert.equal(result.jobTitle, 'House Cleaning');
      assert.equal(result.jobId, id);
      assert.equal(result.label.includes(id), false);
    }
  });
  test(`${platform}: missing jobs hide the internal ID and preserve other transaction descriptions`, () => {
    const result = description({ label: `Non-refundable posting fee (Job ${id})`, jobReference: null });
    assert.equal(result.jobTitle, '');
    assert.equal(result.jobId, '');
    assert.equal(result.label, 'Non-refundable posting fee');
    assert.equal(description({ type: 'ESCROW' }).key, 'fundsReserved');
    assert.equal(description({ label: 'Withdrawal', jobReference: id }).label, 'Withdrawal');
    assert.equal(description({ label: 'Daily payment (2026-10-21)' }).label, 'Daily payment (2026-10-21)');
  });
}
