# MicroJobs UI Improvement Roadmap

> This is the UI workstream of the broader [System Improvement Roadmap](./SYSTEM_IMPROVEMENT_ROADMAP.md). Use the master roadmap for backend, database, security, testing, deployment, and documentation work.

## Purpose

This document defines how the team will review, improve, verify, and document the MicroJobs web and mobile user interfaces. It turns UI work into a repeatable process with clear priorities, acceptance criteria, and a six-week delivery timeline.

The goal is not to redesign everything. The goal is to make the existing product responsive, accessible, consistent, complete, and reliable for the capstone demonstration.

## Target outcomes

By the end of this roadmap:

- Core worker, employer, and admin journeys work without unfinished controls.
- Web pages work at phone, tablet, laptop, and desktop widths.
- Mobile screens support common device sizes, safe areas, keyboards, and text scaling.
- Important controls can be used with a keyboard and screen reader.
- Loading, empty, success, validation, and failure states are clear and consistent.
- Shared UI patterns replace repeated page-specific styling.
- The web production bundle is split by route where practical.
- Core journeys have repeatable manual or automated checks.

## Scope

### Web

- Public landing and authentication
- Worker dashboard, jobs, applications, saved jobs, messages, wallet, profile, notifications, support, and settings
- Employer dashboard, job posting and management, applications, and messages
- Admin dashboard, users, jobs, reports, wallet monitoring, support, analytics, and security

### Mobile

- Authentication and onboarding
- Worker job discovery, job details, applications, saved jobs, profile, wallet, messages, notifications, and settings
- Employer job posting, job management, applications, wallet, profile, messages, and notifications

## Priority system

Use one priority for every issue:

| Priority | Meaning | Expected response |
| --- | --- | --- |
| P0 | Blocks startup, sign-in, navigation, or a core capstone journey | Fix immediately |
| P1 | Serious responsive, accessibility, data-entry, or incomplete-feature issue | Fix in the current phase |
| P2 | Noticeable inconsistency or usability problem with a workaround | Schedule after P0/P1 |
| P3 | Cosmetic polish or optional enhancement | Do only after core acceptance criteria pass |

When priorities conflict, use this order: broken journey, lost or unsafe user input, accessibility blocker, responsive failure, misleading UI, inconsistency, visual polish.

## Repeatable work pattern

Use this pattern for every page or component. Keep one issue focused enough to review and verify independently.

### 1. Inspect

- Identify the user role and goal.
- Test the normal path and at least one failure or empty path.
- Check phone, tablet, and desktop layouts where applicable.
- Check keyboard navigation, focus visibility, labels, and readable contrast.
- Record the affected route, component, viewport, and reproduction steps.

### 2. Define

Write a short issue before coding:

```text
Title: [P1] Mobile dashboard sidebar covers content
Area: Web / shared dashboard layout
Files: client/src/components/DashboardLayout.tsx, Sidebar.tsx
Observed: At 375px the persistent sidebar leaves too little room for content.
Expected: A menu button opens a dismissible sidebar drawer.
Acceptance: Works at 320px, 375px, 768px, and 1280px; keyboard focus is managed.
```

### 3. Design the smallest consistent solution

- Reuse an existing component or token when one is suitable.
- Prefer a shared fix when the same problem occurs on several pages.
- Define normal, hover, focus, disabled, loading, error, and empty states.
- Avoid changing unrelated business behavior during a UI task.

### 4. Implement

- Keep the change limited to the issue and shared dependencies it genuinely needs.
- Use semantic HTML on web and accessibility properties on React Native.
- Preserve API contracts and user-owned work.
- Do not hide an unfinished feature behind a button that only says "coming soon." Implement it, remove it, or label it honestly as unavailable.

### 5. Verify

For web changes, verify:

- 320px, 375px, 768px, 1024px, and 1440px widths
- Keyboard-only navigation and visible focus
- Browser console and failed network requests
- Loading, empty, error, success, and long-content states
- `npm run build`

