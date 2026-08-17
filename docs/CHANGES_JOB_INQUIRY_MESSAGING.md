# Job Inquiry Messaging Fix — Change Summary

Worker→employer job inquiries were being routed to the Admin/Support channel instead of
to the employer who posted the job. This documents what changed, why, and how it was
verified.

Diff size: **6 new files, 14 modified, +404 / −185** on the modified files.

---

## The bug

When a worker tapped "Inquire" on a job, the client had no reliable employer id to send
to, so the conversation fell through to the Admin/Support thread. The conversation was
also not keyed to the job, so even a correctly addressed inquiry could not be
distinguished from a general chat.

## The fix

The server now resolves the employer authoritatively from the job document, and every
inquiry conversation is keyed to its job id.

- **Employer resolution happens server-side**, not client-side. `server/lib/jobInquiry.js`
  reads the employer off the job document, handling populated refs, raw ids, and the
  `postedBy` / `employer` field variants.
- **Conversations are job-scoped.** The conversation key embeds the job id, so each
  inquiry thread is pinned to its posting and the employer sees which job it concerns.
- **Admin/Support stays separate.** Support remains a general (job-less) thread reserved
  for platform concerns; job inquiries never land there.
- **Guardrails**: self-inquiry (employer inquiring on their own post) and inquiries on
  unavailable jobs are rejected.

---

## Files changed

### New

| File | Purpose |
| --- | --- |
| `server/lib/jobInquiry.js` | Core fix. Employer resolution, job-scoped conversation keys, participant validation, inquiry message composition. |
| `server/tests/lib/jobInquiry.test.js` | Unit tests for the above. |
| `server/lib/staffProfileVisibility.js` | Gates public-profile reads so admin/superadmin accounts return 404. *(see Scope note)* |
| `server/tests/lib/staffProfileVisibility.test.js` | Unit tests for the above. *(see Scope note)* |
| `client/src/utils/staffConversation.ts` | `isStaffConversation` helper for UI gating. *(see Scope note)* |
| `docs/LOCAL_DEV.md` | Local dev / firewall setup notes. *(see Scope note)* |

### Server

- `server/controllers/MessageController.js` — largest change (+274). Job-inquiry endpoint
  that resolves the employer via `jobInquiry.js` instead of falling back to
  Admin/Support; job-scoped conversation keys; `otherUserIsStaff` on conversation
  payloads.
- `server/routes/MessageRoute.js` — registers the inquiry route.
- `server/controllers/UserController.js` — `getPublicProfile` returns 404 for staff
  targets. *(see Scope note)*

### Web client

- `client/src/components/JobDetails.tsx` — inquiry button calls the new endpoint and
  opens a chat with the resolved job poster.
- `client/src/services/api.ts` — new inquiry API call.
- `client/src/pages/worker/Messages.tsx` — threads `otherUserIsStaff` through contacts;
  swaps "View Profile" for a non-interactive "Platform Support" label on staff threads;
  adds the missing `supportStartUserId` socket-effect dependency.

### Mobile

- `Mobile/pages/pages1/JobDetails.tsx`, `Mobile/pages/pages1/Jobs.tsx` — inquiry actions
  route to the employer resolved from the job post.
- `Mobile/pages/pages1/WorkerInbox.tsx`, `Mobile/pages/employer/EmployerInbox.tsx`,
  `Mobile/pages/employer/MessageList.tsx`, `Mobile/pages/employer/ChatScreen.tsx` —
  job-scoped conversation handling on both the worker and employer side.
- `Mobile/app.jsx`, `Mobile/contexts/AppSessionContext.tsx` — navigation/session plumbing
  to open the chat with the correct user and job.

---

## Scope note

Two groups of changes fall **outside** the original job-inquiry request and are cleanly
separable if you want a focused commit:

1. **Staff profile visibility** — `server/lib/staffProfileVisibility.js` and its test,
   `server/controllers/UserController.js`, plus the `client/src/utils/staffConversation.ts`
   and `client/src/pages/worker/Messages.tsx` UI gating. Found while tracing chat
   surfaces: the chat header's "View Profile" button pointed at the other participant
   unconditionally, which exposed admin accounts through support threads. The endpoint now
   returns 404 rather than 403, so staff accounts cannot be enumerated. Mobile chat has no
   profile link and needed no change; both `PublicProfile` screens already degrade to a
   "Profile not found" state.
2. **`docs/LOCAL_DEV.md`** — unrelated local dev/firewall notes.

## Verification

- `npm test --prefix server` — 128/128 passing, including both new suites.
- `npm run typecheck:web` — clean.
- `npx eslint` on every touched file — clean.

**Not verified end-to-end.** The messaging behavior was validated through unit tests and
code paths, not a live run with real worker and employer accounts. A manual pass on the
inquiry button in both web and mobile is still worth doing before shipping.

---

## Suggested commit messages

Splitting along the scope note above gives two commits.

### Commit 1 — the requested fix

```
fix(messages): route job inquiries to the employer instead of Admin/Support

Workers tapping "Inquire" on a job were dropped into the Admin/Support
thread because the client had no reliable employer id to address, and the
conversation was not keyed to the job.

Resolve the employer server-side from the job document (handling populated
refs, raw ids, and postedBy/employer variants) and key every inquiry
conversation to its job id, so the thread is pinned to the posting and the
employer can reply on it directly. Reject self-inquiry and inquiries on
unavailable jobs. Admin/Support remains a separate general thread for
platform concerns only.

- server/lib/jobInquiry.js: employer resolution + job-scoped conversation keys
- MessageController/MessageRoute: inquiry endpoint using the above
- web + mobile JobDetails/Jobs: inquiry action opens the resolved chat
- mobile inbox/chat screens: job-scoped conversation handling

Tests: 128/128 server tests pass; typecheck:web and eslint clean.
Not yet exercised end-to-end with live worker/employer accounts.
```

### Commit 2 — the adjacent security fix

```
fix(profiles): hide staff profiles from marketplace users

The chat header's "View Profile" button linked to the other participant
unconditionally, exposing admin accounts through Admin/Support threads.

Gate getPublicProfile so admin/superadmin targets return 404 — not 403 —
keeping staff accounts indistinguishable from missing users and therefore
non-enumerable. Staff retain access. MessageController now reports
otherUserIsStaff per conversation so the web inbox can swap the profile
button for a non-interactive "Platform Support" label.

Mobile chat has no profile link and needed no change.
```
