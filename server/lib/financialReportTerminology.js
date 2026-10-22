const ledgerStatuses = { PENDING: 'Pending', COMPLETED: 'Completed', FAILED: 'Failed', CANCELLED: 'Cancelled' };
const withdrawalStatuses = { requested: 'Awaiting Finance approval', approved: 'Approved; awaiting transfer', processing: 'Transfer processing', paid: 'Transferred', failed: 'Failed', rejected: 'Rejected', cancelled: 'Cancelled' };
const accounts = { EMPLOYER: 'Employer wallet', WORKER: 'Worker wallet', ESCROW: 'Reserved job funds', SYSTEM: 'Platform account' };

export function financialReportTerminology(transaction) {
  const payout = transaction.payoutRequest && typeof transaction.payoutRequest === 'object' ? transaction.payoutRequest : null;
  const isWithdrawal = transaction.type === 'PAYOUT' && Boolean(transaction.payoutRequest);
  const types = { TOP_UP: 'Wallet top-up', ESCROW: 'Job funds reservation', PAYOUT: isWithdrawal ? 'Withdrawal' : 'Job payment', REFUND: 'Refund', POSTING_FEE: /highlight/i.test(transaction.label || '') ? 'Job highlight fee' : 'Job posting fee' };
  const ledgerStatusLabel = ledgerStatuses[transaction.status] || 'Unknown';
  const fundingSources = Object.entries(transaction.meta?.fundingSources || {})
    .filter(([wallet, amount]) => ['EMPLOYER', 'WORKER'].includes(wallet) && Number(amount) > 0)
    .map(([wallet]) => wallet);
  const sourceWallet = isWithdrawal ? payout?.sourceWallet || '' : fundingSources.length > 1 ? 'MIXED' : fundingSources[0] || '';
  return {
    transactionTypeLabel: types[transaction.type] || 'Unknown',
    ledgerStatusLabel,
    statusLabel: isWithdrawal && payout?.status ? withdrawalStatuses[payout.status] || 'Unknown' : transaction.type === 'ESCROW' && transaction.status === 'COMPLETED' ? 'Funds reserved' : ledgerStatusLabel,
    withdrawalStatus: isWithdrawal ? payout?.status || '' : '',
    balanceTargetLabel: accounts[transaction.balanceTarget] || 'Not recorded',
    sourceWallet,
    sourceWalletLabel: sourceWallet === 'MIXED' ? 'Employer and worker wallets' : accounts[sourceWallet] || 'Not recorded',
    processingModeLabel: !isWithdrawal ? '' : payout?.processingMode === 'manual' ? 'Finance approval and manual transfer' : payout?.processingMode === 'automatic' ? 'Provider transfer (legacy automatic flow)' : '',
    currency: 'PHP',
  };
}
