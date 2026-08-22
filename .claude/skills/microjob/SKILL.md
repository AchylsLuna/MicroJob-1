---
name: microjob
description: Working rules, UI/motion conventions, and run instructions for the MicroJobs repo (Express/MongoDB API + Vite web client + Expo mobile). Use when building or restyling any screen, component, animation, transition, or loading state; and when asked to run, start, or verify a change in the actual running app.
---

# MicroJobs

Three areas share this repo: the API (`server/` — Express + MongoDB +
Socket.IO), the web client (`client/` — Vite + React + Tailwind; it has
**no `package.json` of its own**, so never run npm from inside it), and
`Mobile/` (Expo + React Native, pinned to SDK 54 / RN 0.81).

Web and mobile deliberately mirror each other's visual language, so **a
change to a shared concept usually needs both files edited** — see §5.

---

## 0. Working rules — read first

### Never auto-commit

**Do not commit, stage, or push.** Leave finished work uncommitted in the
working tree for review. Commit only when Elijah asks for that specific
commit — a previous "yes" does not authorize the next one. Do not offer
committing as a closing flourish.

Be careful with broad staging in particular: this tree routinely carries
substantial uncommitted work, and has been on a **detached HEAD**, where a
careless commit is easy to lose.

### Triple-check before implementing, and before asserting

Every claim about this codebase gets verified against the source, not
recalled or assumed:

- Grep across **both** `client/src` and `Mobile/` before saying a pattern
  exists, is absent, or is consistent. This repo duplicates concepts across
  two workspaces (§5), so a single-platform search is a wrong answer, not a
  partial one.
- Read the script a `package.json` entry actually points at before saying
  what it runs. Names mislead here: `check:mobile-theme` runs
  `checkTheme.cjs`, **not** the motion check.
- Confirm a check is wired into `verify` or `.github/workflows/ci.yml`
  before calling it enforced. Several are not (§7).
- Run the command and read its real output before reporting a result.
- Use absolute paths when checking whether a file exists. `cd` in one Bash
  call doesn't persist across calls, but it *does* apply to the rest of
  that call — a later relative `ls` can silently look in the wrong place.

If a claim can't be verified, say it's unverified rather than rounding it
up to true.

---

## 1. Standing design rules

### No gradients

Elijah has asked that gradients not be used. Do not add
`bg-gradient-to-*`, `from-`/`via-`/`to-` utilities, `linear-gradient()`,
`radial-gradient()`, or `<LinearGradient>` / `react-native-svg` gradient
defs.

Express depth and hierarchy with what the token system already has: a solid
`surfaceMuted` fill, a `border` hairline, elevation via shadow, or spacing.
Flat and confident beats a fade.

Gradients currently in the tree, if you are asked to remove them:

| File | Line | What it is |
|---|---|---|
| `client/src/components/LandingPageBlue.tsx` | 385 | hero panel fill |
| `client/src/components/LandingPageBlue.tsx` | 388 | radial dot texture |
| `client/src/components/LandingPageBlue.tsx` | 558 | green stat card |
| `client/src/components/ResetPassword.tsx` | 125 | success badge circle |
| `client/src/pages/admin/AdminEWalletMonitoring.tsx` | 237 | stat card icon chip |
| `client/src/pages/worker/Profile.tsx` | 278 | avatar placeholder |

`AdminEWalletMonitoring` is the one indirect case: line 237 applies
`bg-gradient-to-br ${card.accent}`, and the `from-`/`to-` pairs live in the
card data at lines 210 and 216. Flattening it means editing those two
`accent` values, not just the className.

### CategoryTile is already flat — keep it that way

CategoryTile was the load-bearing gradient and **has been flattened on both
platforms.** Do not reintroduce a fade there, and do not "restore" the
two-stop palette.

Its colors come from `client/src/lib/categoryVisuals.ts`, mirrored exactly
by `Mobile/theme/categoryVisuals.ts` — same palette order, same djb2 hash,
so a category renders identically on both platforms. Each palette entry now
carries exactly three fields:

