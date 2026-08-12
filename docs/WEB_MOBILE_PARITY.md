# Web and Mobile Feature Parity

The API and MongoDB data are authoritative on both platforms. Local web and Expo Go use port `5050` by default. Mobile startup verifies `/api/health` and `/api/auth/me` before displaying authenticated screens.

| Shared feature | Canonical API | Web | Native mobile | Refresh behavior |
| --- | --- | --- | --- | --- |
| Session, profile, role and Both mode | `/api/auth/*` | Connected | Connected | Startup verification and profile refresh |
| Worker dashboard and job discovery | `/api/jobs/*`, `/api/categories/*`, `/api/applications/user` | Connected | Connected | Pull/navigation refresh and mutation invalidation |
| Employer jobs and hiring capacity | `/api/jobs/mine`, `/api/jobs/*` | Connected | Connected | Job mutation invalidation |
| Applications and interviews | `/api/applications/*` | Connected | Connected | Application/job/notification invalidation |
| Formal offers and Confirm Hire | `/api/applications/:id/offers`, `/api/job-offers/*` | API compatible | Connected | Application/job/wallet refresh |
| Saved jobs | `/api/saved-jobs/*` | Connected | Connected | Server refresh with disposable mobile cache |
| Wallet, escrow, top-up and withdrawal | `/api/payment/*` | Connected | Connected | Wallet/profile/notification invalidation |
| Direct per-worker settlement | `/api/applications/:id/payment/*` | API compatible | Connected | Application/job/wallet refresh |
| Messages and job conversations | `/api/messages/*` | Connected | Connected | Socket reconciliation and unread refresh |
| Notifications and badges | `/api/notifications/*`, `/api/alerts/*` | Connected | Connected | Server unread records and socket reconciliation |
| Profile, resume and Philippine location | `/api/auth/*`, `/api/users/*` | Connected | Connected | Authenticated profile refresh |
| Reviews | `/api/reviews/*` | Connected | Connected | Review/profile invalidation |
| Settings, MFA, password and support | `/api/auth/*`, `/api/support/*` | Connected | Connected | Session/profile/settings refresh |

## Intentional platform differences

- QR camera scanning is native-only. Web can continue the corresponding settlement through server-backed review and completion flows.
- Admin is web-only.
- Android Back, safe areas, camera permissions, pull-to-refresh, and native bottom navigation remain native interactions.
- Desktop web retains its header/sidebar; small web and mobile share the MicroJobs navy/blue hierarchy and equivalent action states.

## Local diagnostics

Run the API and web with `npm run dev`, then Expo with `npm run mobile:start`. The mobile connection screen shows the resolved API URL, source, port, environment, revision, and a non-sensitive database fingerprint. It never displays tokens, database URLs, or credentials.
