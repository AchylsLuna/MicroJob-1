# Financial workflow alignment — 2026-10-21

This change extends the existing wallet, settlement, completion, dispute, notification-outbox and permission systems. It does not deploy services, transfer real money, change live environment settings, or run a production migration.

## Withdrawals

Both clients obtain policy from `GET /api/payment/withdrawals/policy?sourceWallet=WORKER|EMPLOYER`. The fallback minimum and `.env.example` are PHP 100; existing server environment overrides continue to take precedence. Employer maximum defaults to PHP 50,000; worker maximum defaults to available balance. Both are configurable. Amounts above the configured review threshold require Finance review, and worker withdrawals always require it. Preview and confirmation enforce the same policy.

`POST /api/payment/withdrawals/preview` returns a signed five-minute quote and `expiresAt`, amount, masked destination, zero user fee, total debit, remaining balance, and review reasons. English/Filipino reason codes are translated on each client. Preview never reserves funds. Confirmation verifies the signature, purpose, user, expiry, current ownership-check validity, policy, active account/role, and available balance before one atomic reservation. A consumed preview remains idempotent after policy changes.

Destination ownership is a manual Finance check against account-holder documentation or provider confirmation, with a secure evidence/case reference. Details confirmation or a matching account name is insufficient. Finance approval requires `ownershipConfirmed: true` and `ownershipVerificationReference` (1–200 characters). The API binds the check to the requesting user and exact method, institution, account name, number, and BIC using a SHA-256 fingerprint, recording the reviewer and time on `PayoutRequest.ownershipVerification`.

Automatic employer transfers require a matching approved/paid ownership check less than 90 days old, supported provider institution, configured provider credentials, and the existing dispatch/reconciliation safeguards. An unverified or changed destination goes through manual Finance review. A check expiring between preview and confirmation rejects the old quote. Worker requests remain manual. References identify evidence held through the existing secure Finance process; this does not introduce a bank ownership-verification API or claim independent provider verification.

Manual `paid` requires an approved, ownership-verified request and an external `transferReference`; it records that reference on both payout and ledger transaction. Older approved requests without ownership checks can be verified again through the approval control. Already processing provider transfers retain their reconciliation path. Rejections/refunds preserve the original wallet and existing exactly-once rules.

## Completion and payment

Per the confirmed requirement, completion remains image-only: 1–10 JPG/PNG/GIF/WEBP images, at most 5 MiB each, with an optional description of up to 4,000 characters. Documents and no-evidence declarations are for disputes. See [Completion evidence](COMPLETION_EVIDENCE.md) for Azure configuration, signature checks, private downloads and cleanup.

Completion submissions remain append-only, identified by submission timestamp; each attachment retains its actor, filename, type, and private URL. Change requests now attach employer feedback, actor and timestamp to the relevant submission. Older images and feedback survive resubmission and are shown in web/mobile history. New images remain in private Azure storage. Legacy database-backed files remain readable.

Individual, batch and mobile QR confirmations display the worker, job, current amount and completion images. Ordinary settlement requires the reviewed `submittedAt` whenever the assignment has a recorded submission timestamp. Web/mobile confirmations now send the timestamp from the actual preview. Batch completion sends `payments: [{ applicationId, submittedAt }]` to the existing job-status endpoint and rechecks all assignments inside one transaction; a stale revision aborts the whole batch. Legacy submitted records without a timestamp remain payable without fabricated history. QR previews use the remaining unpaid amount from the ledger.

Both parties' payment feed/push notifications are queued within the balance transaction and attempted after commit for ordinary, batch, QR and daily payments. Notifications include transaction ID/reference, amount, job, worker and payment time; daily notifications include the work date. Existing durable keys prevent duplicate feed entries. Separate email receipts retain their independent retry behavior.

## Six public dispute states

The API exposes a stable `caseStatus` and English `displayStatus`. Web/mobile translate `caseStatus`. Existing investigation/Finance stages and legacy `status` remain in place to preserve permissions, approval gates, reporting and historical data.

