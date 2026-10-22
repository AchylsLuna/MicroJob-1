# Financial report terminology

Admin financial exports distinguish a ledger entry from the external withdrawal
request associated with it. Approval does not establish a completed transfer.

| Record | Display wording |
| --- | --- |
| Completed escrow entry | Funds reserved |
| Withdrawal requested | Awaiting Finance approval |
| Withdrawal approved | Approved; awaiting transfer |
| Withdrawal processing | Transfer processing |
| Withdrawal paid | Transferred |
| PAYOUT without a withdrawal request | Job payment |
| POSTING_FEE | Job posting fee or Job highlight fee |
| Missing/unrecognized status | Unknown |

The financial-history export preserves the original `type`, `status`, references,
and IDs for audit compatibility. `transactionTypeLabel`, `statusLabel`, and
`ledgerStatusLabel` explain their meaning. `withdrawalStatus` is separate from the
ledger status. For example, a withdrawal can have ledger status `PENDING` and
withdrawal status `approved`, displayed as **Approved; awaiting transfer**.

`balanceTarget` identifies the ledger account: employer wallet, worker wallet,
reserved job funds, or platform account. It is not automatically the source wallet.
`sourceWallet` and `sourceWalletLabel` use the recorded withdrawal source or funding
breakdown. Missing origins show **Not recorded**, and mixed funding identifies both
wallets. An absent sender or receiver is not assumed to be the platform.

Financial amounts include a `currency` field set to `PHP`. The generated transaction
report uses Manila date boundaries and identifies its display timezone as
`Asia/Manila`. The financial-history API retains ISO timestamps for auditing.

The recent-report badge **Generated** describes the exported file, not payment
completion. Report descriptions describe transaction records rather than claiming
to provide an aggregated financial summary.