For mobile changes, verify:

- A small phone and a large phone
- Android and iOS when available
- Safe areas, software keyboard, rotation where supported, and text scaling
- VoiceOver or TalkBack labels for important controls
- `npm exec --prefix Mobile -- tsc --noEmit`

### 6. Review and document

- Attach before and after screenshots to the issue or pull request.
- List exact routes and viewports tested.
- Record any remaining limitation.
- Do not mark the issue complete until all acceptance criteria pass.

## Definition of done

A UI task is done only when all applicable items are true:

- The requested behavior works with real data or a representative test state.
- It does not break another user role or route.
- Layout does not clip or create unintended page-level horizontal scrolling.
- Controls have visible labels or accessible names.
- Keyboard focus order and focus visibility are sensible.
- Buttons expose loading and disabled states during async work.
- Errors explain what happened and what the user can do next.
- Empty states offer an appropriate next action.
- Type checks and the production web build pass.
- The reviewer can reproduce the verification from the issue notes.

## Six-week timeline

This assumes a small student team working alongside other capstone responsibilities. A solo developer can treat each week as a milestone and extend it as needed.

### Week 1: Baseline and shared responsive shell

Outcome: every dashboard route is usable on a phone without the sidebar or navbar blocking content.

- Capture baseline screenshots for representative worker, employer, and admin routes.
- Create an issue board using the P0-P3 system.
- Add a mobile sidebar drawer and menu button.
- Make navbar search, notification popover, and user menu viewport-aware.
- Adopt mobile-first page padding and `min-w-0` rules.
- Confirm no unintended horizontal page scrolling.

Primary files:

- `client/src/components/DashboardLayout.tsx`
- `client/src/components/Sidebar.tsx`
- `client/src/components/NavBar.tsx`
- `client/src/styles/webUi.ts`
- `client/src/index.css`

Exit check: worker, employer, and admin dashboard shells pass at 320px, 375px, 768px, and 1440px.

### Week 2: Shared components and accessibility foundation

Outcome: common UI behavior is consistent and accessible before individual pages are polished.

- Define shared Button, IconButton, Input, Select, Textarea, Card, Badge, EmptyState, LoadingState, ErrorState, Dialog, and ConfirmDialog patterns.
- Add labels and accessible names to icon-only controls.
- Convert clickable non-button elements to semantic buttons or links.
- Add focus management and Escape behavior to menus and dialogs.
- Add live-region behavior and dismissal controls to toasts.
- Improve the session-timeout dialog and action wording.

Primary files:

- `client/src/lib/toast.tsx`
- `client/src/App.tsx`
- `client/src/components/NavBar.tsx`
- A new shared UI component directory under `client/src/components/ui/`

Exit check: shared components can be operated with keyboard only and announce important state changes.

### Week 3: Core worker journeys

Outcome: a worker can discover a job, review it, apply, save it, and communicate without confusing or broken UI.

- Improve job search, filters, result states, and mobile card layout.
- Make the job-detail primary and secondary actions responsive.
- Verify duplicate-application, expired-job, loading, and API-error states.
- Improve applied and saved job empty states.
- Replace or remove the unfinished message attachment action.
- Review worker profile and settings forms for labels and validation.

Primary web files:

- `client/src/pages/worker/FindJobs.tsx`
- `client/src/components/JobDetails.tsx`
- `client/src/pages/worker/AppliedJobs.tsx`
- `client/src/pages/worker/SavedJobs.tsx`
- `client/src/pages/worker/Messages.tsx`
- `client/src/pages/worker/Profile.tsx`
- `client/src/components/Settings.tsx`

Primary mobile files:

- `Mobile/pages/pages1/Jobs.tsx`
- `Mobile/pages/pages1/JobDetails.tsx`
- `Mobile/pages/pages1/AppliedJobs.tsx`
- `Mobile/pages/pages1/SavedJobs.tsx`
- `Mobile/pages/pages1/Profile.tsx`
- `Mobile/pages/pages1/WorkerInbox.tsx`

