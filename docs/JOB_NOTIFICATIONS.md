# Job notifications

The existing notification feed, authenticated Socket.IO user rooms, Expo push
delivery, and durable notification outbox handle job activity on web and mobile.

| Event | Recipient | Destination |
| --- | --- | --- |
| Employer sends an offer | Offered worker | Employer conversation for that job |
| Worker accepts an offer | Offering employer | Worker conversation for that job |
| Employer confirms hiring with a checklist | Hired worker | Employer conversation containing the checklist |
| Worker requests assignment cancellation | Owning employer | Specific assignment, including its cancellation controls |
| Worker files a financial dispute | Owning employer; filing worker receives confirmation | Specific financial-dispute case |

Checklist notifications are created only when a nonempty checklist is persisted.
Each hired worker has their own checklist and notification. The existing hire
notification remains separate.

Before-start cancellation retains its existing immediate resolution policy. Its
notification explains that no response is needed. Started-work cancellation
retains the existing response deadline and payment-agreement requirements.

Notifications are queued inside the originating database transaction and delivery
is attempted immediately after commit. Failed deliveries stay in the outbox for
maintenance retries. Stable delivery keys prevent duplicate feed records. Push
delivery remains at least once; clients reconcile updates using notification IDs.

Conversation links carry both participant and job IDs. Cancellation links carry
application and job IDs so the employer opens the correct posting before viewing
the assignment. Dispute links carry the dispute ID. Target pages retain their
existing ownership and participant authorization checks.

Opening a feed notification marks it read through the existing authenticated,
audience-scoped endpoint. Mobile push opens also mark the associated notification
read and refresh the notification count after navigating.

Deploy the backend, web client, and mobile client together for consistent links.
No new credentials are required. Actual push delivery still requires the existing
registered device and push-service configuration; socket delivery requires an
active authenticated connection.