```
fill    the saturated tile background (was `from`)
tint    the soft/low-emphasis variant
onFill  the icon color that sits on `fill` (was `onGradient`)
```

The old `to` field is gone — it existed only as the gradient's second stop.
`onGradient` is likewise gone everywhere, including the `BookmarkButton`
prop in both `JobCard.tsx` (web `onFill?: boolean`; mobile
`tone?: 'default' | 'onFill'` with a `bookmarkBtnOnFill` style).

Two things to know before touching this pair:

- **`tint` currently has no consumer.** Only `fill` and `onFill` are read.
  It is kept because it is the obvious hook for a soft-chip variant, but
  don't assume it is exercised anywhere — nothing will catch you if you
  break it.
- **`from`/`to`/`onGradient` are dead names.** If you see them in a diff,
  in older notes, or in this file's history, they are stale. Grep both
  workspaces before trusting any naming claim here.

### `overflow: 'hidden'` silently kills iOS shadows

On React Native, `overflow: 'hidden'` sets `clipsToBounds` on the layer, so
a View that carries **both** `overflow: 'hidden'` and `tokens.shadow.card`
renders its `elevation` on Android but **no shadow at all on iOS** — a
platform split that is invisible in code review and in web preview.

This bit CategoryTile: the `overflow: 'hidden'` was there only to clip the
absolutely-positioned gradient layers, and once the fill moved onto the
tile View itself the clip was vestigial while still suppressing the shadow.
When you flatten a surface, check whether its `overflow` was load-bearing
for the thing you just removed. Web is not affected — CSS `overflow: hidden`
does not clip an element's own `box-shadow`.

### Brand color has no shades

`client/tailwind.config.js` overrides `blue` 500 → 950 to the single brand
value `#1C4D8D`. `bg-blue-600`, `bg-blue-700`, and `bg-blue-900` render
identically. **Never express a hover or pressed state by stepping to a
darker blue** — it produces no visible change. Use opacity, scale, a ring,
or a `brandDark` (`#0F2954`) / `brandLight` (`#4988C4`) token.

---

## 2. Design tokens

**Mobile has a complete token system; web does not.** `Mobile/theme/tokens.ts`:

```
radius     sm 10 | md 14 | lg 18 | pill 999
spacing    xxs 4 | xs 6 | sm 10 | md 14 | lg 18 | xl 24 | xxl 32
typography h1 26 | h2 22 | h3 18 | body 14 | label/control 14–15 | caption 12
layout     gutter 16 | gutterWide 20 | sectionGap 16 | contentMaxWidth 720
controls   minimumTouch 44 | fieldHeight 52 | buttonHeight 52 | compactHeight 44
opacity    disabled 0.5
brand      brand #1C4D8D | brandDark #0F2954 | brandLight #4988C4
           brandSoft #EAF1FB | brandMuted #DCE6F7 | focusRing #5F83B3
state      success #10B981 | danger #EF4444 | warning #F59E0B | info #0369A1
           (each has a *Soft variant for backgrounds)
```

On mobile, **always** use `tokens.*` — a literal hex or raw number in a
style is a bug, and `npm run check:mobile-theme` (`checkTheme.cjs`) is in
`npm run verify` to catch it.

On web, values are hardcoded Tailwind classes. Match the mobile scale when
choosing (`rounded-[14px]` ≈ `radius.md`; `min-h-11` = 44 = `minimumTouch`).
If you're writing a fourth ad-hoc value in one file, extract
`client/src/constants/tokens.ts` mirroring the mobile file instead.

---

## 3. Motion

### Non-negotiables

1. **Respect reduced motion by skipping — not shortening.** Every animated
   component reads the platform hook.
2. **Animate only `transform` and `opacity`.** Never `width`, `height`,
   `top`, or `margin` — they reflow on web and fall off the native driver
   on mobile.
3. **Micro-interactions land in 120–200ms**; larger transitions 200–300ms.
   Past that reads sluggish, not smooth.
