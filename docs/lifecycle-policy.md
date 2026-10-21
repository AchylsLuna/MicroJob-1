# Job lifecycle and wallet operations — draft policy 2026-10-16

Operational draft for legal review before production activation. These rules describe
the implemented workflow and do not assert legal entitlement or replace applicable law.

## Hiring and cancellation

Employers may require interviews. A completed required interview precedes a formal
offer; worker acceptance and employer confirmation precede a worker starting work.

The first confirmed hire sets the posting to **In Progress**, even when other
positions remain vacant. Each hired worker retains a separate **Not started**
assignment until choosing Start work. Further hires and offer responses preserve
the posting's In Progress phase.

An employer may attach an optional, worker-specific checklist during hire
confirmation. Its descriptions are sent through job chat without checkboxes.
Employer-only completion marks in Job Management details are advisory tracking:
they never change job status or gate evidence submission, completion, or payment.

Recruitment remains open on Available or In Progress postings only while the
deadline is in the future, the posting is not archived, manually closed, or under
cancellation, and hired workers plus pending/accepted offers remain below the
number of positions. Discovery, recommendations, application submission, matching
notifications, and available-job counts use this rule. Public job responses expose
`recruitmentOpen` and `availablePositions`, without participant identities.

Web and mobile posting actions show recruitment availability and remaining
unreserved slots. An employer can close or reopen recruitment for an In Progress
posting with remaining slots. Reopening requires those vacancies to remain fully
funded and the deadline to remain valid. A before-start cancellation frees its
funded slot; the job remains In Progress while any other hired assignment remains.

Mark done closes recruitment and settles submitted hired assignments through the
existing guarded payment service. Resolve pending/accepted offers first. A partially
filled posting can complete when recruitment is deliberately closed and every
hired worker is paid/completed. Closing recruitment after those payments also
finalizes the posting. Remaining secured funds are returned to their original
wallet sources once; the existing legacy-source reconciliation guard still applies.
The accepted amount and policy version are recorded. Both parties retain messaging.

Before starting work, either party may cancel with a reason. After starting work,
cancellation requires agreement on a worker payment between zero and the agreed
amount, or a reasoned Finance decision. A request rejected or unanswered for 72 hours
is escalated. Unresolved funds remain held. A whole-post cancellation stops recruiting
immediately and resolves each hired assignment without reversing previous payments.

Before-start assignment cancellation keeps the base vacancy funded. A cancellation
after starting closes recruiting for that posting and refunds the unused assignment
allocation, preventing a partially consumed position from being promised again.
Job funding records retain the employer/worker wallet contributions. Refunds return
to those wallets; unknown legacy contributions for dual-role accounts require review.
Historical postings are copied through Post again, never cleared or overwritten.

## Payment and disputes

Job payment credits a worker's platform balance; withdrawal transfers funds to an
external destination. Employers confirm payment recipient and amount before release.
Submitted work triggers employer notification and reminders at 24 and 48 hours.
Nonpayment cases become eligible 72 hours after the first submission. Other financial
cases may be filed immediately. Revisions and disputes pause reminders, not eligibility.

Both participants have seven days to submit evidence or state that none is available.
Staff may decide earlier only when both have submitted. Staff review available job,
offer, submission, communication, and transaction records and record reasons. Missing
evidence alone never grants a refund or payment. Contested unpaid funds are held;
unrelated assignments continue. Resolution records remain available for audit.

## Withdrawals

Employer unused available funds may be withdrawn without first posting a job.
All withdrawals require Finance approval before transfer. Job escrow, disputed allocations, and pending withdrawals
are unavailable. Confirmation and details review are required; there is no additional
password or OTP requirement. Review does not establish external account ownership.

Both wallets accept PHP 50 to PHP 50,000 per request, subject to available balance.
Finance approves each request, transfers the funds externally, and records a transfer reference before marking it paid. Provider transfer fees are absorbed by the
platform; the user-facing withdrawal fee is zero. A withdrawal does not reverse fees
already charged for top-ups. Both worker and employer withdrawals require manual Finance review.
Failed or canceled withdrawals return reserved funds to their original wallet once.
Automatic transfers are never marked paid merely because a request was accepted.

## Deployment and verification

1. Back up the database. Run `npm --prefix server run migrate:lifecycle` for a dry run.
   Review orphaned applications, counters, `jobPhaseDifferences`, and ambiguous
   balances. The phase report identifies legacy Available/Closed postings with
   confirmed hires that should become In Progress. With approval to
   apply reviewed repairs, run the same command with `-- --apply`. No balance repair
   or deletion is performed by this migration.
2. Production MongoDB must support transactions (replica set or Atlas). Deploy
   additive API/model changes with updated clients. Review all new legal text before
   activating the new financial workflows for production users.
3. Automatic transfers are disabled by default. Configure PayMongo transfer access,
   a funded wallet, callback secret, and callback URL. Run sandbox transfer scenarios,
   including duplicate callbacks, failure and timeout, then explicitly enable transfers.
   Do not send live money as part of a deployment smoke test.
4. The PayMongo callback URL is `/api/payment/transfers/webhook`. Signatures are checked
   against the raw request body. Callback hints are independently verified through
   the provider's authenticated retrieve-transfer API before financial updates.
5. Add GitHub repository secrets `MICROJOBS_API_ORIGIN` (origin without `/api`) and
   `MAINTENANCE_SECRET`, matching the API secret. Enable the maintenance workflow on
   the default branch. It runs every 15 minutes, with catch-up and deduplication.
   Scheduler delays can delay notifications; eligibility uses server timestamps.
6. Monitor failed workflow runs and maintenance response fields `failedDeliveries`,
   `notificationBacklog`, `uncertainTransfers`, and `transferErrors`. Finance can
   reconcile a transfer using its provider ID after verifying it in the provider
   dashboard. Unknown outcomes retain reservations and are never blindly resent.

Notification records are deduplicated. External push delivery is at-least-once: a
crash after provider acceptance can result in a repeated push, with the same
notification ID. Automatic withdrawals retain a persisted dispatch claim so a
process crash cannot cause an automatic second transfer.
Provider integration references: [PayMongo transfer API guide](https://docs.paymongo.com/docs/money-movement-moving-money-with-api),
[webhook signature verification](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management),
and [transfer test cases](https://docs.paymongo.com/docs/transfer-test-cases).
User withdrawal fees and absorbed provider fees are stored separately; transfer and rail references are retained for reconciliation.

See [verification results and remaining release gates](lifecycle-verification.md) for the current test and dependency audit results.
