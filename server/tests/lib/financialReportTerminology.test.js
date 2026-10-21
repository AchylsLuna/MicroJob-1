import test from 'node:test';
import assert from 'node:assert/strict';
import { financialReportTerminology as describe } from '../../lib/financialReportTerminology.js';

test('financial reports distinguish ledger completion from reservations and withdrawal stages', () => {
  const reserved = describe({ type: 'ESCROW', status: 'COMPLETED', balanceTarget: 'ESCROW', meta: { fundingSources: { EMPLOYER: 500, WORKER: 0 } } });
  assert.equal(reserved.ledgerStatusLabel, 'Completed');
  assert.equal(reserved.statusLabel, 'Funds reserved');
  assert.equal(reserved.transactionTypeLabel, 'Job funds reservation');
  assert.equal(reserved.balanceTargetLabel, 'Reserved job funds');
  assert.equal(reserved.sourceWallet, 'EMPLOYER');
  for (const [status, label] of [['requested', 'Awaiting Finance approval'], ['approved', 'Approved; awaiting transfer'], ['paid', 'Transferred'], ['rejected', 'Rejected'], ['failed', 'Failed']]) {
    const row = describe({ type: 'PAYOUT', status: 'PENDING', payoutRequest: { status, sourceWallet: 'WORKER', processingMode: 'manual' } });
    assert.equal(row.statusLabel, label);
    assert.equal(row.transactionTypeLabel, 'Withdrawal');
    assert.equal(row.ledgerStatusLabel, 'Pending');
    assert.equal(row.sourceWalletLabel, 'Worker wallet');
    assert.equal(row.processingModeLabel, 'Finance approval and manual transfer');
  }
});

test('financial reports retain specific transaction types and never invent completion or source accounts', () => {
  assert.equal(describe({ type: 'PAYOUT', status: 'COMPLETED' }).transactionTypeLabel, 'Job payment');
  assert.equal(describe({ type: 'POSTING_FEE', label: 'Non-refundable highlight fee' }).transactionTypeLabel, 'Job highlight fee');
  assert.equal(describe({ type: 'POSTING_FEE' }).transactionTypeLabel, 'Job posting fee');
  assert.equal(describe({ type: 'TOP_UP' }).statusLabel, 'Unknown');
  assert.equal(describe({ type: 'ESCROW', balanceTarget: 'ESCROW' }).sourceWalletLabel, 'Not recorded');
  assert.equal(describe({ type: 'ESCROW', meta: { fundingSources: { EMPLOYER: 50, WORKER: 50 } } }).sourceWallet, 'MIXED');
  assert.equal(describe({ type: 'REFUND' }).currency, 'PHP');
});
