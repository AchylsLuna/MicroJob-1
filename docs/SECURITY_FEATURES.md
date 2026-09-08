# Security features

Reviewed: 2026-09-08 · Branch `95%` · Commit `825160da`

An inventory of what actually enforces security in this repo, and where each
control is wired in. It is a companion to `SECURITY_ADVISORIES.md` (dependency
posture) and `DATABASE_OBJECTID_GUARD.md` (data-layer integrity).

**Read the "Wired in" column first.** A control that exists but is not
reachable from a request is not a control. That column is what surfaced the
dead rate limiter and the two ungated admin routes below.

---

## 1. Global middleware pipeline

`server/app.js` — order matters, and two orderings are deliberate.

| # | Line | Middleware |
|---|---|---|
| 1 | 39 | `applySecurityMiddleware` — trust proxy, HTTPS redirect, HSTS, helmet |
| 2 | 41–61 | Request ID + **production 5xx scrubbing** (drops `error`, `stack`, `details`) |
| 3 | 63 | `morgan` — terse in production; no bodies or headers logged |
| 4 | 67–70 | `express.json({ limit: '1mb' })` + `req.rawBody` capture |
| 5 | 71–72 | `cookieParser`, `urlencoded` (1mb) |
| 6 | 73 | `sanitize` — NoSQL key scrubber |
| 7 | 74 | `csrfForCookieSession` |
| 8 | 76 | CORS |
| 9 | 99 | `errorHandler` — registered last |

Two things worth knowing:

- `sanitize` and CSRF run **before** CORS, so they apply even to requests CORS
  would later reject.
- `req.rawBody` is captured at step 4 precisely because `sanitize` rewrites
  `req.body` at step 6, and the PayMongo webhook HMAC must be verified over the
  exact bytes that were signed.

## 2. Authentication

| Feature | Location | Wired in |
|---|---|---|
| JWT secret | `lib/jwtSecret.js:4-23` | **Throws** in production if `JWT_SECRET` unset; dev falls back to a known literal |
| Token verification | `middleware/auth.js` | Per-route `verifyToken` |
| Sessionless-token rejection | `middleware/auth.js:30-33` | 401; asserted by `check-security.mjs:115-118` |
| Session validation | `middleware/auth.js:36-49` | Rejects missing/inactive/mismatched/expired sessions |
| **DB-authoritative role** | `middleware/auth.js:56-77` | `role`/`staffRole` re-read from DB and assigned **after** the `...decoded` spread |
| Optional auth | `middleware/optionalAuth.js` | `routes/JobRoute.js:23,24,26,28` only |
| Scoped download tokens | `lib/auth.js:21-35` | Requires `purpose === 'upload-download'` **and** a filename match |
| Socket auth | `lib/socket.js:113-128` | Requires `sessionId`; per-user (5) and per-IP (20) connection caps |

The after-the-spread assignment at `auth.js:65-77` is the load-bearing detail: a
forged `staffRole` claim in a token cannot override the database. This link
shipped broken once — `verifyToken` selected only `role status`, so every admin
fell through to the `admin_team` fallback, silently granting `support_staff` the
ability to mint admin accounts. It is currently correct and guarded by
`tests/middleware/authStaffRole.test.js`.

## 3. Authorization (RBAC)

Five staff roles plus `superadmin`. The matrix lives in **two hand-synced
files** — `server/lib/adminPermissions.js:19-67` is the security boundary;
`client/src/lib/adminPermissions.ts:67-121` is a UI mirror that only hides
navigation.

**Verified this pass: the two matrices are element-for-element identical.** No
drift.

| Role | Permissions |
|---|---|
| `superadmin` | all (short-circuited in `hasPermission`) |
| `admin_team` | `staff.*`, `audit.view`, `users.view`, `users.suspend`, `jobs.view`, `analytics.*`, `support.tickets.handle` |
| `moderator` | `users.view/suspend/ban`, `verification.review`, `moderation.review/enforce`, `jobs.view` |
| `finance_team` | all six `finance.*`, `analytics.*` |
| `analytics_team` | `analytics.view`, `analytics.export` |
| `support_staff` | `users.view/resetPassword/unlock`, `jobs.view`, `support.tickets.handle`, `support.escalate` |

Gates: `requireAdmin` (coarse), `requirePermission(p)`, `requireSuperadmin` —
all in `server/middleware/admin.js`. Applied across `AdminRoute.js`,
`UserRoute.js`, `CategoryRoute.js`, `PaymentRoute.js`.