4. **Motion is feedback, not decoration.** If it doesn't confirm an action,
   show state, or direct attention, cut it.
5. **Budget it.** One orchestrated moment per surface beats scattered
   effects; animation on everything is what makes a UI read as
   AI-generated. Prefer invisible-but-felt feedback on shared primitives
   over a flourish at one call site.

### Mobile

Tokens in `Mobile/theme/motion.ts`:

```
duration  instant 120 | fast 180 | exit/modal 220 | enter/toast 240
          standard 260 | launch 420
press     scale 0.97, opacity 0.86
spring    damping 18, stiffness 220, mass 0.8
distance  micro 6 | small 8 | medium 16
```

Anything pressable uses `Mobile/components/ui/AnimatedPressable.tsx` — it
wires scale+opacity, honors `useReducedMotion`, stops in-flight animations,
and cleans up on unmount:

```tsx
import AnimatedPressable from '../ui/AnimatedPressable';

<AnimatedPressable onPress={handleApply} containerStyle={styles.cta}>
  <Text style={styles.ctaLabel}>Apply</Text>
</AnimatedPressable>
```

Raw `Pressable` is for non-visual hit targets only. Three files still use
it and could adopt the wrapper: `components/ConfirmModal.tsx`,
`components/ui/CanvasBackButton.tsx`, `pages/OnboardingCarouselScreen.tsx`.

### Web

The library is `motion` (the Framer Motion successor):

```tsx
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

const prefersReducedMotion = useReducedMotion();

<motion.div
  initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: prefersReducedMotion ? 0 : 0.24 }}
/>
```

`initial={false}` — not `{{}}` — is what actually skips the enter animation.

There is no web motion token file, and the 11 animating files disagree with
each other (tap scales `0.95` and `0.9`; durations `0.18`, `0.2`, `0.25`,
`0.3`). Converge on the mobile numbers: `0.18s` press, `0.24s` enter,
`scale: 0.97` press.

`client/src/index.css` has a global `prefers-reduced-motion` block clamping
CSS `animation-duration`/`transition-duration` to `0.01ms`. **It does not
cover JS-driven Motion animations** — those still need the hook.

### Highest-leverage gap

`Button` and `IconButton` in `client/src/components/ui/index.tsx` have
Tailwind `transition` + `hover:` but **no press feedback**. Adding it there
lands across the entire web app in one edit — do that before animating any
individual call site.

### Loading states: skeletons, not spinners

**Mobile already has the house pattern; web does not.**
`Mobile/components/NotificationFeedView.tsx` renders three placeholder rows
built from `tokens.colors.contentMuted` blocks at the real row height (92)
— flat fills, no shimmer sweep, which is exactly right under §1.
Generalize *that*; don't invent a new one.

Web has no skeletons at all — 15+ `animate-spin` spinners instead,
including `RouteLoading` in `App.tsx`, `StatusState tone="loading"` in
`components/ui/index.tsx`, and `ProtectedDashboardLayout.tsx`.

Rule of thumb: **a spinner is right when you don't know the shape of what's
coming; a skeleton is right when you do.** A job list, notification feed,
or profile has a known layout — reserve its space instead of spinning. Keep
an inline spinner for in-button pending states (`Loader2` + "Deleting…",
already used well in `JobsManagement.tsx`).

A skeleton here is a flat `contentMuted` / `slate-100` block at the real
content's dimensions. If it needs life, a slow opacity pulse is the ceiling
— never a moving highlight, which is a gradient by another name.

### Page and list transitions

`AnimatePresence` is used for modals and collapsibles only
(`CalendarPanel.tsx`, `PostJob.tsx`, `Support.tsx`) — there are **no
route-level transitions**. If adding them, wrap the route outlet in
`App.tsx`, keep to opacity + a ≤8px `y` offset at `0.2s`, and make sure
they don't fight the lazy-route `RouteLoading` fallback.

