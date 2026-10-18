# Optional hire checklists

Employers can add a separate checklist when confirming each accepted offer in web/mobile Applications or job chat. The editor has Done and Description columns, removable rows, and an Add row button. Done is disabled before hiring; all tasks start unchecked. An enabled empty checklist requires a description or disabling the option. Blank editor rows are omitted.

## API and storage

- `POST /api/job-offers/:offerId/confirm-hire` accepts optional `{ "checklist": ["Sweep the path", "Collect litter"] }`. Omission or `[]` preserves hiring without a checklist. The API rejects non-arrays, more than 20 descriptions, non-string or blank items, and descriptions longer than 500 trimmed characters. Clients cannot set initial completion flags.
- `JobApplication.hireChecklist` stores subdocuments with generated `_id`, trimmed `description`, and `completed: false`. Checklists belong to individual applications, not to the whole posting. Existing applications default to an empty array; no migration or new environment settings are required.
- A nonempty checklist creates a job-scoped employer-to-worker `Message` with attachment type `hire_checklist`, application reference, job title, and a description-only string array. The hire, application checklist, chat message, conversation unarchive, and notification outbox writes share the existing hire transaction. A message-write failure rolls back the hire. Repeat confirmation cannot create a second checklist message for the resolved offer.
- After commit, existing Socket.IO events update both participants. Socket delivery failure leaves the persisted message available when chat reloads. System checklist attachments cannot be edited through the ordinary message edit endpoint.
- `PATCH /api/applications/:applicationId/checklist/:itemId` accepts `{ "completed": true }` or `false` and returns `{ "checklist": [...] }`. Authentication and ownership of the application's job are required; workers and other employers cannot change marks. Invalid identifiers/values return 400, unauthorized ownership 403, and missing applications/items 404. The update changes only the selected task and the application timestamp.

## Display and workflow

Job Management → View details loads owner-scoped hired applications, including hidden ones, and shows each worker's checklist with interactive Done checkboxes. An unchecked item can be checked and later unchecked, including after work completion. Failed updates show an error while retaining the last saved state.

Full-page chat on web/mobile and the web message dock render the sent checklist as a numbered description table without checkboxes. The chat attachment is the original snapshot; employer marks never modify it. Checklist contents use normal escaped text rendering.

Workers can also open Applied Jobs → Assignment details on web/mobile to read the full job description and their assigned checklist in the same read-only description table. `GET /api/applications/:applicationId/lifecycle` includes `job.description` and the application's `hireChecklist`; its existing participant check restricts access to that worker and the owning employer. Other workers on the same posting cannot read the assignment. Missing checklists and descriptions have explicit empty states.

Completion flags have no effect on recruitment, job/work/payment status, worker evidence submission, settlement eligibility, or fund release. Existing funding, revision, dispute, and payment guards remain authoritative. Old hires without a checklist display an explicit empty state.

## Verification

Server tests cover input limits, optional hiring, per-worker persistence and chat snapshots, duplicate confirmation, transaction rollback, owner-only updates, and evidence submission/payment with unchecked items. Browser regressions cover optional editing, draft preservation after a failed hire, responsive layout, persisted employer tracking, and the worker's checkbox-free chat table.