Exit check: complete the worker journey on web and mobile using a test account, including one error state.

### Week 4: Employer and admin journeys

Outcome: employer and admin workflows are usable, responsive, and do not expose placeholder actions.

- Simplify long employer job forms and improve inline validation.
- Use a mobile-friendly stage selector or list in application management.
- Verify scheduling, bulk actions, and applicant messaging feedback.
- Implement or remove Admin Invite User and Edit User controls.
- Make admin tables usable on narrow screens through responsive cards, priority columns, or controlled table scrolling.
- Replace native browser confirmation prompts with the shared confirmation dialog.

Primary files:

- `client/src/pages/employer/PostJob.tsx`
- `client/src/pages/employer/ApplicationsManagement.tsx`
- `client/src/pages/employer/JobsManagement.tsx`
- `client/src/pages/admin/AdminUserManagement.tsx`
- `client/src/pages/admin/AdminJobMonitoring.tsx`
- `client/src/pages/admin/AdminEWalletMonitoring.tsx`
- `client/src/pages/admin/AdminReports.tsx`
- `Mobile/pages/employer/EmployerPostJob.tsx`
- `Mobile/pages/employer/EmployerApplications.tsx`
- `Mobile/pages/employer/EmployerJobPosts.tsx`

Exit check: employer posting/application management and admin user/job review pass their happy and failure paths.

### Week 5: Forms, wallets, mobile accessibility, and consistency

Outcome: sensitive forms are understandable and the mobile app is usable with assistive technology.

- Add visible labels, formatting, validation, and autocomplete metadata to payment fields.
- Check destructive account and payment actions for confirmation and recovery messaging.
- Add React Native accessibility roles, labels, hints, and selected/disabled states.
- Increase overly small mobile text and touch targets where needed.
- Verify keyboard avoidance, safe areas, long names, and large text.
- Replace remaining one-off colors and spacing with shared tokens.

Primary files:

- `client/src/components/Settings.tsx`
- `client/src/pages/worker/EWallet.tsx`
- `client/src/pages/admin/AdminEWalletMonitoring.tsx`
- `Mobile/pages/pages1/EWallet.tsx`
- `Mobile/pages/employer/EmployerEWallet.tsx`
- `Mobile/pages/pages1/Settings.tsx`
- `Mobile/pages/pages1/DeleteAccount.tsx`
- `Mobile/theme/`

Exit check: important web and mobile controls are labeled, forms identify invalid fields, and wallet states are clear.

### Week 6: Performance, regression testing, and capstone readiness

Outcome: the application is stable, demonstrable, and supported by repeatable evidence.

- Lazy-load web routes and heavy dashboard modules.
- Measure the production bundle and document the improvement.
- Split the largest components when doing so reduces risk or duplication.
- Add linting and a small set of core browser-flow tests.
- Run a cross-role regression pass.
- Prepare final screenshots and a capstone demo script.
- Freeze noncritical visual changes before the presentation.

Primary files:

- `client/src/App.tsx`
- `client/src/components/Settings.tsx`
- `client/src/pages/worker/Messages.tsx`
- `client/src/pages/employer/PostJob.tsx`
- Root and client package scripts

Exit check: build and type checks pass, core journey tests pass, and each role has a rehearsed demo path.

## Suggested weekly rhythm

| Day | Activity |
| --- | --- |
| Monday | Select the week's P0/P1 issues, reproduce them, and write acceptance criteria |
| Tuesday | Implement shared or structural fixes |
| Wednesday | Implement page-level fixes and error/empty states |
| Thursday | Responsive, keyboard, screen-reader, and device verification |
| Friday | Review, regression check, screenshots, documentation, and demo |

Keep the work-in-progress limit small: one active issue per developer, or at most two when one is awaiting review.

## Initial backlog from the UI review