| Public state | Trigger / allowed next action |
| --- | --- |
| Open (`open`) | An opened case not yet under investigation; Support assignment starts review. The existing worker-claim path starts investigation and creates its linked Support ticket immediately. |
| Under Review (`under_review`) | Support investigates or Finance reviews/proposes/independently approves; an evidence request enters Awaiting Evidence. |
| Awaiting Evidence (`awaiting_evidence`) | Support requests a participant's evidence; accepted evidence returns to review, subject to the case's deadline. |
| Escalated (`escalated`) | Scheduled maintenance detects an overdue active case after its evidence window; senior staff and both parties are notified once. Existing Finance approval/appeal stages are retained. |
| Resolved (`resolved`) | The existing independent Finance settlement completes or records an outstanding obligation; eligible participants may appeal once, reopening review. |
| Closed (`closed`) | Authorized Support/Admin closes a resolved case with a recorded settlement and written reason; historical rejected records also map here. Closure is audited, prevents appeals, and moves no money. |

`POST /api/admin/finance/disputes/:disputeId/close` requires `finance.disputes.investigate`, a 1–2,000 character reason, `active: false`, a resolved legacy status, and a verified or recorded-outstanding settlement. Active cases cannot be administratively closed through this endpoint. Escalation also never credits, refunds, penalizes or otherwise moves funds.

Dispute evidence accepts statements, one permitted file up to 5 MiB, or an explicit no-evidence declaration. Files retain the existing JPG/PNG/WEBP/PDF/DOC/DOCX contract and signature checks. Participant/staff authorization protects uploads and downloads; rejected, oversized, invalid, expired or concurrently changed cases do not retain rejected uploaded files. Before attaching an upload, the API rechecks the active state, investigation stage, assigned investigator and participant deadline atomically. Web downloads send the current cookie/bearer credentials; Android downloads use the authenticated native transport.

Appeals preserve decision/report history, reopen a seven-day evidence opportunity and reset the senior-review clock. Prior submissions remain in history but do not count as either party's contribution to the new appeal window. Scheduled escalation uses the appeal time for reopened cases.

## Verification

| Check | Result |
| --- | --- |
| Server suite (`npm test --prefix server`, now limited to two test files at a time) | **558 passed, 0 failed, 0 skipped** |
| Focused lifecycle/workflow suite | **58 passed**; includes expiry, ownership binding, transfer references, stale batch/QR confirmations, image history/feedback, upload size/deadline cleanup, permissions and escalation |
| `npm run typecheck:web`, `npm run typecheck:mobile` | Passed |
| `npm run check:web-locales`, `npm run check:mobile-locales` | Passed; includes new English/Filipino keys and interpolation parity |
| Focused ESLint, full `npm run lint`, updated browser-test ESLint | Passed with no errors; existing color-token warnings remain (56 focused, 756 full-repository warnings) |
| Security, UI security, overlay centering, token drift, mobile theme, auth accessibility and motion checks | Passed; security retains the repository's documented Expo/Metro tooling exceptions |
| `npm run build:client` | Passed outside the filesystem sandbox; final command exited 0 and Vite built 2,307 modules |
| Playwright withdrawal, participant-dispute and staff-dispute suites (`--project=app`) | **12 passed** using installed Chrome through `PLAYWRIGHT_CHROMIUM_PATH`; includes authenticated document download, keyboard/accessibility/responsive checks, ownership review and preview expiry display |
| `git diff --check` | Passed |

`npm run verify` executed all checks through the server suite successfully, then its sandboxed Vite build failed on filesystem access to the config. The build was rerun successfully with the required permission. An earlier highly parallel API run hit a temporary MongoDB `fassert` startup failure; setting `--test-concurrency=2` made the complete 558-test run pass. Browser startup initially hit the same sandbox restriction and then a missing Playwright-managed binary; the successful run used existing Chrome outside the sandbox. No host packages or browser downloads were installed.

Provider/Azure behavior is mocked by the automated tests; live private-container, external-transfer and Android-device smoke tests remain separate deployment checks. Docker is not installed in this environment, and the checkout does not contain the `server/Dockerfile` referenced by `AGENTS.md`; no container build/run was possible. No production deployment, real payout, external email, database migration or live environment edit was performed.
