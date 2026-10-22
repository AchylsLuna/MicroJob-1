import type { PaymentTransaction } from '../services/api';

export function financialReportTypeKey(transaction: PaymentTransaction): string {
  if (transaction.type === 'PAYOUT') return transaction.payoutRequest ? 'withdrawal' : 'jobPayment';
  if (transaction.type === 'POSTING_FEE') return /highlight/i.test(transaction.label || '') ? 'highlightFee' : 'postingFee';
  return ({ TOP_UP: 'topUp', ESCROW: 'reservation', REFUND: 'refund' } as Record<string, string>)[transaction.type] || 'unknown';
}