Staggered list entrances already exist in `JobCard.tsx`, capped as
`delay: Math.min(index, 8) * 0.04`. **Keep that cap** — uncapped
`index * delay` makes the 30th card arrive a second late. Reuse the
existing formula.

### Techniques that do NOT apply here

Generic "modern animation" lists circulate widely. Check against this stack
before importing anything:

| Technique | Verdict |
|---|---|
| **Three.js / WebGL 3D** | No. MicroJobs is a jobs marketplace; there's no 3D surface, and the bundle cost buys nothing. |
| **Flutter animations** (`AnimationController`, `Hero`, Dart) | No — wrong framework. Mobile is Expo / React Native. Flutter guidance does not translate. |
| **Glow, neon, light sweeps, animated masks** | No — gradients in motion; violates §1. |
| **Parallax / scroll-linked effects** | Rarely. A landing surface at most; on product screens it fights scroll performance and reduced motion. |
| **Staggered lists, skeletons, micro-interactions, page transitions** | Yes — the real gaps, see above. |
| **transform/opacity only, reduced motion, 200–300ms** | Yes — already the rule, and consistent with the mobile tokens. |

---

## 4. Quality floor

Every screen, before it's done:

- Responsive to mobile widths; touch targets ≥ 44 (`controls.minimumTouch`).
- Visible keyboard focus — web uses `focus-visible:ring-2 ring-blue-600`.
- Reduced motion respected (test it: macOS System Settings → Accessibility
  → Display → Reduce Motion).
- Empty and error states are directional, not decorative: say what happened
  and what to do next. An empty screen invites an action.
- Labels name what the user controls, in active voice, consistent through a
  flow — a "Publish" button produces a "Published" toast, not "Success."

---

## 5. Mirrored files

These pairs must change together or the platforms drift:

| Web | Mobile |
|---|---|
| `client/src/lib/categoryVisuals.ts` | `Mobile/theme/categoryVisuals.ts` |
| `client/src/components/ui/CategoryTile.tsx` | `Mobile/components/ui/CategoryTile.tsx` |
| `client/src/components/job/JobCard.tsx` | `Mobile/components/job/JobCard.tsx` |
| `client/src/components/ui/SectionHeader.tsx` | `Mobile/components/ui/SectionHeader.tsx` |
| `client/src/components/ui/CalendarPanel.tsx` | `Mobile/components/ui/CalendarSheet.tsx` |

`categoryVisuals.ts` says so in its own header comment: duplicated rather
than shared because `client/src` and `Mobile/` are separate npm workspaces
with separate bundlers.

---

## 6. Running the app

### Prerequisites

- **Node ≥ 22.13.0.** `.nvmrc` pins `22.13.0`. Every npm script is wrapped
  with `scripts/run-with-node.cjs`, which auto-switches via `nvm` when the
  ambient `node` is older — so `npm run dev` works even if `node -v` is
  behind, provided `nvm install 22.13.0` has been run once. No manual
  `nvm use` needed.
- **Dependencies**: `npm ci` from the repo root (also installs the `server`
  workspace). `predev` runs `check:dependencies` automatically.
- **Env file**: `server/.env` must exist (copy `server/.env.example` if
  missing). This repo's `server/.env` holds live third-party credentials
  (MongoDB Atlas URI, SMTP, Twilio, PayMongo test keys) — treat it as
  secret: never print it into logs or PRs, and note that a running instance
  hits the **real remote Atlas cluster**, not a throwaway DB, unless you
  unset `MONGO_URI`/`MONGODB_URI` (then `ENABLE_IN_MEMORY_MONGO` defaults
  on and `mongodb-memory-server` is used — see `server/config/env.js`,
  `server/lib/db.js`).

### Full environment (authoritative)

```bash
NO_OPEN=1 npm run dev
```

Starts or reuses the API, web app, and Expo Metro QR server, waiting on
health probes before printing a ready banner. `NO_OPEN=1` skips the default
`--open /admin-sign-in` browser launch. Auto-seeds a superadmin
(`AUTO_SEED_SUPERADMIN=true` by default).