Delegation policy in `lib/adminUserPolicy.js` additionally prevents self
role-change, self-disable, and demoting the **last active superadmin** (409).

Staff-account enumeration is blocked by returning **404 rather than 403** for a
staff profile requested by a non-staff user (`lib/staffProfileVisibility.js:37-49`).

## 4. MFA and OTP

| Feature | Location | Notes |
|---|---|---|
| TOTP | `lib/mfaHelpers.js:78-87` | `speakeasy`, `window: 1` |
| Backup codes | `lib/mfaHelpers.js:69-76` | `crypto.randomBytes`, **bcrypt-hashed** |
| Two-step enable | `controllers/MfaController.js:56-91` | Pending secret is only promoted after a valid code |
| OTP codes | `lib/otpChallenges.js:7-8` | `crypto.randomInt`; stored as **HMAC-SHA256**, never plaintext |
| Constant-time compare | `lib/otpChallenges.js:9-13` | `timingSafeEqual` with length guard |
| Replay protection | `lib/otpChallenges.js:71-75` | Atomic single-consume claim |
| Attempt cap | `lib/otpChallenges.js:55-59` | Atomic `$inc` guarded on `attempts < max` |
| Phone OTP config | `lib/phoneOtp.js:31-93` | Rejects the `development` provider in production; validates Twilio SID/E.164 |

`models/OtpChallenge.js:8` marks `codeHash` as `select: false` with a TTL index.

## 5. Passwords and lockout

- Policy: 8 chars + upper/lower/digit/special — `lib/passwordPolicy.js`, mirrored
  client-side in `client/src/lib/passwordPolicy.ts` and `Mobile/lib/passwordPolicy.ts`.
- Hashing: **bcryptjs cost 10** (`models/User.js:433-443`); `passwordHashed` is
  `select: false`.
- **Login enumeration defence** (`controllers/AuthController.js:146-208`): a
  constant dummy hash is bcrypt-compared when no account matches, so the miss
  path costs the same as the wrong-password path. One generic message covers
  missing account, wrong password, *and* locked account.
- **Lockout** (`lib/loginLockout.js`): 5 failures → 15m / 30m / 60m escalating.
  Counters are `select: false` so they never leak into a response. The lock is
  checked **before** bcrypt.
- Password change/reset revokes sessions (`controllers/UserController.js:172-181`);
  a change preserves only the current session.

## 6. Rate limiting

Real limiters are `express-rate-limit` in `server/lib/rateLimiters.js`:

| Limiter | Window / Max | Key |
|---|---|---|
| `loginLimiter` | 15m / 20 | ip + account |
| `accountLoginLimiter` | 15m / 10 | **account only — IP-free** |
| `registerLimiter` | 15m / 20 | auth |
| `otpSendLimiter` | 10m / 5 | auth |
| `passwordResetRequestLimiter` | 15m / 5 | auth |
| `qrSettlementLimiter` | 10m / 30 | user \| ip |

The IP-free `accountLoginLimiter` (`rateLimiters.js:28-38`) is the interesting
one — it deliberately drops the IP from the key so distributed credential
stuffing against one account still hits a ceiling.

Also: message write limits (`routes/MessageRoute.js:7-13`), ID-scan limits
(`models/IdAnalyzerModel.js:24-29`), socket connection limits, and a 60s phone
OTP resend cooldown.

## 7. CSRF

Double-submit cookie (`server/middleware/csrf.js`), applied globally at
`app.js:74`. `csrfForCookieSession` **skips** when: the method is safe; header
`x-microjobs-client: native`; an `Authorization: Bearer` header is present; the
path is a login/register/otp/password-reset entry point; or no session cookie
exists.

The `native` and `Bearer` bypasses are safe against a browser CSRF attacker
because neither header can be set cross-origin without a CORS preflight the
server would have to approve.

The CSRF token is minted per login as `crypto.randomBytes(24)` and set
`httpOnly: false` (`lib/authSession.js:96-100`) — it must be JS-readable for the
double-submit pattern to work.

## 8. Input handling

