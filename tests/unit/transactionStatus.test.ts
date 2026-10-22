import test from 'node:test';
import assert from 'node:assert/strict';
import { getWalletTransactionStatus as webStatus } from '../../client/src/lib/transactionStatus.ts';
import { getWalletTransactionStatus as mobileStatus } from '../../Mobile/lib/transactionStatus.ts';

for (const [platform, status] of [['web', webStatus], ['mobile', mobileStatus]] as const) {
  test(`${platform}: withdrawal approval never displays as a completed transfer`, () => {
    for (const stage of ['requested', 'approved', 'processing', 'paid', 'failed', 'rejected', 'cancelled']) {
      assert.equal(status({ type: 'PAYOUT', status: 'PENDING', payoutRequest: { status: stage } }), stage.toUpperCase());
    }
    assert.equal(status({ type: 'PAYOUT', status: 'PENDING', payoutRequest: 'legacy-id' }), 'PENDING');
    assert.equal(status({ type: 'PAYOUT', status: 'PENDING', payoutRequest: { status: 'unknown' } }), 'PENDING');
  });

  test(`${platform}: reservations, earnings, top-ups and refunds describe their own ledger event`, () => {
    assert.equal(status({ type: 'ESCROW', status: 'COMPLETED' }), 'FUNDS_RESERVED');
    assert.equal(status({ type: 'ESCROW', status: 'FAILED' }), 'FAILED');
    assert.equal(status({ type: 'PAYOUT', status: 'COMPLETED' }), 'COMPLETED');
    assert.equal(status({ type: 'TOP_UP', status: 'COMPLETED' }), 'COMPLETED');
    assert.equal(status({ type: 'REFUND', status: 'COMPLETED', payoutRequest: { status: 'rejected' } }), 'COMPLETED');
    assert.equal(status({ type: 'POSTING_FEE', status: 'COMPLETED' }), 'COMPLETED');
  });

  test(`${platform}: unknown or missing status is not presented as pending or paid`, () => {
    assert.equal(status({}), 'UNKNOWN');
    assert.equal(status({ status: 'unexpected' }), 'UNKNOWN');
  });
}
