# Payment and wallet review

The review extends existing payment services, routes, wallet records, Finance screens, notification delivery, and dispute handling. It adds no parallel wallet or settlement system.

## Existing behavior reused

- Per-job reserved funding, employer/worker wallet ownership checks, conditional balance updates, MongoDB transactions, payment ledger references, and idempotency keys.
- Worker withdrawal approval, rejection/refund, manual transfer references, provider reconciliation, and recorded decisions/events.
- Employer payment preview/confirmation, work-submission notifications, payment reminders, cancellation policies, and audit exports.
- Dispute reasons, evidence uploads, Support investigation, authorized communication access, Finance decisions with justification and an independent approver, and outcome notifications.

## Changes

- Withdrawal limits are configurable and enforced at preview and confirmation. Existing confirmed requests remain idempotent if configuration changes. All withdrawals use the existing Finance manual review/transfer flow, with a recorded policy snapshot and explanation shown to users and Finance.
- Web and Android show configured limits, review reasons, and clearer payment/withdrawal language. Stale automatic-payment descriptions were corrected. Technical ledger values remain unchanged.
- Work submission accepts a statement and/or a photo/document, retains resubmission history, and notifies the employer. Evidence is available in assignment details and staff dispute review. Downloads require the assigned worker, employer, or authorized dispute staff. Android can save attachments to a selected folder.
- Employer confirmations include the job title and amount; employers also receive a durable payment-success notification. Existing exactly-once settlement logic is reused.
- Overdue active disputes escalate to senior staff and notify both participants. Escalation is deduplicated, respects open evidence windows, preserves pending settlement approval stages, and never releases funds or applies penalties.
- Removed a legacy route that intercepted dispute evidence uploads before the multipart handler. The existing evidence API now accepts both multipart uploads and legacy statement/no-evidence requests, and removes uploaded files when requests are rejected.

## Configuration

See `server/.env.example`. These are project policy values, not financial regulations:

| Setting | Default | Meaning |
| --- | --- | --- |
| `WITHDRAWAL_MIN_AMOUNT` | `50` | Minimum withdrawal in PHP for both wallets |
| `WITHDRAWAL_EMPLOYER_MAX_AMOUNT` | `50000` | Preserves the existing employer ceiling |
| `WITHDRAWAL_WORKER_MAX_AMOUNT` | `50000` | Worker ceiling in PHP, subject to available balance |
| `WITHDRAWAL_REVIEW_THRESHOLD` | `50000` | Legacy compatibility setting; all withdrawals require Finance approval |
| `FINANCIAL_DISPUTE_REVIEW_HOURS` | `168` | Senior escalation after this period and after any evidence deadline |

An explicit maximum of `0` means available balance. Invalid monetary configuration fails closed. The review-period default follows the existing seven-day evidence window and should be approved by the project team. All new requests are transferred externally by Finance and marked paid using the existing transfer-reference workflow.

The authenticated `GET /api/payment/withdrawals/policy?sourceWallet=WORKER|EMPLOYER` endpoint supplies both clients with the same policy. Scheduled processing still requires the existing `MICROJOBS_API_ORIGIN` and `MAINTENANCE_SECRET` GitHub Actions secrets; email reminders require the existing email configuration. Deploy backend and clients together because new work submissions require evidence. Existing already-submitted assignments remain payable without fabricated evidence.

## Database compatibility

Only additive optional fields were introduced:

- `PayoutRequest.reviewReason` and `policySnapshot` record the applicable review policy. Its amount validator now allows configurable sub-peso minima down to one centavo.
- `JobApplication.completionEvidence` stores append-only submission statements, file references, submitting worker, and timestamps.
- `FinancialDispute.escalatedAt` records deduplicated escalation. Existing investigation, audit, and event fields are reused.
- Existing `StoredUpload` records store completion attachments with kind `completion-evidence`.

No collection replacement, balance rewrite, destructive migration, or required historical backfill is needed. Existing missing fields are tolerated. Existing open disputes are eligible for escalation based on their recorded opening date and evidence deadline. Nothing in this change runs a production migration or deploys the application.

## Verification

Regression coverage includes configured limits, insufficient balances, cross-account withdrawal attempts, retries after policy changes, concurrent duplicate reservations, completion evidence and resubmissions, unauthorized/unconfirmed payment release, concurrent exactly-once credits, notifications to both parties, escalation without fund movement, dispute resolution, private evidence downloads, multipart endpoint routing, and rejected-upload cleanup. Device-level Android picker/download and external provider transfer acceptance still require manual validation.

Validation results: all 486 backend tests passed when run from `server`; web and mobile TypeScript checks passed. Security/dependency, UI security, overlay centering, mobile theme/motion, and both locale checks passed. Changed JavaScript/TypeScript files have no ESLint errors; existing color-token warnings remain. The production build was blocked by sandbox filesystem access and permission to rerun outside the sandbox was declined. Browser withdrawal tests were updated, including a Finance-review case, but the browser run could not start because the configured client port was reported as occupied. These checks do not claim a production deployment or an Android device test.
