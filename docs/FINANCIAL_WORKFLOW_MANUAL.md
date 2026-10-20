# MicroJobs financial workflow manual

**Updated:** 21 October 2026  
**Audience:** workers, employers, Finance, Support and authorized administrators  
**Scope:** withdrawals, completion proof, payment approval and financial disputes on web and Android

This guide describes the implemented workflows. Available controls depend on your account role, assignment status and the running server's configuration. Button names below use English; the new controls and public dispute states also have Filipino translations.

## 1. How the workflows connect

For an ordinary assignment:

**Start work → Submit proof → Employer reviews → Request changes or confirm payment → Worker wallet receives payment → Worker may request a withdrawal.**

Submitting proof asks the employer to review the work. Confirming payment credits the worker's MicroJobs wallet. Withdrawing moves available wallet funds to an external destination through Finance or the configured transfer provider.

For a financial dispute:

**Open a case → Provide evidence → Support investigates → Finance proposes a settlement → A different authorized Finance user approves → Case is resolved.**

A resolved case can receive one eligible appeal before closure. An overdue case may be escalated for senior review; escalation does not pay or refund anyone.

## 2. Requesting a withdrawal — workers and employers

### Before you begin

Open **E-Wallet** in the appropriate account view. A dual-role account has separate employer and worker balances. Use the wallet containing the funds you want to withdraw.

Check the limits displayed in the withdrawal section. Web and Android obtain them from the same backend policy.

| Rule | Default behavior |
| --- | --- |
| Minimum | ₱100, unless the server is configured differently |
| Employer maximum | ₱50,000 per request, unless configured differently |
| Worker maximum | Available balance, unless a maximum is configured |
| Finance review threshold | Amounts above ₱50,000 require review; the threshold is configurable |
| Worker review | Every worker withdrawal requires Finance approval |
| User withdrawal fee | ₱0 in the current workflow |

Funds already committed to jobs, disputes or pending withdrawals are unavailable for a new withdrawal. The displayed policy and available balance govern your request.

### Submit your request

1. Enter the **Amount (PHP)**, using at most two decimal places.
2. Select or enter the **Bank or e-wallet** destination.
3. Enter the **Account name** and **Account number** carefully.
4. Select **Withdraw**. This prepares a preview; it does not reserve money yet.
5. Select **Continue** in the first confirmation.
6. In **Verify withdrawal details**, review the amount, institution, account name, masked account number, fee, remaining balance, review reasons and expiry time.
7. Select **I confirm that the amount and destination are correct.**
8. Select **Confirm withdrawal**.

The preview lasts five minutes from creation. If it expires, close it and prepare a fresh preview. The server also rechecks your balance, account and applicable policy when you confirm.

After a successful confirmation, the amount is reserved from the selected wallet. For example, confirming a ₱200 withdrawal from an ₱800 available balance leaves ₱600 available while the ₱200 request is processed.

Closing the preview before confirmation leaves your balance unchanged. If the result is uncertain after confirmation, refresh the wallet and check the existing request before creating another withdrawal.

### Why Finance may review the destination

Finance checks account-holder documentation or provider confirmation against the requesting user and exact destination. Your confirmation checkbox acknowledges the details you entered; Finance performs the ownership check separately.

Follow Finance's secure instructions for providing account-holder evidence. The withdrawal form itself does not provide an ownership-document upload control.

An employer destination may qualify for automatic processing when its matching ownership check is less than 90 days old, the amount qualifies under policy, the institution is supported and the transfer provider is enabled. A changed or unverified destination requires manual review. Worker withdrawals continue to require Finance approval even if the destination was checked previously.

### Understanding withdrawal status

| Status | Meaning and next step |
| --- | --- |
| Requested / under review | Money is reserved; Finance must review the request. Where **Cancel withdrawal** is offered, it is available only for a requested manual withdrawal. |
| Approved | Finance approved the manual withdrawal. The external transfer is still pending. |
| Processing | An automatic transfer is awaiting a confirmed provider outcome. |
| Paid | Finance recorded the completed external transfer, or the provider confirmed success. |
| Rejected | Finance rejected the request and the reserved funds were returned to their original wallet. |
| Failed | A confirmed automatic-transfer failure returned the reserved funds to their original wallet. |
| Cancelled | An eligible cancellation returned the reserved funds to their original wallet. |

A provider timeout can leave a request **Processing** while Finance reconciles its outcome. Processing does not establish that the bank received the money or that the transfer failed.

## 3. Processing withdrawals — Finance

Use the administrative payout-request screen with an account authorized to review payouts.

### Review and approve a manual request

1. Open the requested withdrawal and check its user, source wallet, amount, destination and review reason.
2. Examine account-holder evidence through the approved secure Finance process. Match it to the requesting user and exact destination; a matching name alone is insufficient.
3. Select **Approve**.
4. Enter the **Ownership evidence / verification reference**. Use the reference to the secure evidence or verification case, such as `OWN-2026-0042`.
5. Select **I verified that this destination belongs to the requesting user.**
6. Complete the approval.

