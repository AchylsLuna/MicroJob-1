import test from 'node:test';
import assert from 'node:assert/strict';
import { financialReportTypeKey } from '../../client/src/lib/financialReport.ts';
import { getWalletTransactionStatus as financialReportStatusKey } from '../../client/src/lib/transactionStatus.ts';
import type { PaymentTransaction } from '../../client/src/services/api.ts';

test('admin report labels distinguish withdrawals, job payments, reservations, and fees', () => {
  const tx = { _id: 'tx', amount: 50, type: 'PAYOUT' } as PaymentTransaction;
  assert.equal(financialReportTypeKey(tx), 'jobPayment');
  const withdrawal = { ...tx, payoutRequest: { status: 'approved' } } as PaymentTransaction;
  assert.equal(financialReportTypeKey(withdrawal), 'withdrawal');
  assert.equal(financialReportStatusKey(withdrawal), 'APPROVED');
  assert.equal(financialReportStatusKey(tx), 'UNKNOWN');
  assert.equal(financialReportStatusKey({ ...tx, type: 'ESCROW', status: 'COMPLETED' }), 'FUNDS_RESERVED');
  assert.equal(financialReportTypeKey({ ...tx, type: 'POSTING_FEE', label: 'Non-refundable highlight fee' }), 'highlightFee');
});