| ID | Priority | Area | Task |
| --- | --- | --- | --- |
| UI-001 | P1 | Web shell | Replace the persistent mobile sidebar with an accessible drawer |
| UI-002 | P1 | Navbar | Prevent title, search, and fixed-width popovers from overflowing small screens |
| UI-003 | P1 | Accessibility | Add accessible names and keyboard behavior to icon controls and notification items |
| UI-004 | P1 | Mobile | Add accessibility metadata to job search, filters, cards, and selected states |
| UI-005 | P1 | Incomplete UI | Implement, remove, or explicitly disable all "coming soon" actions |
| UI-006 | P1 | Payment | Add labeled and validated card/payment inputs with appropriate input metadata |
| UI-007 | P2 | Job details | Make Apply, Message, and Save actions responsive and visually hierarchical |
| UI-008 | P2 | Applications | Provide a phone-friendly alternative to fixed 320px pipeline columns |
| UI-009 | P2 | Feedback | Make toast and session-timeout components accessible |
| UI-010 | P2 | Admin | Improve narrow-screen tables and replace native confirmation prompts |
| UI-011 | P2 | Performance | Add route-level code splitting; baseline web JS is about 1.31 MB before gzip |
| UI-012 | P2 | Architecture | Extract shared UI primitives and split oversized components incrementally |
| UI-013 | P2 | Quality | Add lint, accessibility, and core-flow checks |
| UI-014 | P3 | Visual polish | Consolidate repeated arbitrary colors, spacing, radii, and typography |

## Core journey regression checklist

### Worker

- Sign up, verify, sign in, and recover password.
- Browse and filter jobs.
- Open a job, save it, apply, and see the resulting status.
- Open messages and send a message.
- Update profile and settings.
- Review wallet and support states.

### Employer

- Sign in and switch to the employer context when allowed.
- Create, validate, publish, edit, and close a job.
- Review applicants, move stages, and schedule an interview.
- Message an applicant.
- Review employer wallet and notifications.

### Admin

- Sign in through the admin route.
- Review users, jobs, reports, wallet activity, and support tickets.
- Exercise destructive actions through a confirmation dialog.
- Verify loading, empty, permission, and API-error states.

## Issue and pull-request checklist

Copy this into each UI issue or pull request:

```markdown
## Problem

## User and route

## Before

## Expected behavior

## Acceptance criteria
- [ ] Normal state
- [ ] Loading state
- [ ] Empty or unavailable state
- [ ] Error state
- [ ] Phone layout
- [ ] Tablet layout
- [ ] Desktop layout
- [ ] Keyboard and focus
- [ ] Accessible name/state

## Verification
- [ ] Web TypeScript/build
- [ ] Mobile TypeScript, if applicable
- [ ] Browser console checked
- [ ] API/network failures checked
- [ ] Before/after screenshots attached

## Remaining limitations
```

## Progress tracking

Update this table at the end of each week:

| Phase | Status | Owner | Target date | Evidence/notes |
| --- | --- | --- | --- | --- |
| Week 1: Responsive shell | Not started | TBD | TBD | |
| Week 2: UI and accessibility foundation | Not started | TBD | TBD | |
| Week 3: Worker journeys | Not started | TBD | TBD | |
| Week 4: Employer and admin journeys | Not started | TBD | TBD | |
| Week 5: Forms and mobile accessibility | Not started | TBD | TBD | |
| Week 6: Performance and capstone readiness | Not started | TBD | TBD | |

Allowed status values: `Not started`, `In progress`, `In review`, `Blocked`, and `Done`.

## Final release gate

Do not call the UI capstone-ready until:

- No known P0 issue remains.
- Every P1 issue is fixed or explicitly accepted with a written reason.
- Web production build and mobile TypeScript checks pass.
- Worker, employer, and admin core journeys have been tested.
- The application is usable at the target web widths and mobile devices.
- No visible control misleadingly promises an unavailable action.
- Presentation accounts and sample data are ready.
- The demo has been rehearsed from a clean start.
