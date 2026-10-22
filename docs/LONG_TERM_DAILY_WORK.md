# Long-term daily work

New long-term opportunities use the existing `Recruiting` job type with `paymentMode: daily`. Employers select 2–366 individual work dates on the calendar and enter a daily guaranteed rate of at least PHP 480 per worker. Dates use `YYYY-MM-DD` in **Asia/Manila**; they may be nonconsecutive. New dates must be valid, unique, and today or later. Short-term and side-hustle opportunities retain their single-assignment payment flow and PHP 50 minimum.

## Funding and hiring

Employers select a start and end **work time per day** using time pickers beside the work-date controls. One shift applies to every selected date, using Asia/Manila clock time. `workStartTime` and `workEndTime` are required `HH:mm` values for new daily postings. Equal or invalid times are rejected. An end time earlier than the start is the following day: `22:00`–`06:00` means eight hours. Duration includes the full interval; no break is automatically deducted.

Listings, saved/applied jobs, details and offer schedules show the daily rate, time range, duration, and informational hourly rate. The public job response includes the saved times and derived `workMinutes`, `workHours`, and `hourlyPay` for valid daily shifts. Hourly pay is daily pay divided by elapsed hours, **truncated to two decimal places**, never rounded upward (PHP 500 over three hours displays PHP 166.66/hour). Posting and settlement still use the agreed daily rate; hourly display does not change escrow or payouts. Offers and hires lock the work times alongside the selected dates. Existing daily records without saved times show no invented shift or hourly rate; an employer can add times before any offer or hire.

The posting form shows the selected-date count without a separate list of date chips beneath the calendar. Dates stay selected in the calendar. Selecting or removing work dates automatically updates the deadline date to the latest remaining work date; clearing the selection clears that date. Existing scheduled drafts also initialize the deadline from their last work date. Short-term and side-hustle deadline selection remains manual.

The employer funds **daily rate × selected dates × worker positions** upfront. The existing PHP 20 posting fee and optional PHP 50 highlight fee are added separately, once per listing. Example: PHP 480 × 3 dates × 2 workers secures PHP 2,880 for worker pay; posting without a highlight costs PHP 2,900 in total.

`salary` is the daily rate on these jobs. Formal offer `amount` is also a daily rate. An increase secures `(offer rate − posted rate) × dates` for that worker. At hire confirmation, the application snapshots the dates and daily amounts in `dailyPayments`, stores `agreedDailyRate`, and sets `agreedAmount` to the total over all dates. Offers and hires lock the schedule. Hiring must happen by the first work date; a schedule that has already started must be posted again with new dates before a new offer or hire.

Before any offer or hire, schedule/pay/position edits debit or refund the change in total required escrow. Pending offers and hires retain their existing locking rules. Vacant slots remain funded for all dates; paid days are deducted from an ongoing worker's remaining funding requirement. Cancellation refunds and dispute snapshots preserve earlier daily payments and operate on the remaining unpaid amount.

## Daily proofs and approval

The worker starts the assignment through the existing **Start work** action. **Submit proof** then offers scheduled, unpaid dates up to the current Manila date. The worker selects the work date and attaches 1–10 supported images (5 MiB maximum per image). An optional description accepts up to 4,000 characters. A past scheduled date can be submitted late; future, foreign, or already-paid dates are rejected. A worker can revise unpaid daily proof without preventing submission for another day.

`POST /api/applications/:applicationId/work/submit` accepts the existing multipart `evidence` and `statement` fields plus `workDate` for daily jobs. Upload validation, private Azure storage, authorization, rollback cleanup, and image download rules are unchanged. Each image's evidence-history record retains its `workDate` and server-assigned `submittedAt` timestamp.

Each submission appends a proof card to the **same worker/employer/job chat**. Cards show the work date and exact submission date/time in Asia/Manila. Daily offer cards show the schedule and rate; after work starts, the worker can also submit proof from that chat. Both participants can view the daily schedule and paid/pending states in Assignment details.

The employer selects **Confirm and Pay** on a daily proof card. The popup names the work date and amount and states that the job status stays unchanged. Cancel releases nothing. Confirm sends:

```http
POST /api/applications/:applicationId/payment/settle
Content-Type: application/json

{"confirmed":true,"workDate":"2026-10-19","submittedAt":"2026-10-19T08:30:00.000Z"}
```

Only the owning employer can approve. The service rechecks the latest proof revision, cancellation/dispute holds, agreed total, payment consistency, and escrow inside a transaction. `daily-payout:<applicationId>:<workDate>` identifies the completed ledger entry, preventing duplicate credits during retries or concurrent confirmations. The day's full agreed amount is credited immediately to the worker E-Wallet. External withdrawals retain their existing separate process.

Daily payment changes the day's `paidAt`, cumulative `paidAmount`, and payment status (`Partially Paid`, then `Paid` when every scheduled date is paid). It **never changes the posting status, assignment work status, or completion timestamp**, including on the last paid date. The ordinary whole-assignment settlement/authorization routes reject scheduled daily work. Payments made outside the daily schedule require Finance reconciliation before a further daily release.

## Pending-payment reminders every 12 hours

`checkPendingDailyPayments()` in `server/services/dailyPayments.js` scans submitted, unpaid daily entries whose reminder time has arrived. It queues employer reminders only; **it never releases money**. Entries first become due 12 hours after submission; the checker runs every 12 hours, so notification delivery depends on the next scheduled check. It skips held, disputed, cancelled, and paid assignments. Per-entry due timestamps and transactional outbox keys prevent duplicate reminders across overlapping server processes or cron invocations. Missed intervals after downtime result in one current reminder per due entry, followed by the next 12-hour interval.

The long-running API starts the checker after database initialization and on every subsequent 12-hour interval, stopping its timer on shutdown. The immediate startup check catches overdue entries after a restart. No new package, host cron, or cloud automation is required for the existing API container.

Serverless deployments use `GET /api/cron/daily-payment-reminders`, scheduled in `vercel.json` as `0 */12 * * *`. It requires `Authorization: Bearer <CRON_SECRET>` and returns HTTP 503 when the secret is absent, or 401 when credentials do not match. Keep the secret in server configuration. Reminder delivery uses the existing notification outbox; failed delivery remains retryable. The existing short-term reminder cron remains unchanged.

## Existing data and verification

Existing unscheduled `Recruiting` records default to `paymentMode: assignment`. Their existing escrow and single-payment assignments are preserved; they are not silently multiplied or retroactively converted. New `Recruiting` creation and reposting require dates and valid work times. An existing posting without offers/hires can adopt daily work by saving a valid schedule and work times, with the funding difference collected transactionally. Reposts accept newly selected `workDates` rather than replaying historical dates. The repost endpoint accepts new `workStartTime`/`workEndTime` values, defaulting to the original shift when those values are omitted; legacy postings without a shift must supply one.

Regression coverage: `server/tests/lib/workTime.test.js`, `server/tests/controllers/dailyPayments.test.js`, the existing escrow/lifecycle/settlement suites, and `tests/e2e/long-term-daily-pay.spec.ts`. These cover overnight/partial-hour duration, hourly truncation, invalid times, locking after an offer, unchanged escrow on time-only edits, and listing/picker display. Azure is mocked in server tests. A device smoke test for the native time picker and upload test against the deployment's private Azure container remain necessary when deploying, as with ordinary completion evidence.
