# MicroJobs System Improvement Roadmap

## Purpose

This is the master improvement plan for the complete MicroJobs capstone system. It covers product behavior, web UI, mobile UI, backend APIs, data integrity, security, testing, performance, observability, deployment, documentation, and capstone readiness.

The detailed UI schedule remains in [UI_IMPROVEMENT_ROADMAP.md](./UI_IMPROVEMENT_ROADMAP.md). UI work is one part of this plan, not the whole plan.

## Current baseline

The repository currently contains:

- React and Vite web application
- React Native and Expo mobile application
- Express and MongoDB backend
- JWT/session authentication, OTP, MFA, password recovery, and role-based access
- Job posting, applications, saved jobs, messages, notifications, support, wallets, payouts, and payment-provider webhooks
- Socket.IO realtime behavior
- File uploads including avatars, resumes, and verification documents
- Admin dashboards, reports, monitoring, and audit records

Positive baseline checks:

- Web TypeScript and production build pass.
- Mobile TypeScript check passes.
- All 17 existing server tests pass.
- The backend already uses Helmet, CORS rules, rate limiting, input sanitization, session records, MFA, signed payment webhooks, and some database transactions.
- Production refuses to silently fall back to the in-memory database when the primary database fails.

Important coverage gaps observed during the repository review:

- Approximately 124 API route handlers exist, but only 17 tests across 6 test files are present, mainly for utility functions.
- There are no visible integration tests for authentication, authorization, jobs, applications, messaging, uploads, payments, or admin actions.
- There is no frontend or mobile automated test suite.
- There is no configured lint command or continuous-integration workflow.
- There is no versioned OpenAPI/API contract.
- There is no clear health/readiness endpoint, deployment definition, backup/restore runbook, or incident runbook.
- Uploaded avatars and a resume are currently tracked in Git, which creates privacy, repository-size, and data-retention concerns.
- Major files are highly concentrated: `authRoutes.js` is about 1,710 lines and `PaymentController.js` is about 980 lines.
- The web application ships a single JavaScript bundle of about 1.31 MB before gzip.

## Improvement principles

1. Protect user identity, documents, messages, and money before adding polish.
2. Fix root causes and preserve existing business behavior unless a requirement changes.
3. Make every critical workflow testable and observable.
4. Use one source of truth for API contracts, status values, validation rules, and permissions.
5. Deliver in small, reviewable slices with explicit acceptance criteria.
6. Never treat a passing build as proof that the system works end to end.
7. Avoid adding new capstone features while P0 or P1 reliability issues remain.

## Priority and severity

| Level | Meaning | Examples | Response |
| --- | --- | --- | --- |
| P0 | Data loss, unauthorized access, incorrect money movement, or core system unavailable | Duplicate payout, cross-user document access, broken login | Stop other work and fix |
| P1 | Core journey unreliable or serious privacy/security gap | Application state corruption, exposed uploaded data, missing authorization test | Fix in current milestone |
| P2 | Important quality, maintainability, performance, or UX weakness | Missing API documentation, oversized module, slow route | Schedule next |
| P3 | Cosmetic or optional improvement | Animation polish, minor refactor | Do after release gates pass |

## Standard work pattern

Every system task follows the same loop.

### 1. Define the behavior

- Identify the actor, action, data, and expected result.
- Identify permissions and forbidden cases.
- Write success, validation, empty, conflict, and failure outcomes.
- Classify the issue P0-P3.

### 2. Reproduce and measure

- Record the route, screen, API endpoint, database records, and environment involved.
- Capture the current response, logs, timing, or screenshot.
- Create the smallest reliable reproduction.

### 3. Design the change

- Define API and data-contract changes first.
- Identify migration and backward-compatibility needs.
- Identify security and privacy consequences.
- Define tests before implementation.

### 4. Implement a focused slice

- Keep controller, model, client, and mobile changes aligned.
- Use transactions and idempotency for multi-record or money operations.
- Do not weaken validation or authorization to make a test pass.
- Avoid unrelated rewrites.