The system records the check's reviewer, time and destination binding. Approval does not perform a manual bank transfer. An older approved request without an ownership check must pass the verification control before it can be marked paid.

### Record a completed manual transfer

1. Perform the external transfer through the authorized Finance process.
2. Verify the transfer outcome and retain its external reference.
3. Select **Mark paid** for the approved request.
4. Enter the actual **Transfer reference** and confirm.

The system requires a transfer reference before marking the request paid and stores it with the payout and linked financial transaction. An internal ownership-case reference and an external transfer reference serve different purposes.

If the request cannot be approved, select **Reject**, enter the required reason and confirm. The reserved amount returns to the original wallet.

### Handle an uncertain automatic transfer

Use **Reconcile** on an automatic request in **Processing**. Supply the provider transfer ID when needed. Reconciliation checks the provider's recorded outcome. Keep an uncertain transfer pending until its outcome is established; the system does not automatically resend an interrupted transfer.

## 4. Submitting completion proof — workers

1. Open the hired assignment in **Applied Jobs** or its assignment details.
2. Complete any applicable hiring/start requirements and select **Start work**.
3. When the work is finished, select the green **Submit proof** button.
4. Attach between **1 and 10 images** in JPG, PNG, GIF or WEBP format.
5. Keep each image within **5 MB** as displayed in the app: 5 MiB, or 5 × 1024 × 1024 bytes.
6. Optionally enter a description of up to **4,000 characters**.
7. Select **Submit proof** and wait for confirmation.

Completion proof requires images. A statement alone, PDF or Word document cannot replace them. Documents remain available for financial-dispute evidence.

After a successful submission, the assignment becomes **Submitted**, the employer receives a review notification and the proof appears in the job chat. Payment remains pending employer approval.

### Respond to a change request

Read the employer's feedback, make the requested changes and submit new proof when the assignment shows **Changes Requested**. Previous submissions, attachments, timestamps and the feedback attached to the reviewed submission remain in history.

For scheduled daily work, select the relevant work date and submit that date's proof. Daily approval applies to the selected date and does not complete the entire job.

## 5. Reviewing proof and paying — employers

### Pay an individual worker

1. Open the submitted assignment or its latest proof card in chat.
2. Review the job, assigned worker, amount, completion images and any previous feedback.
3. If corrections are needed, use **Request Changes** and explain what the worker should revise.
4. If the work is acceptable, use the payment action. The latest chat proof card offers **Mark the job as done?**
5. Read the confirmation: **Mark the job as completed? This will release the funds to the worker.**
6. Confirm only after reviewing the displayed proof and amount.

Successful ordinary payment credits the worker's wallet and marks the assignment **Completed / Paid**. It uses secured job funds. Payment authorization alone leaves the funds secured until settlement.

If a newer proof submission arrives before you confirm, the payment is rejected as stale. Refresh the assignment, review the latest submission and confirm again. Cancellation/dispute holds or insufficient secured funds can also block payment.

### Confirm several workers together

From the employer's job-management screen, use the posting's completion action and review each unpaid worker's amount and proof in the confirmation.

The system rechecks every affected assignment before releasing funds. A stale or blocked assignment prevents the batch from completing; review the updated information and retry. The batch does not partially pay the reviewed group when its transaction fails.

### Use mobile QR payment or daily approval

For mobile QR payment, scan or resolve the worker's request, review the job, worker, remaining unpaid amount and completion evidence, then confirm. A changed proof requires a fresh review.

For scheduled daily work, open the proof for the specific work date and use **Confirm and Pay**. Check that date and its amount. Paying one date leaves the overall job in progress.

### After successful payment

Both parties receive payment notifications with transaction details. Daily payments identify the work date. Email receipts are delivered through the configured email service and can arrive later if delivery needs to retry.

A delayed notification or email does not undo a successful wallet credit. Check the assignment and transaction history before attempting another payment.

## 6. Financial disputes — workers and employers

### Open or respond to a case

Workers can open eligible financial-dispute claims from the assignment workflow. For a nonpayment claim, the ordinary eligibility threshold is **72 hours after the first submission**. The application rechecks eligibility, payment status and existing holds; the time threshold alone does not guarantee that a claim is available.

Select the available dispute action, describe the problem and submit it. The worker-claim flow creates a linked Support ticket. An employer can respond and provide evidence for the case concerning their assignment.

Only one active financial dispute is allowed for an assignment. Opening a dispute can hold the affected unpaid funds while the case is reviewed.

### Submit evidence

1. Open the relevant case in **Financial Disputes**, or its available evidence action in assignment details.
2. Read the displayed evidence deadline.
3. Enter an evidence statement and/or choose one supported file. If you have nothing to provide, select **I have no evidence available**.
4. Submit the evidence and check the case history.

