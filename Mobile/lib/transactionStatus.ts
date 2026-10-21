type TransactionStatusInput = {
  type?: string;
  status?: string;
  payoutRequest?: { status?: string } | string | null;
};

const withdrawalStatuses = new Set(['requested', 'approved', 'processing', 'paid', 'failed', 'rejected', 'cancelled']);
const ledgerStatuses = new Set(['COMPLETED', 'PENDING', 'FAILED', 'CANCELLED']);

export function getWalletTransactionStatus(transaction: TransactionStatusInput): string {
  // A withdrawal's ledger stays pending until the transfer is recorded as paid.
  // Use its linked request to distinguish approval from actual payment.
  const payout = transaction.payoutRequest;
  if (transaction.type === 'PAYOUT' && payout && typeof payout === 'object' && withdrawalStatuses.has(payout.status || '')) {
    return payout.status!.toUpperCase();
  }
  if (transaction.type === 'ESCROW' && transaction.status === 'COMPLETED') return 'FUNDS_RESERVED';
  return ledgerStatuses.has(transaction.status || '') ? transaction.status! : 'UNKNOWN';
}