### 5. Verify

- Run narrow tests, then server tests, client build/type check, and mobile type check as applicable.
- Verify authorized and unauthorized behavior.
- Verify retries, duplicate requests, and partial failures for critical actions.
- Inspect logs and database state, not only the HTTP response.

### 6. Document and review

- Update API contracts, environment examples, migration notes, and runbooks.
- Record commands and scenarios tested.
- Require a second review for auth, permissions, documents, wallets, and payments.

## Workstreams

## A. Product requirements and business rules

Goal: eliminate ambiguity between the UI, API, database, and capstone claims.

Tasks:

- Write role and permission matrices for worker, employer, admin, and unauthenticated users.
- Define the canonical job lifecycle: draft, published, closed, completed, cancelled, and deleted.
- Define the application lifecycle and allowed state transitions.
- Define wallet, escrow, top-up, refund, and payout accounting rules.
- Define whether account switching changes one user profile or represents separate role profiles.
- Define notification rules and which events must be realtime.
- Define upload ownership, retention, deletion, and verification-document handling.
- Mark every visible feature as implemented, intentionally unavailable, or out of capstone scope.

Deliverables:

- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/ROLE_PERMISSION_MATRIX.md`
- `docs/STATE_TRANSITIONS.md`

## B. Web and mobile experience

Goal: deliver responsive, accessible, complete core journeys.

Follow the detailed [UI Improvement Roadmap](./UI_IMPROVEMENT_ROADMAP.md).

System-level requirements:

- Web and mobile must interpret API responses and statuses consistently.
- No button may advertise a feature that only returns “coming soon.”
- Async actions must prevent accidental duplicate submissions.
- All critical forms need client convenience validation and authoritative server validation.
- Authentication, job, application, wallet, and message states must survive refresh/restart correctly.

## C. API architecture and contracts

Goal: make the API predictable, versionable, and easier to test.

Tasks:

- Inventory all API routes and owners.
- Publish an OpenAPI contract with requests, responses, errors, authentication, and examples.
- Standardize success/error envelopes and HTTP status usage.
- Validate params, query strings, and request bodies at the route boundary using schemas.
- Define pagination, filtering, sorting, and maximum page sizes for list endpoints.
- Split oversized auth, user, job, and payment modules by capability.
- Separate transport logic, business services, and database access where complexity warrants it.
- Add API versioning before incompatible contract changes.
- Remove `any`-shaped client response handling gradually by generating or sharing types.

Primary areas:

- `server/routes/`
- `server/controllers/`
- `server/lib/apiResponse.js`
- `client/src/services/api.ts`
- `Mobile/lib/api.ts`

## D. Database and data integrity

Goal: ensure records remain correct during retries, concurrency, and partial failures.

Tasks:

- Document every collection and relationship.
- Review indexes against actual query/filter/sort patterns.
- Enforce unique application and saved-job constraints consistently in error responses.
- Test allowed application and job status transitions.
- Audit all wallet balance changes for transaction use, idempotency, and immutable ledger references.
- Add idempotency keys to payment initiation and payout actions where provider references are not sufficient.
- Replace startup backfills with versioned, observable migrations when appropriate.
- Define soft-delete and retention rules for users, jobs, messages, support records, and documents.
- Create backup and restore procedures, then perform a restore rehearsal.
- Seed deterministic, non-sensitive capstone demo data.

Deliverables:

- `docs/DATA_MODEL.md`
- `docs/MIGRATIONS.md`
- `docs/BACKUP_RESTORE.md`

## E. Security and privacy

Goal: protect accounts, private documents, conversations, administrative actions, and financial records.

This workstream should begin with a dedicated repository threat model, followed by targeted fixes and tests.

Tasks:

- Threat-model authentication, role switching, uploads, messaging, admin operations, and payment webhooks.
- Build automated authorization tests for cross-user and cross-role access.
- Review CSRF coverage for every cookie-authenticated state-changing endpoint, not only refresh/payment paths.
- Use constant-time comparison for webhook signatures and CSRF tokens where applicable.
- Verify upload content using size limits, file signatures, safe generated names, and malware-scanning strategy.
- Move uploads to private object storage or an equivalent controlled service; use short-lived authorized access for sensitive documents.
- Remove tracked user uploads from the current repository and assess whether Git history must be cleaned. Do this through an approved, recoverable process.
- Define secret rotation, environment separation, and least-privilege provider credentials.
- Review session expiry, revocation, MFA recovery, backup-code handling, and audit coverage.
- Sanitize logs so passwords, tokens, OTPs, document details, and payment secrets never appear.
- Add dependency and secret scanning to CI.
- Document privacy consent, retention, export, and deletion behavior.

Deliverables:

- `docs/THREAT_MODEL.md`
- `docs/SECURITY_CHECKLIST.md`
- `docs/PRIVACY_AND_RETENTION.md`

## F. Testing and quality assurance

Goal: prove the core system works across API, web, mobile, and failure paths.

Testing pyramid:

1. Unit tests for validation, policies, status transitions, and formatting.
2. Integration tests for routes, middleware, MongoDB state, and authorization.
3. Contract tests to keep web/mobile clients aligned with API responses.
4. End-to-end tests for critical browser flows.
5. Manual device tests for native mobile behavior and accessibility.

Minimum integration-test matrix:

- Sign-up, verification, login, refresh, logout, password reset, MFA, and revoked sessions
- Worker/employer/admin authorization and forbidden cross-role requests
- Job create/edit/publish/close/delete permissions
- Application uniqueness and valid/invalid state transitions
- Saved jobs and notifications ownership
- Message/conversation participant access
- Upload type, size, ownership, and private retrieval
- Payment webhook valid signature, invalid signature, replay, duplicate, and partial failure
- Wallet balance/ledger consistency and payout permissions
- Admin-only routes and audit records

Quality tooling:

- Add ESLint and formatting checks.
- Add code coverage reporting with meaningful critical-path targets.
- Add browser accessibility checks and core end-to-end journeys.
- Make CI run checks on every pull request.

## G. Performance and scalability

Goal: keep the capstone responsive and remove obvious scaling bottlenecks.

Tasks:

- Add route-level lazy loading to the web application.
- Measure API p50/p95 latency for core endpoints.
- Paginate jobs, applications, messages, notifications, users, reports, and transactions.
- Inspect slow MongoDB queries and add verified indexes.
- Avoid large unbounded population or list responses.
- Add image resizing and sensible upload limits.
- Review Socket.IO room membership, reconnect behavior, event duplication, and cleanup.
- Use caching only after measuring and defining invalidation.
- Add load tests for login, job search, applications, and realtime message fan-out.

## H. Reliability and observability

Goal: know when the system is unhealthy and diagnose failures without exposing sensitive data.

Tasks:

- Add liveness and readiness endpoints with database/provider dependency rules.
- Replace development-only logging with structured, environment-aware logging.
- Add request/correlation IDs across HTTP, jobs, and webhook processing.
- Capture unhandled errors and rejected promises.
- Define metrics for authentication failures, API errors, latency, active sockets, webhook failures, and payment reconciliation.
- Add alerts for repeated payment failure, database unavailability, elevated 5xx rates, and storage problems.
- Add graceful shutdown verification for HTTP, Socket.IO, MongoDB, and in-flight work.
- Create an incident and recovery runbook.

Deliverables:

- `docs/OBSERVABILITY.md`
- `docs/INCIDENT_RUNBOOK.md`

## I. Deployment and operations

Goal: make development, staging, production, and capstone-demo environments reproducible.

Tasks:

- Choose and document the supported hosting architecture.
- Create separate development, staging, demo, and production configurations.
- Add a deployment definition or infrastructure configuration.
- Validate required environment variables at startup and fail with safe, actionable errors.
- Add CI for tests/builds and CD with approval for production.
- Run database migrations as an explicit deployment step.
- Store secrets in the deployment platform, never committed files.
- Configure HTTPS, domains, CORS origins, secure cookies, upload storage, and email/payment provider settings.
- Document rollback, backup, restore, and provider outage behavior.
- Add a release checklist and version/tag strategy.

Deliverables:

- `docs/DEPLOYMENT.md`
- `docs/ENVIRONMENTS.md`
- `docs/RELEASE_CHECKLIST.md`

## J. Documentation and maintainability

Goal: allow another developer or panel evaluator to understand and operate the system.

Tasks:

- Update README commands and casing (`Mobile/` versus `mobile/`) consistently.
- Add architecture and request-flow diagrams.
- Document external providers and safe local substitutes.
- Document API contracts and example error responses.
- Split oversized modules incrementally along business capabilities.
- Add contribution, branching, commit, review, and definition-of-done guidance.
- Record architectural decisions for authentication, money, files, and realtime messaging.
- Maintain a traceability table from capstone requirements to implementation and tests.

Deliverables:

- `docs/ARCHITECTURE.md`
- `docs/API.md` or generated OpenAPI documentation
- `docs/CONTRIBUTING.md`
- `docs/REQUIREMENTS_TRACEABILITY.md`

## Ten-week delivery timeline

### Week 1: Requirements and baseline

- Freeze capstone scope.
- Create role/permission and state-transition matrices.
- Inventory APIs, collections, providers, and critical journeys.
- Record baseline build, test, bundle, and manual journey results.
- Create P0-P3 issue board.

Exit: every feature and critical rule has an owner and acceptance criteria.

### Week 2: Security and privacy foundation

- Complete repository threat model.
- Review auth, role checks, CSRF, uploads, webhooks, and admin access.
- Stop tracking runtime uploads and define private storage/retention migration.
- Add initial authorization and webhook security tests.
- Confirm secrets and environments are safely separated.

Exit: no known P0 security/privacy issue remains untreated.

### Week 3: API contract and validation

- Inventory and document endpoints.
- Standardize response/errors.
- Introduce route-boundary validation and pagination standards.
- Start splitting auth/payment modules without changing behavior.

Exit: critical auth/job/application/payment endpoints have documented contracts.

### Week 4: Data integrity and financial flows

- Document collections and indexes.
- Test application uniqueness/status transitions.
- Test wallet ledger, escrow, payout, refund, idempotency, and duplicate webhooks.
- Define migrations and backup/restore procedures.

Exit: money and lifecycle operations are atomic, idempotent, and tested.

### Week 5: Responsive UI and shared components

- Complete UI roadmap Weeks 1-2.
- Fix dashboard shell/navbar responsiveness.
- Establish accessible shared components and feedback patterns.

Exit: all roles can navigate the web shell at target widths with keyboard support.

### Week 6: Worker journeys

- Complete worker web/mobile journeys.
- Add API integration and browser tests for job discovery, save, apply, and message.
- Verify failure, duplicate, expired, and offline/retry behavior.

Exit: worker core journey passes web, mobile, and API verification.

### Week 7: Employer and admin journeys

- Complete job creation/management, application pipeline, and admin flows.
- Remove or implement unfinished controls.
- Add authorization and integration coverage.

Exit: employer and admin core journeys pass expected and forbidden cases.

### Week 8: Reliability, performance, and observability

- Add health/readiness, structured logs, request IDs, error capture, and key metrics.
- Add route code splitting, endpoint pagination, index/query review, and realtime cleanup tests.
- Establish measurable performance budgets.

Exit: failures can be diagnosed and critical performance budgets are met.

### Week 9: Deployment and recovery

- Create staging/demo deployment workflow.
- Validate environment variables and provider configuration.
- Exercise migration, backup, restore, rollback, and graceful shutdown.
- Add CI gates and release checklist.

Exit: a clean environment can be deployed and recovered using documentation.

### Week 10: Regression and capstone readiness

- Run all tests and cross-role regression checks.
- Resolve P0/P1 issues and triage P2/P3 transparently.
- Prepare deterministic demo data and accounts.
- Complete traceability matrix, screenshots, architecture explanation, and demo script.
- Freeze noncritical changes and rehearse failure recovery.

Exit: the team can demonstrate, explain, test, deploy, and recover the system.

## Initial master backlog

| ID | Priority | Workstream | Task |
| --- | --- | --- | --- |
| SYS-001 | P1 | Privacy | Stop storing runtime user uploads in Git and define safe storage/retention |
| SYS-002 | P1 | Testing | Add auth and role authorization integration tests |
| SYS-003 | P1 | Payments | Add webhook replay, duplicate, signature, atomicity, and ledger tests |
| SYS-004 | P1 | Data | Test and enforce lifecycle state transitions and concurrency behavior |
| SYS-005 | P1 | Product | Publish role/permission and state-transition matrices |
| SYS-006 | P1 | UI | Complete responsive/accessibility P1 backlog in the UI roadmap |
| SYS-007 | P2 | API | Publish OpenAPI contract and standard validation/error behavior |
| SYS-008 | P2 | Architecture | Split oversized auth, payment, user, and job modules incrementally |
| SYS-009 | P2 | Quality | Add lint, coverage, browser-flow tests, and pull-request CI |
| SYS-010 | P2 | Reliability | Add health/readiness, structured logs, request IDs, and alerts |
| SYS-011 | P2 | Database | Document indexes, migrations, backup, restore, and retention |
| SYS-012 | P2 | Performance | Paginate list APIs, analyze queries, and split the web bundle |
| SYS-013 | P2 | Deployment | Create staging/demo deployment and rollback process |
| SYS-014 | P2 | Documentation | Add architecture, API, operations, and traceability documents |
| SYS-015 | P3 | Polish | Consolidate visual tokens and noncritical UI refinements |

## System definition of done

A task is done only when:

- Product behavior and permissions are explicit.
- Server validation and authorization are enforced.
- Database changes are atomic or have a documented recovery strategy.
- Relevant unit/integration/end-to-end tests pass.
- Web and mobile consumers are compatible with the API contract.
- Logs expose enough context without sensitive data.
- Environment, migration, deployment, and rollback impacts are documented.
- Error and retry behavior have been verified.
- A reviewer can reproduce the verification.

## Weekly progress tracker

| Milestone | Status | Owner | Target | Evidence/blocker |
| --- | --- | --- | --- | --- |
| Requirements and baseline | Not started | TBD | TBD | |
| Security and privacy | Not started | TBD | TBD | |
| API contract and validation | Not started | TBD | TBD | |
| Data integrity and payments | Not started | TBD | TBD | |
| Responsive/shared UI | Not started | TBD | TBD | |
| Worker journeys | Not started | TBD | TBD | |
| Employer/admin journeys | Not started | TBD | TBD | |
| Reliability and performance | Not started | TBD | TBD | |
| Deployment and recovery | Not started | TBD | TBD | |
| Capstone readiness | Not started | TBD | TBD | |

Allowed status values: `Not started`, `In progress`, `In review`, `Blocked`, and `Done`.

## Final capstone release gate

The complete system is capstone-ready only when:

- No unresolved P0 issue remains.
- Every P1 issue is fixed or explicitly accepted with evidence and a reason.
- Worker, employer, and admin critical journeys pass.
- Authorization tests prove forbidden cross-user and cross-role access is rejected.
- Payment retries and webhooks do not duplicate balance changes.
- Private documents are not publicly or accidentally repository-accessible.
- Builds, type checks, server tests, lint, integration tests, and core end-to-end tests pass.
- Staging/demo deployment, rollback, backup, and restore procedures have been exercised.
- Monitoring and logs can identify a failing critical journey.
- Requirements trace to implementation and verification evidence.
- Demo accounts, sample data, presentation script, and recovery plan are ready.