| Evidence purpose | Supported submission |
| --- | --- |
| Job completion | 1–10 JPG, PNG, GIF or WEBP images; optional description |
| Financial dispute | Statement, one JPG/PNG/WEBP/PDF/DOC/DOCX file, or an explicit no-evidence declaration |

The per-file limit is 5 MB as defined above. Participant evidence must be submitted before the case deadline. The normal evidence window is seven days. A case may progress before the window ends once both parties have contributed evidence or explicitly stated that none is available; Finance still needs the required investigation and approval steps.

Submitted evidence is retained in history. Rejected uploads do not become accepted case evidence. If the case changes while you upload, refresh it before retrying.

### Understand the six case states

| State | What it means |
| --- | --- |
| **Open** | A case has been opened. The worker-claim flow may move directly into review because it starts investigation immediately. |
| **Under Review** | Support is investigating, or Finance is reviewing a proposed settlement. |
| **Awaiting Evidence** | Support requested evidence from a participant. Check the deadline and respond. |
| **Escalated** | The case requires senior review after its configured review period and evidence window. Existing Finance approval steps still apply. |
| **Resolved** | Finance completed the authorized settlement or recorded an outstanding obligation. An eligible appeal may still be available. |
| **Closed** | Authorized staff closed the resolved case. Further appeals are blocked; evidence and decisions remain in history. Historical rejected cases also appear as Closed. |

Scheduled escalation has a default review period of seven days, subject to configuration and maintenance scheduling. It does not automatically pay, refund or penalize either party.

### Appeal a decision

If **Submit appeal** is available, explain why the decision needs another review and submit it before the case is closed. Each case supports one eligible appeal in total.

An accepted appeal reopens review and a fresh seven-day evidence opportunity. Previous decisions and evidence remain visible, but each party must contribute to the new evidence window or explicitly state that no evidence is available. An appeal does not itself reverse an earlier transfer.

## 7. Investigating and resolving disputes — staff

### Support investigator

1. Open the case in the administrative **Financial Disputes** screen.
2. Assign the case to an authorized investigator, or use **Assign to me and investigate** when permitted.
3. Review the job, assignment, payment records, completion history and dispute evidence.
4. Request evidence when needed. Check the existing deadline and use participant-visible communication for information both parties should receive.
5. Complete the investigation report and use **Complete report and forward to Finance**.

Support establishes and documents the facts. Its investigation controls do not authorize payment or refund settlement.

### Finance reviewer and independent approver

After the investigation report is complete, Finance can propose one of three existing outcomes:

| Outcome | Purpose |
| --- | --- |
| Full refund | Return eligible held funds to the employer. |
| Complete payment | Release the applicable remaining payment to the worker. |
| Partial payment | Record the approved allocation between worker payment and employer refund. |

Enter the required amounts and written decision reason, then submit the proposal for approval. A different authorized Finance user must review and approve it before settlement processing.

Review the funds classification carefully. **Funds held** are controlled by MicroJobs. **Outstanding payment** records an obligation outside the platform; recording it does not place that money in escrow or establish that it was transferred.

### Close a resolved case

An authorized Support/Admin user can select **Close resolved case** after the settlement is recorded. Enter a reason and review the closure confirmation. Closure prevents further appeals and moves no money. Active investigations cannot be closed through this control. The case's audit history retains the reason and staff actor.

## 8. Access, language and common problems

Completion and dispute attachments are available only to the relevant worker, employer and authorized staff. Sign in to view or download them. On Android, use the evidence save action and grant access to the folder where you want to save the file.

| Situation | What to do |
| --- | --- |
| Withdrawal amount is rejected | Check the current displayed minimum/maximum, available balance and decimal places. |
| Preview expired or policy changed | Close the old preview, prepare a new one and review its details again. |
| Destination needs ownership review | Follow Finance's secure evidence instructions and wait for its review. |
| Withdrawal remains Processing | Give Finance the existing request/provider reference so it can reconcile the transfer. |
| Completion upload fails | Check image format, count, size and assignment status. Retry after a storage outage is resolved. |
| Payment reports newer evidence | Refresh and review the latest proof before confirming again. |
| Evidence deadline passed | Contact the assigned Support investigator about the case's next step. |
| Attachment cannot be opened | Sign in with an authorized account. Contact Support if access should be allowed. |
| Receipt or notification is delayed | Check payment/transaction status; delivery can retry separately. |

## 9. Related documents

- [Main user manual](USER_MANUAL.md)
- [Implementation and verification record](financial-workflow-alignment.md)
- [Completion upload and private-storage contract](COMPLETION_EVIDENCE.md)
- [Scheduled long-term daily work](LONG_TERM_DAILY_WORK.md)
- [Lifecycle policy](lifecycle-policy.md)