Ports are **fixed by this script regardless of `server/.env`**: API `5050`,
web `8082`, Metro `8081` (override only via `DEV_API_PORT` /
`DEV_CLIENT_PORT` / `METRO_PORT`). It forces `PORT=5050` into the child API
process, overriding `server/.env`.

**A "(reused)" line means that service was already running before you
started it.** Say so rather than presenting it as proof your change is
live; restart that service if the change needs picking up.

Ctrl+C stops only services this invocation started. Use `npm run dev:tunnel`
when the phone can't reach the machine over LAN.

### API + web only (no Expo/Metro)

```bash
npm run dev:server &> /tmp/microjob-api.log &
VITE_API_PROXY_TARGET=http://localhost:5050 npm run dev:client &> /tmp/microjob-web.log &
```

**Gotcha**: `npm run dev:server` runs `nodemon scripts/start-development.cjs`
directly and honors `PORT=` from `server/.env` as-is (currently `5000`, not
`5050`), while Vite's proxy defaults to `5050`. Run these independently and
you must either pass `PORT=5050` to `dev:server` or point
`VITE_API_PROXY_TARGET` at the `.env` port. Only the unified `npm run dev`
reconciles this automatically.

### Smoke-test

```bash
curl -s http://localhost:5050/api/health
# → {"status":"ok","service":"microjobs-api","environment":"...","databaseId":"..."}

curl -s http://localhost:8082/ | grep -o '<title>[^<]*</title>'
# → <title>MicroJobs</title>
```

### Stop

```bash
lsof -ti:5050 -sTCP:LISTEN | xargs -r kill   # API
lsof -ti:8082 -sTCP:LISTEN | xargs -r kill   # web
lsof -ti:8081 -sTCP:LISTEN | xargs -r kill   # Metro
```

`$!` after `npm run ... &` is the npm wrapper's PID and npm doesn't forward
SIGTERM to its child — kill the port's listener instead.

### Mobile (Expo)

`npm run mobile:web` / `mobile:android` / `mobile:ios` run Expo directly,
but prefer unified `npm run dev` for Expo Go — it wires the
`/microjobs-api` and `/microjobs-socket` Metro proxies the app expects
instead of a stale LAN address. On an Expo Go version mismatch, run
`npm run mobile:start:clear` (SDK 54 / RN 0.81 are intentionally pinned —
never let a forced audit fix bump them).

---

## 7. Verify

Static checks won't catch a janky animation or a flattened tile that looks
wrong. **Launch the app (§6) and look at it.**

```bash
npm run check:mobile-theme                  # token gate (in `verify`)
npm run check:performance --prefix Mobile   # motion gate — opt-in, see below
npm run lint
npm run typecheck:web && npm run typecheck:mobile
```

`npm run verify` runs, in order: `check:security`, `check:mobile-theme`,
`check:mobile-auth-accessibility`, `lint`, `typecheck:web`,
`typecheck:mobile`, `test:server`, then `build` (which is `build:client` —
a `tsc` emit plus a Vite production build; nothing builds the server).
`npm run verify:full` adds Playwright. A clean `verify` does **not** mean
the app works.

Two things `verify` does **not** cover: the motion gate below, and anything
visual. Neither `lint` nor either typecheck would have caught a tile
rendering the wrong color, or an iOS-only missing shadow.

**The motion gate is opt-in.** `Mobile/scripts/checkMotionPerformance.cjs`
fails on `useNativeDriver: false` anywhere under `components/`, `contexts/`,
`hooks/`, `pages/`, `theme/`, and on `AppliedJobs.tsx`, `SavedJobs.tsx`, or
`EmployerJobPosts.tsx` losing `<FlatList>` virtualization. But no root
script and no CI workflow invokes it — verified against `package.json` and
`.github/workflows/ci.yml`. Run it by hand, and consider adding
`check:mobile-performance` to the root `verify` chain.