| Control | Location |
|---|---|
| NoSQL key scrubbing | `middleware/sanitize.js` — drops `$`-prefixed and dotted keys, recursive, **fails closed** (400) |
| Mass-assignment defence | `controllers/UserController.js:587-700` — 18-field allow-list, explicitly rejects `email`, rejects the first unsupported field |
| URL scheme validation | `UserController.js:550-563` — rejects `javascript:`/`data:`, requires HTTPS |
| **PCI scope reduction** | `lib/paymentMethodValidation.js:10-18` — rejects the request outright if `cardNumber`, `number`, `cvv`, or `cvc` is present |
| Message limits | `lib/messageSecurity.js` — 4000 chars, ObjectId validation |
| ObjectId validators | `lib/dataIntegrity.js` — startup check; see `DATABASE_OBJECTID_GUARD.md` |

## 9. CORS, headers, transport

- Helmet at `middleware/security/security.js:55-62`, with **CSP deliberately
  disabled** (the API serves no HTML) and a permissive cross-origin resource
  policy for uploads.
- HSTS `max-age=63072000; includeSubDomains; preload` + HTTPS redirect in
  production (`security.js:45-53`).
- `trust proxy` defaults to **false** and is opt-in via `TRUST_PROXY`
  (`security.js:3-26`).
- Production requires a configured origin set — `config/env.js:51-53` throws at
  import time otherwise, and `lib/runtimeConfig.js:47-55` requires it be `https:`.
- Browser-facing CSP/X-Frame-Options/Referrer-Policy are set at the edge in
  `vercel.json`, not by Express.
- **Non-production CORS allows every origin** (`corsConfig.js:8-11`).

## 10. File uploads

All four multer instances use `memoryStorage()` with a **5 MB cap** — nothing
is written to disk (`middleware/uploadConfig.js:18-21`).

Defence in depth: extension allow-list → MIME allow-list → **magic-byte
signature verification** (`uploadConfig.js:87-122`), because the first two are
attacker-controlled. Filenames are validated against path traversal in
`lib/uploadStore.js:6-12`.

Serving is access-controlled (`routes/UploadRoute.js:61-80`): avatars and
portfolio media are public by design; resumes and verification documents require
the owner, an admin, **or** an employer whose own job the owner applied to —
verified by an actual `Job` + `JobApplication` query, not a claim. Sensitive
files get `nosniff`, `private, no-store`, and an `attachment` disposition.

## 11. Sessions

- Access token 15 min; session 7 days (`lib/authSession.js:11-12`).
- Refresh token: `crypto.randomBytes(64)`, stored **only as SHA-256**.
- **Rotation with replay detection** (`controllers/SessionController.js:37-42`):
  a conditional `findOneAndUpdate` guarded on the old hash, so a replayed token
  gets "Refresh token already used".
- Absolute expiry is anchored to `session.createdAt`, so refreshing **cannot**
  extend the 7-day window.
- Refresh tokens are returned in the JSON body **only to native clients**; web
  gets httpOnly cookies only (`authSession.js:20-27`).
- Session list/revoke are ownership-checked; revoke-all disconnects sockets and
  clears all four cookies.

## 12. Audit logging

`middleware/adminAuditLog.js`, wired once at `routes/AdminRoute.js:35` for the
whole `/api/admin` tree. Logs every **mutating** request including failures
(`category: 'error'` with the response message as the reason), so a reported 403
is already on record with actor, role, and target.

The sink (`lib/monitor.js:57-86`) performs **recursive redaction** of any key
matching `authorization|cookie|token|secret|password|otp|code|email|phone|card|cvv`.

## 13. Payment webhook

`controllers/PaymentController.js` `handleWebhook` — intentionally
unauthenticated; the signature *is* the authentication.

Requires the `paymongo-signature` header, **fails closed if
`PAYMONGO_WEBHOOK_SECRET` is unset**, enforces a timestamp window against replay,
requires `req.rawBody` rather than falling back to the sanitized body, and
compares HMAC-SHA256 with `crypto.timingSafeEqual`.

## 14. Client and mobile

