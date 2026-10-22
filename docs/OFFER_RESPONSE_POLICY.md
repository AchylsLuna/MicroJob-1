# Offer response deadlines

New formal offers reserve a position until the worker responds or the pending offer expires. The default response window is 48 hours, capped by the posting deadline. The API returns the saved `expiresAt` value in offer responses, application lists, and chat attachments. Web and mobile display this deadline in Asia/Manila and disable acceptance once the deadline passes. The API checks the deadline independently of the UI and scheduler.

Server configuration (project policy values):

| Setting | Default | Meaning |
| --- | --- | --- |
| `OFFER_RESPONSE_HOURS` | `48` | Response window for new offers; positive hours, at most 8760 |
| `OFFER_REMINDER_BEFORE_HOURS` | `24` | Hours before expiry to remind the worker; `0` disables reminders |

For shorter response windows, the reminder lead time is capped at half the actual window. For example, an offer limited to 12 hours receives its reminder after 6 hours when the configured lead is 24 hours. Invalid configuration rejects new offers without reserving a position or moving funds. Existing offers retain their saved deadline after configuration changes. Legacy offers with no deadline retain their existing terms; accepted and hired offers never expire under this response policy.

Lifecycle maintenance queues one reminder for an unanswered offer. The notification opens the participant's offer conversation. At expiry, a MongoDB transaction rechecks that the offer is still pending, marks it Expired, returns the application to Shortlisted when it remains in Offer Sent, records a timeline event, refunds only the negotiated extra funding to its original employer wallet, and recalculates reserved capacity. Base listing funding and other workers' secured funds remain reserved. Manual recruitment closure is preserved. Worker and employer receive expiry notifications through the existing outbox; connected participants also receive the offer-update socket event.

Acceptance, cancellation, and expiry cannot release the same reservation or refund the same funding twice. Expiry is deferred during cancellation/dispute holds or inconsistent funding, and maintenance reports the error count for reconciliation. An overdue offer cannot be accepted while its funds await safe release. A worker response to an overdue offer also attempts expiry before returning HTTP 409; replacing an overdue offer for the same application performs the same cleanup first.

Scheduled delivery/release depends on the existing maintenance job and queue backlog. This flow never deletes offers or applications and does not change accepted employment terms or pay a worker automatically.

Focused tests cover configurable timing, exact deadline boundaries, duplicate reminders, concurrent expiry, acceptance/cancellation races, daily-rate refunds, hold/reconciliation behavior, legacy compatibility, scheduled notification delivery, and matching web/mobile expiry status.
