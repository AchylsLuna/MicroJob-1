---
name: debug
description: Debug and fix a failing test, a 403/permission problem, or broken admin RBAC behaviour in the MicroJobs repo. Use when a test fails, when a staff role sees the wrong pages or gets an unexpected 403, when login resolves the wrong role, or when asked to debug/diagnose anything in server/ or client/.
---

# Debug workflow

A bug in this repo is usually one of four things. Identify which before
changing any code — the fix location differs completely.

| Symptom | Almost always |
|---|---|
| Staff member sees wrong nav / wrong pages | `staffRole` lost between server and client |
| Unexpected 403 on an admin route | Permission matrix vs. route gate mismatch |
| Test fails only in the full suite, passes alone | Timing — a fire-and-forget async write |
| Admin locked out entirely | `resolveStaffRole` returned `null` |

---

## 1. Reproduce before diagnosing

Never diagnose from reading alone — this repo has bitten us with
assumptions that looked right in the source. Run the thing.

```bash
cd server && npm test                     # full suite (in-memory Mongo, safe)
cd server && node --test tests/lib/X.test.js   # one file
cd client && npx tsc --noEmit -p tsconfig.json # client type check
```

`npm test` uses `mongodb-memory-server`, **not** the Atlas cluster. It is
always safe to run. Never point a test or script at `server/.env`'s Mongo
URI — that is production data.

## 2. Admin RBAC problems

Start here, it answers most permission questions in one command:

```bash
cd server && node scripts/debugAdminRbac.js            # full role x route matrix
cd server && node scripts/debugAdminRbac.js moderator  # one role, incl. what is blocked
cd server && node scripts/debugAdminRbac.js --orphans  # routes no role can reach
```

Read-only; it never opens a DB connection. If a role is missing a route it
should have, the mismatch is between two files that must agree:

- `server/lib/adminPermissions.js` — the real boundary (`ROLE_PERMISSIONS`)
- `client/src/lib/adminPermissions.ts` — UI mirror, hides nav/controls only

**These two are hand-synced.** A route the UI offers but the server denies
means the client matrix granted a permission the server one did not. Fix
the matrices, not the route.

### The staffRole chains — there are two

`staffRole` travels two independent paths. They fail separately and look
identical from the outside, so establish which one is broken first: if the
**nav** is wrong, it is the display chain; if a **request** is wrongly
allowed or denied, it is the enforcement chain. Both dropping the value
produce the same `admin_team` fallback, which is why this is worth checking
end to end rather than eyeballing.

**Display chain** — decides what the UI offers:

1. `server/models/User.js` — `staffRole` field stored on the account
2. `server/lib/authSession.js` → `buildLoginPayload` — **must** send
   `staffRole`; `role` alone flattens every staff member to `"admin"`
3. `client/src/contexts/AuthContext.tsx` — must read `apiUser.staffRole`,
   not derive it from `apiUser.role`
4. `client/src/hooks/useAdminPermissions.ts` — reads `user.staffRole`

Guarded by `tests/lib/loginPayloadStaffRole.test.js` (link 2).

**Enforcement chain** — the real security boundary:

1. `server/models/User.js` — same stored field
2. `server/middleware/auth.js` → `verifyToken` — **must** `.select()`
   `staffRole` and assign it onto `req.user` *after* the `...decoded`
   spread, so a forged token claim cannot override the database
3. `server/lib/adminPermissions.js` → `resolveStaffRole` — reads
   `req.user.staffRole`, falling back to `admin_team` when it is absent
4. `server/middleware/admin.js` → `requirePermission` — the gate itself

Guarded by `tests/middleware/authStaffRole.test.js`.

Link 2 breaking is the dangerous one, and it shipped once: `verifyToken`
selected only `role status`, so `req.user.staffRole` was always `undefined`
and *every* admin hit the `admin_team` fallback. `support_staff` gained
`staff.create` and could mint admin accounts; `finance_team` lost the
finance permissions it exists for. Nothing failed loudly.

**Why the tests did not catch it:** `tests/middleware/adminPermission.test.js`
and `adminRouteGating.test.js` hand-build `{ role: 'admin', staffRole: ... }`
and call `requirePermission` directly. They prove the matrix is right and say
nothing about whether the pipeline populates it. When you add RBAC coverage,
put wiring-level assertions in `authStaffRole.test.js`, which drives the real
middleware against a real database.

**The general lesson:** a permission value that is read in one file and
populated in another needs a test that spans both. Unit-testing the pure
function is not coverage of the boundary.

Note that `req.user.role` is also re-read from the database in `verifyToken`
rather than trusted from the token — `lib/auth.js` and
`middleware/optionalAuth.js` follow the same rule. If you add a new way to
build `req.user`, it must too.

In dev, the role switcher (bottom-right of any admin page) overrides the
signed-in role for **UI only** — the server still enforces the real one, so
a switched role hitting a 403 is correct behaviour, not a bug.

## 3. Flaky tests

A test that passes alone but fails in `npm test` is nearly always waiting
on a fire-and-forget async write with a fixed `setTimeout`. Under full-suite
load the fixed wait is too short.

Poll for the condition instead of sleeping:

```js
const waitForLogs = async (expected) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if ((await AuditLog.countDocuments({})) >= expected) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};
```

Keep a short fixed wait **only** when asserting something never happens.
See `tests/middleware/adminAuditLog.test.js` for both patterns.

## 4. Use the audit log as a debugger

Every mutating `/admin/*` request is recorded automatically by
`server/middleware/adminAuditLog.js` — including the ones that failed.
Failures store `category: 'error'` with the response message as `reason`,
so a 403 a user reports is already on record with the actor, their role,
and the target. Check the Audit Logs admin page or query `AuditLog`
directly before trying to reproduce by hand.

## 5. Before saying it is fixed

- Re-run the full suite, not just the file you touched.
- Run it **twice** if the fix was timing-related.
- Type-check the client if any `.ts`/`.tsx` changed.
- State what actually ran and what it printed. If something is still
  failing or unverified, say so plainly.
- Leave the changes uncommitted for review — never commit automatically.