| Control | Location |
|---|---|
| Web token storage | **No JWT in browser storage.** httpOnly cookies only; `AuthContext.tsx:358-362` actively deletes legacy `auth_token` keys |
| Mobile token storage | `expo-secure-store` via the single adapter `Mobile/lib/storage.ts`, with legacy AsyncStorage migration |
| Storage adapter enforcement | `scripts/check-ui-security.mjs:25-27` — only `Mobile/lib/storage.ts` may import AsyncStorage |
| Idle logout | 15 min on both platforms (`client/src/App.tsx:20-21`, `AppSessionContext.tsx:101-102`) |
| Open-redirect guard | `client/src/utils/authRedirects.ts:27-33` — rejects `//evil.com`, `/\`, non-`/` values |
| External URL allow-list | `safeExternalUrl.ts` (both platforms) — HTTPS-only, payment-host allow-list |
| Backend-identity binding | `AppSessionContext.tsx:479-490` — refuses to reuse a session against a different backend |
| Refresh single-flight | `Mobile/lib/api.ts:36-85` |

**No `dangerouslySetInnerHTML`, `eval`, `new Function`, or `document.write`
anywhere in `client/src` or `Mobile/`.**

## 15. Automated gates

`scripts/check-security.mjs` runs in `npm run verify` **and** as a separate CI
step. It enforces:

- `npm audit` clean of high/critical for root/server (production **and** full).
- Mobile advisories restricted to a written allow-list of Expo/Metro build
  tooling.
- **No `.env` file may be git-tracked** (except `.env.example`).
- Secret scanning for Twilio SIDs, private-key headers, and credential-bearing
  Mongo URIs.
- No `Math.random()` in any auth/otp/session/token/mfa file.
- No process-local `Map` OTP storage (with `phoneOtp.js` as the one documented
  exception).
- A regex assertion that `middleware/auth.js` still rejects sessionless tokens.
- Then invokes `scripts/check-ui-security.mjs` and three security test files.

> **Correction worth recording:** `check:ui-security` is often assumed to be an
> orphaned script because grepping for the npm script name finds only its own
> definition. It is **not** orphaned — `check-security.mjs:120` invokes it by
> file path (`execFileSync(process.execPath, ['scripts/check-ui-security.mjs'])`),
> so it does run in `verify` and in CI. Verified this pass.

`server/tests/` carries ~60 files; the security-specific ones assert forged
`staffRole` rejection, CSRF enforcement, sanitizer fail-closed behaviour, login
enumeration indistinguishability, lockout non-leakage, refresh replay rejection,
webhook signature tampering, and upload signature mismatch.

---

## Findings

### Fixed this pass

| # | Finding | Location |
|---|---|---|
| F1 | **Idle logout never ended the server session.** A bare `fetch` POSTed to `/api/auth/logout` without the `x-csrf-token` header. That path is *not* in the CSRF bypass list, so the server returned 403: the client cleared localStorage and navigated away while the httpOnly session cookie stayed valid. Now routed through the existing `logoutUser()` API client, which attaches CSRF — the same helper `AuthContext` already used. | `client/src/App.tsx:97-101` |
| F2 | **Dead rate-limit middleware deleted.** `createRateLimiter` — a hand-rolled in-memory limiter — had zero importers repo-wide and no test, while sitting at the obvious path `middleware/rateLimit.js`. It made the rate-limiting surface look broader than it is. | `server/middleware/rateLimit.js` (removed) |
| F3 | **Stale comment claimed the server has no RBAC.** The client mirror stated "the server currently has no concept of these roles and does not check them" — false; `requirePermission` gates 29 route registrations. A developer trusting it would conclude client checks were the only defence. | `client/src/lib/adminPermissions.ts:4-8` |
| F4 | Doc comment pointed at `server/middleware/adminPermission.js`, which does not exist. Corrected to `middleware/admin.js`. | `server/lib/adminPermissions.js:5` |
| F5 | Four undocumented env vars added to `.env.example`: `QR_INVOICE_SECRET`, `IDANALYZER_KEY`, `KYC_PROFILE_ID`, `MOBILE_RESET_URL`. | `server/.env.example` |
| F6 | **Two ungated admin routes now gated.** `GET /stats` requires `analytics.view` (it mixes user/job/category counts with financial aggregates — `completedPayoutVolume`, `totalTransactions`, `pendingPayouts`); `GET /categories` requires `jobs.view` (category taxonomy is job metadata). The client already anticipated this — `client/src/hooks/useAdminData.ts:128-134` fetches every dashboard section with `Promise.allSettled` and explicitly treats a `403` on any one section as "degrade to empty default," not a hard failure — the server-side gate had just never been finished for these two. `moderator` and `support_staff` no longer see platform-wide financial totals; `finance_team` and `analytics_team` no longer see the category list. Covered by two new tests in `server/tests/middleware/adminRouteGating.test.js`. | `server/routes/AdminRoute.js:37,40` |

### Reported — needs your decision

| # | Severity | Finding |
|---|---|---|
| ~~R1~~ | ~~High~~ | **Fixed** — see F6 above. |
| R2 | **Medium** | **QR invoice cipher reuses the JWT signing secret.** `QrSettlementController.js:17` derives its AES-256-GCM key from `QR_INVOICE_SECRET \|\| JWT_SECRET \|\| 'microjobs-local-qr-secret'`. In production `JWT_SECRET` is mandatory, so the hardcoded literal is *not* reachable there — but one secret then serves two unrelated cryptosystems, and rotating the JWT secret silently invalidates every outstanding invoice code. Now documented (F5); setting it is still a deployment action. |
| R3 | **Medium** | **10 of 24 permissions have no server enforcement; 7 are checked nowhere at all** — `analytics.export`, `users.resetPassword`, `users.unlock`, `finance.reconciliation.view`, `finance.flag`, `finance.logs.view`, `support.escalate`. `users.ban` and `staff.toggleStatus` are enforced **client-side only** (`AdminModerationQueue.tsx:183`, `AdminStaffManagement.tsx:268`). The matrix promises a richer model than is implemented. |
| R4 | **Medium** | **`debugAdminRbac.js` gives false assurance.** It imports only `AdminRoute.js` (`:15`), so it is blind to the gates in `UserRoute.js`, `CategoryRoute.js`, and `PaymentRoute.js` — which is why it prints "SUPERADMIN-ONLY (0)" despite `requireSuperadmin` guarding four real routes. (Its "No unreachable routes" line, previously also masked by the R1 gap, now correctly shows `/stats` and `/categories` reachable by fewer roles than before — re-run and verified after F6.) |
| R5 | **Medium** | **Swallowed audit writes on money movement.** `JobController.js:303`, `:480`, `:569` wrap `monitor.audit()` for escrow, payout, and refund in empty catch blocks. A failing audit sink drops the compliance trail for financial events with no signal at all. At minimum these should `console.error`. |
| R6 | **Low** | Web guards accept a user-editable localStorage blob as proof of session and role (`RoleRoute.tsx:17-26`, `ProtectedDashboardLayout.tsx:12-24`). A user can set `auth_user.role = "admin"` and reach the admin *shell*; the API still enforces the real role (now including `/stats` and `/categories`, per F6), so this is UI exposure rather than data access. |
| R7 | **Low** | `server/.env.example:75-77` ships a working-looking superadmin credential (`SUPERADMIN_PASSWORD=Admin123.`) alongside a real personal email address. Harmless while `AUTO_SEED_SUPERADMIN=false`, but a copied example plus one flag flip creates a known admin login. |
| R8 | **Low** | Expo **web** builds store the JWT in localStorage (`Mobile/lib/storage.ts:11,30`), unlike the Vite web client which is cookie-only. |
| R9 | **Low** | No certificate pinning, root/jailbreak detection, or screenshot protection in the mobile app. Reasonable for the current threat model; recorded so the decision is explicit. |
| R10 | **Low** | `MessageRoute.js:15,17,19,30` applies `messageWriteLimiter` **before** `auth`, so those buckets key on IP rather than user. `/api/auth/google` gets `loginLimiter` but not `accountLoginLimiter`. MFA management routes have no limiter. |
| R11 | **Info** | `lint:all` (`package.json:40`) is a byte-identical duplicate of `lint` and is invoked by nothing. `Mobile` `check:performance` and `scripts/guard-frontend-only.cjs` are genuinely unreferenced by any script or workflow. |
| R12 | **Info** | CI runs `check:security` twice — once as its own step and again as the first link in `verify`. |

### Verification

Everything below was run after F6 (the `/stats` and `/categories` gates), and
all of it passed:

```
npm run lint                          → clean, exit 0
npm run typecheck:web                 → clean, exit 0
npm run typecheck:mobile              → clean, exit 0
npm run check:security                → passed (includes check-ui-security across 231 files
                                         + phoneOtp / legacyPhoneRoute / csrf tests)
cd server && npm test                 → 272 passed, 0 failed (270 baseline + 2 new
                                         adminRouteGating cases for F6)
node server/scripts/debugAdminRbac.js → confirms /stats and /categories are now
                                         reachable by fewer roles than before
```

The `# Sanitization failed Error: unreadable query` line in the test output is
**not** a failure — it is the deliberately-triggered error behind
`sanitizer fails closed when request data cannot be inspected`.

Not covered by any of the above: R2 through R12 are unverified by tooling
because no test asserts them.
