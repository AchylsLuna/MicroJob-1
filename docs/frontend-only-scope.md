# Frontend-only scope — no backend, no database

This is a hard rule for this phase of the project, not a preference. Any
AI agent (or contributor) working from this document must not modify the
API or the database under any circumstance. The current focus is UI,
animation, and client-side routes only, across both the web client and
the mobile app.

If a task seems to require a backend or schema change, **stop and flag it
instead of making the change.** See §4.

---

## 1. Never touch — hard boundary

Do not create, edit, or delete anything in:

- **`server/`** — the entire Express + MongoDB API: `server/routes/`,
  `server/controllers/`, `server/models/`, `server/services/`,
  `server/middleware/`, `server/config/`, `server/lib/`,
  `server/scripts/`, `server/tests/`.
- **The database** — MongoDB schemas/models, indexes, migrations, seed
  scripts, or the live data itself. This repo's `server/.env` points at a
  **real remote MongoDB Atlas cluster**, not a disposable local DB, so a
  bad write or a seed script run against it is not easily reversible.
- **`server/.env`** or any credentials (MongoDB URI, SMTP, Twilio,
  PayMongo keys).
- **API contracts** — request/response shapes, status codes, endpoint
  paths, auth/session behavior, Socket.IO events. Do not add, remove, or
  rename an endpoint or a field it returns.
- **Root-level scripts that start or manage the API**
  (`scripts/dev.cjs`, `scripts/start-development.cjs`, `server/package.json`
  scripts) and CI steps that run server tests or deploy the server.

Reading server code to understand what an API already returns is fine and
often necessary — the boundary is on **writing**, not reading.

---

## 2. In scope — frontend, UI, animation, and routes

### Web (`client/`)

- `client/src/pages/**`, `client/src/components/**` — screens and UI.
- `client/src/styles/**`, Tailwind classes, `client/tailwind.config.js`.
- Motion/animation using `motion` (Framer Motion successor) — see the
  `microjob` skill §3 for the house rules (transform/opacity only,
  reduced-motion, timing budget, no gradients).
- **Routes**: `client/src/App.tsx` (the `<Routes>`/`<Route>` tree) and
  `client/src/utils/routes.ts` (the `ROUTES` path constants). Adding,
  renaming, or reorganizing a client-side route/page is in scope; it does
  not touch the server.
- `client/src/contexts/**`, `client/src/hooks/**` — but only logic that
  *consumes* existing API calls (loading/error/UI state, formatting,
  client-side validation). Do not change what endpoint is called, what
  payload is sent, or add a new one.
- `client/src/services/**` — only if it's adapting how an existing
  response is used on screen, not the endpoint being hit.
- `client/src/i18n/**`, `client/src/locales/**` — UI copy and
  translations (English/Filipino).
- `client/public/**` — static assets, favicon, manifest.

### Mobile (`Mobile/`)

- `Mobile/pages/**`, `Mobile/components/**` — screens and UI.
- `Mobile/theme/**` — tokens, motion, category visuals (mirrors web, see
  the `microjob` skill §5 for which files must change together).
- **Routes/navigation**: `Mobile/components/navigation.tsx`,
  `Mobile/components/employerNavigation.tsx`,
  `Mobile/components/tabNavigation.ts`,
  `Mobile/components/navigationState.ts`,
  `Mobile/components/CompactBottomNavigation.tsx` — the
  `@react-navigation` stack/tab structure. Adding or rearranging a screen
  in the navigator is in scope.
- `Mobile/contexts/**`, `Mobile/hooks/**` — same rule as web: UI/state
  logic around existing API calls, not the calls' shape or targets.
- `Mobile/i18n/**`, `Mobile/locales/**` — UI copy and translations.
- `Mobile/assets/**` — images, icons, fonts.

---

## 3. The gray area: calling existing APIs

Frontend work legitimately calls the API — that's not a backend change.
The line is:

| Allowed | Not allowed |
|---|---|
| Calling an endpoint that already exists, exactly as it exists today | Adding a new endpoint, or a new field to an existing response |
| Changing how a response is rendered, formatted, or laid out | Changing what the server sends back |
| Adding client-side validation/UX (disable a button while pending, show an error state) | Adding or changing server-side validation |
| Reading `server/routes/` or `server/models/` to confirm a field name or shape | Editing those files to add the field you wish existed |

If the UI needs data the API doesn't currently provide, that is a backend
change by definition — flag it (§4) rather than adding it yourself, even
if the fix looks small.

---

## 4. If a task seems to need a backend change

Stop before writing any code in `server/`. Instead:

1. Say plainly what's missing (e.g. "the `/api/jobs/:id` response has no
   `applicantCount` field, and the UI needs one").
2. Propose the frontend-only workaround if one exists (compute it
   client-side from data already returned, hide the element, use a
   placeholder) so the UI task can still finish.
3. Leave the actual backend/database change for Elijah to do or
   explicitly approve — do not implement it "while you're in there."

---

## 5. Technical enforcement (local to this machine)

On top of this document, a `PreToolUse` hook (`scripts/guard-frontend-only.cjs`)
blocks Edit/Write/NotebookEdit calls whose path resolves under `server/`,
and Bash commands that look like they write to `server/` or touch MongoDB
directly (`mongosh`, `mongoimport`/`mongorestore`/`mongodump`, seed/migration
scripts, `npm install --prefix server`, etc.). It's wired into
`.claude/settings.local.json`, not `.claude/settings.json` — this repo's
`.claude/` folder is not pushed to GitHub, so the hook is local to this
machine/session only, not shared with other collaborators or agents working
on the repo elsewhere.

It's a heuristic safety net, not a substitute for this document: the Bash
pattern matching can be evaded by a sufficiently unusual command, and the
Edit/Write/NotebookEdit block (exact path matching) is the reliable half.
Reading `server/` — Read tool, `cat`/`grep`/`ls` in Bash — is intentionally
unaffected.

## 6. Relationship to the `microjob` skill

This document sets the **scope boundary** (what areas are off-limits).
The `.claude/skills/microjob/SKILL.md` skill sets the **house rules**
inside that scope — design tokens, motion conventions, no-gradients, and
how to run/verify the app. Both apply together: use the skill for *how*
to build UI/animation/routes, and this document for *where the boundary
is*.

---

## 7. Approved exception: Admin RBAC backend (2026-08-31)

Elijah explicitly approved a backend change on 2026-08-31, per §4's own
escalation path: wire up the real backend behind the Admin RBAC UI added
in commit `a47950ec` (Staff Management, Audit Logs, Moderation Queue,
Financial Disputes — all fixture-only until now) and add real per-role
audit logging for every admin action, server-side.

For the duration of this work, the `guard-frontend-only.cjs` PreToolUse
hook (§5) is disabled in `.claude/settings.local.json` so `server/` edits
are not blocked. This is a scoped exception for the admin-backend feature
described above, not a repeal of §1 — the frontend-only boundary still
applies to everything else, and the hook should be re-enabled once this
feature lands unless Elijah asks otherwise.
