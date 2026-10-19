# Completion images and employer approval

Scheduled long-term jobs have date-specific proofs and **Confirm and Pay** approval; daily approval never completes the job. See [Long-term daily work](LONG_TERM_DAILY_WORK.md) for the calendar, funding, daily submission contract, and 12-hour reminder checker. The ordinary completion flow described below continues for short-term, side-hustle, and existing unscheduled assignments.

Workers select the green **Submit proof** button after starting their hired assignment, or after an employer requests changes. In Applied Jobs it shares one action row with View details, Assignment details, and any eligible payment-dispute action; narrow screens allow horizontal scrolling. The upload dialog also uses a green Submit proof button, and chat labels the sent submission as proof. Both web and mobile require 1–10 JPG, PNG, GIF, or WEBP images, each at most 5 MiB (5 × 1024 × 1024 bytes, displayed as 5 MB in the UI). A description is optional and accepts up to 4,000 characters. Text-only submissions and documents are rejected for completion; financial-dispute evidence continues to accept its existing document formats.

## Server configuration

Set these in the API server environment, then restart the API:

```dotenv
AZURE_EVIDENCE_CONNECTION_STRING=""
AZURE_EVIDENCE_CONTAINER_NAME=""
```

Use the connection string for the intended Azure storage account and an **existing private blob container**. The credentials need blob read, write, and delete access. Keep anonymous blob access disabled. These settings are independent of avatar storage and must never be placed in client or mobile environment variables. See [Microsoft's JavaScript upload documentation](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-upload-javascript) for the underlying SDK operations.

Missing evidence configuration blocks new submissions with HTTP 503. Failed uploads leave the assignment unsubmitted. There is no silent MongoDB fallback for new completion images. Uploaded blobs are removed if the submission fails; process crashes or a failed cleanup operation may require orphan-blob reconciliation. Existing completion files in MongoDB remain readable through their existing URLs.

### Troubleshooting uploads

Copy the full, unmodified connection string from **Storage account > Access keys**. Its usual prefix is `DefaultEndpointsProtocol=https;`. HTML entities such as `&#x6C;`, extra line breaks, and trailing backslashes are invalid. Put both evidence settings in the running API's environment and restart the API after changing them.

The configured container must exist in that same account and have **Private (no anonymous access)** selected. Account-key connections require **Configuration > Allow storage account key access** to be enabled. Storage networking must allow the API server's network or outbound IP through an approved route. Browser CORS settings are not needed for these uploads because the API server communicates with Azure.

Azure configuration/upload failures return HTTP 503 with a specific, credential-free explanation. Server logs use `Azure evidence storage failure` with only the operation, Azure error code, and status. `ContainerNotFound` means the account/container combination is wrong or the container is missing; `KeyBasedAuthenticationNotPermitted` means key authentication is disabled; `AuthenticationFailed` points to credentials; `AuthorizationFailure` can indicate network restrictions. Unexpected database/application failures remain HTTP 500 and log `Application payment action failed` with only the route and error name/code. Never log or share the complete Azure error object or connection string. See [Microsoft's Azure 403 troubleshooting guide](https://learn.microsoft.com/troubleshoot/azure/azure-storage/blobs/authentication/storage-troubleshoot-403-errors).

## Submission and chat

`POST /api/applications/:applicationId/work/submit` accepts multipart data with repeated `evidence` file parts and an optional `statement` field. Scheduled daily proof also includes `workDate` (`YYYY-MM-DD`); the multipart parser accepts both text fields together, including an empty statement. More than two text fields are rejected with a text-field error instead of an image-selection error. The API enforces count, size, allowed image extensions/MIME types, and image signatures. It assigns unique blob names even when several images have the same original name.

After uploading, a database transaction rechecks worker ownership, assignment state, cancellation/dispute holds, and payment state, then appends the evidence history, marks the work Submitted, creates a `completion_evidence` chat message, resurfaces the participants' archived conversation, and queues the employer notification. The message contains the submitted images and application/submission references. Connected participants receive the chat message through the existing socket events; persisted history supports reconnects.

Image URLs use `/uploads/:fileName`. The API authorizes the worker, owning employer, or staff with `finance.disputes.view` before reading the private Azure blob. Responses are private and uncached. Web previews fetch with the app's cookie/bearer transport and use temporary object URLs; native previews send a bearer header. No public blob URL or storage credential is sent to clients.

## Completing the assignment

Starting work queues an employer notification saying **Work in progress**. Submitting valid proof queues **Work finished — ready for review**; daily proof names the specific work date. Both attempt delivery immediately after the work transaction commits, creating the employer's notification-feed entry and using the existing socket/push delivery. Failed delivery remains in the outbox for maintenance retries. Submission still means awaiting employer review, and never releases payment by itself. Applied Jobs refreshes after Start work on both web and mobile so Submit proof becomes available.

The employer's latest submission card displays the green **Mark the job as done?** button. It opens this confirmation:

> Mark the job as completed? This will release the funds to the worker.

Cancel closes the popup without releasing funds. Confirm calls `POST /api/applications/:applicationId/payment/settle` with `confirmed: true` and the card's `submittedAt` value. The existing settlement service checks employer ownership, submitted work, cancellation/dispute holds, available escrow, and duplicate payment. The timestamp prevents approval of a newer revision from an older chat card. Funds are credited to the assigned worker's wallet exactly once. The assignment becomes Completed/Paid; posting completion continues to follow the existing rules for all hired workers.

## Verification

Successful direct/QR, posting-completion, and daily job payments also queue separate email receipts for the owning employer (payment sent) and assigned worker (payment received), using the existing payment receipt service. Receipts contain the job, amount, public receipt number, Manila payment time, and daily work date when applicable. Authorization alone never generates a completed-payment receipt. Emails are queued inside the balance transaction and attempted only after commit. Each recipient has a separate durable outbox entry, so a failed email retries through maintenance without undoing payment or resending the other recipient's completed entry. Configure the existing server-side email provider settings (`RESEND_API_KEY` or SMTP settings, plus an appropriate sender); missing configuration leaves receipts pending. No credentials belong in client/mobile configuration. A process crash after provider acceptance but before the outbox records completion can cause a repeated email; the public receipt number stays the same.

Payment authorization immediately attempts the worker's **Payment authorized** notification, explaining that funds are still secured. Successful direct, QR, posting-completion, and daily payments immediately attempt the worker's payment notification after the balance transaction commits. Daily messages identify the work date; ordinary messages include the job and credited amount. Existing delivery keys prevent duplicate feed entries, and failures remain retryable without reversing an authorization or credit.

The focused lifecycle, settlement, and Azure storage tests exercise image requirements, same-name multiple uploads, image validation, interrupted-upload cleanup, private downloads, chat attachments, revision history, stale approval rejection, employer-only confirmation, and duplicate-safe worker payment. Azure is mocked in tests; deployment still requires a smoke test against the configured private container. Native image picking and upload should also be checked on a device.
