# MicroJob STRIDE Threat Model

## Scope
- Backend API and authentication paths under `server/`
- Web client auth integration under `client/src/microjobs/`

## Key Assets
- User identities, roles, and session tokens
- Password hashes and OTP codes
- Job postings, applications, categories
- Messages, notifications, and alerts

## Trust Boundaries
- Browser/mobile client -> API (`/api/*`)
- API -> MongoDB
- API -> SMTP provider

## STRIDE Analysis

| Category | Threat | Impact | Mitigation Implemented |
|---|---|---|---|
| **S** Spoofing | Forged JWT if weak fallback secret is used | Full account takeover | Removed `dev-secret` fallback; server now requires `JWT_SECRET` at startup (`server/index.js`, `server/middleware/auth.js`, `server/controllers/JobController.js`, `server/routes/authRoutes.js`) |
| **S** Spoofing | OTP brute force attempts | Unauthorized account verification | Added per-code attempt cap in OTP flow (`server/controllers/UserController.js`) and auth rate limiting (`server/middleware/rateLimit.js`, `server/routes/UserRoute.js`, `server/routes/authRoutes.js`) |
| **T** Tampering | Any authenticated user could modify categories | Unauthorized catalog changes | Restricted category create/edit/delete to admins (`server/routes/CategoryRoute.js`) |
| **T** Tampering | Any authenticated user could change job status/select applicant/read applicants | Unauthorized job lifecycle manipulation | Added ownership/admin checks (`server/controllers/JobController.js`) |
| **R** Repudiation | Minimal request throttling on auth endpoints | Harder abuse attribution, noisy logs | Added explicit rate limiting with `Retry-After` for register/login/OTP routes |
| **I** Information Disclosure | Login request body printed in logs | Credential leakage to logs | Removed sensitive auth logs (`server/controllers/UserController.js`) |
| **I** Information Disclosure | OTP send endpoint revealed whether account exists | User enumeration | OTP send now returns generic response for unknown emails (`server/controllers/UserController.js`) |
| **I** Information Disclosure | `/api/auth/profile` excluded wrong field (`-password`) | Potential hash leak | Corrected to exclude `passwordHashed` (`server/routes/authRoutes.js`) |
| **D** Denial of Service | Unlimited auth and OTP requests | Endpoint abuse/resource exhaustion | Added in-memory rate limits for auth and OTP routes |
| **E** Elevation of Privilege | Public registration accepted `admin/superadmin` role values | Self-privilege escalation to admin | Restricted registration roles to `hire/work/both` only (`server/controllers/UserController.js`, `server/routes/authRoutes.js`) |

## Residual Risks / Next Steps
- In-memory rate limiting is per-instance only; for multi-instance deployments use Redis-backed limiter.
- OTP store is in-memory; migrate to persistent/shared store for horizontal scaling.
- Add structured security logging + audit trails for sensitive admin actions.
- Consider CSRF protection if cookie-based auth is used cross-site.
