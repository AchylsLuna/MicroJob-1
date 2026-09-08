# Frontend UI changes

A running record of frontend-only UI work on MicroJobs — the Expo mobile app
(`Mobile/`) and the web client (`client/`). Frontend only — no backend, schema, or API
changes are tracked here.

Add new items under **Backlog**; move them up as they are built.

---

## Done

### Mobile — navigation

- **Floating glass tab bar** — `Mobile/components/CompactBottomNavigation.tsx`.
  Rebuilt as a translucent bubble bar (`expo-blur`) with a navy pill that springs
  between tabs. It overlays content so the background scrolls behind it.
- **Tab bar clearance** — `Mobile/theme/tokens.ts`. `tabBarClearance` raised 24 → 104
  because the bar now overlays instead of sitting in flow. Explicit clearance added to
  `pages/pages1/WorkerInbox.tsx` and `pages/employer/EmployerInbox.tsx`, whose chat
  inputs would otherwise sit under the bar.
- **Home icon** — `Mobile/components/navigation.tsx`. Worker "Jobs" tab uses a house
  icon instead of a briefcase.

### Mobile — worker screens

- **Jobs home** — `Mobile/pages/pages1/Jobs.tsx`. Greeting header, search paired with a
  filter button carrying a live count badge, then Recent Jobs. The old inline clutter
  (refresh toolbar, deadline/category/job-type chip rows, matching preferences) moved
  into a bottom-sheet Filters modal.
- **Job card** — `Mobile/components/job/JobCard.tsx`, `components/job/jobCardModel.ts`.
  Title, poster, relative post age, type badges, a soft panel holding location and pay,
  skill chips with a `+N` overflow, and a 44pt bookmark. `postedLabel` added to the card
  model (reusing `formatNotificationTime`).
- **Job details** — `Mobile/pages/pages1/JobDetails.tsx`. Back + share top bar (built-in
  `Share`), left-aligned identity row with the bookmark, chip row limited to real fields,
  Description / Company / **Review** tabs (Review reuses `ProfileReviewsLoader`),
  "About this role" with a Read-more toggle, and a full-width sticky Apply bar.
  `onBack` wired in `Mobile/app.jsx`.
- **Profile** — `Mobile/pages/pages1/Profile.tsx`. Three stat tiles (rating, completed,
  applied); the Ratings & Reviews block moved behind the AVG. rating tile as a bottom
  sheet; the duplicate "Switch to Hire Mode" row removed.
- **Settings** — `Mobile/pages/pages1/Settings.tsx`. The existing account-mode card
  restyled as the "Switch to Hire Mode" toggle, keeping its confirmation step. Gained a
  **Manage Withdrawals** row in the worker Account section (routes to the Wallet tab);
  the employer branch is untouched, since employers have their own wallet screen.
- **Profile "GENERAL" menu removed** — `Mobile/pages/pages1/Profile.tsx`. Settings
  already had Personal Information and Location Services, so this was a de-duplication
  rather than a move. Profile keeps its header gear for Settings, and the Wallet is a
  bottom-nav tab, so nothing was stranded. The unused `onOpenLocation` /
  `onOpenWithdrawals` props were dropped from Profile and `Mobile/app.jsx`.
- **Onboarding dots** — `Mobile/pages/OnboardingCarouselScreen.tsx`. The active dot
  overlapped its neighbour because `transform: scaleX` does not affect layout; now
  animates real `width`, so dots push each other along.

### Mobile — employer screens

- **Employer home** — `Mobile/pages/employer/EmployerJobPosts.tsx`. Four stat tiles
  (Active Jobs, Total Jobs, AVG rating, Remaining Vacancy = `positionsNeeded − hiredCount`),
  a full-width "Post a New Job" button, and per-card applied count + relative age.
- **Post a job** — `Mobile/pages/employer/EmployerPostJob.tsx`. Deadline date/time fields
  now distinguish placeholder from a chosen value (previously identical, so you could not
  tell whether a deadline was set); the urgent toggle uses brand colours and has a hint.
- **Applications** — `Mobile/pages/employer/EmployerApplications.tsx`. Removed a
  mid-grey location pin drawn on dark navy (near-invisible) and raised 9px stat labels.

### Web — landing page

All under `client/src/components/LandingPageBlue.tsx` unless noted.

- **"How it works"** — a three-step section modelled on the Upwork reference, with a
  short screen-capture of the real app (`client/public/media/`, mp4 + poster) rather
  than stock footage.
- **Hero** — the illustrated hero was cut; it read as AI-generated. After several
  rejected replacements (app screenshot, team photograph) the hero now holds a
  deliberately empty photo slot plus a quote. The slot is a single
  `const heroPhoto: string | null = null` — set it to a path when real art exists.
- **Team cards** — the testimonial row became team members with blank photo slots.
  No real names or photographs: the site is public and the team did not consent to
  being on it.
- **Public job browsing** — the `if (!isAuthenticated)` gate around the job fetch was
  removed, so signed-out visitors can read posted jobs. The apply button becomes
  "Sign up to apply"; applying still requires an account and verification.
- **Job card imagery** — category icons dropped. A card shows the job's own image,
  falling back to the poster's avatar, then to initials —
  `toAbsoluteAssetUrl(job.image) || toAbsoluteAssetUrl(job.jobPoster?.avatarUrl)`.

### Web — auth, legal, and consent

- **Auth shell** — `client/src/components/auth/AuthShell.tsx`. One frame for sign-in,
  sign-up and password recovery, replacing three divergent split-screen layouts. It
  owns the `<main>` and the page's only `<h1>`, because the e2e suite asserts exactly
  one visible instance of each; screens using it must not render their own.
- **Role chooser** — `auth/RoleChooser.tsx`, `auth/RoleIcons.tsx`. Two flat tiles,
  **Employer / Worker**, plus an "I want to do both" link, feeding the existing
  `userType` contract (`employer | worker | both`). lucide has no combined
  person-plus-object glyph, so the two icons are hand-drawn SVGs at `strokeWidth: 3`
  — thinner strokes turned to mush at the 36px render size.
- **Password field** — `auth/PasswordField.tsx`. One show/hide implementation
  replacing four inline copies; supports both controlled and `inputRef` use.
- **Merged legal page** — `client/src/components/LegalPage.tsx` +
  `client/src/constants/legalDocuments.ts`. Terms, Privacy and Cookie Policy became one
  page with a document list and a `?doc=` query param, replacing three near-identical
  page shells. The copy was moved across verbatim. `/terms`, `/privacy` and
  `/cookie-policy` still work, as redirects.
- **Cookie consent** — `client/src/components/CookieConsent.tsx`,
  `client/src/lib/cookieConsent.ts`. Bottom bar plus a preference centre with
  necessary / performance / functional / targeting categories, stored client-side under
  `cookie_consent_v1`. Nothing is sent to the server.
- **`llms.txt`** — `client/public/llms.txt`, served at the site root so language models
  crawling the site get a structured summary instead of a 459-byte SPA shell.

### Web — bugs found and fixed

Each of these was reproduced in a browser before being changed, not inferred:

- **Analytics ignored consent.** `@vercel/analytics` was mounted unconditionally in
  `main.tsx`, so the tracker loaded even after "Reject all" — the preference centre
  offered a Performance toggle that controlled nothing. Now gated behind
  `ConsentGatedAnalytics.tsx`, which also listens for the consent-changed and
  `storage` events so a decision in another tab applies here.
- **The legal Back button always went home.** All three old pages hardcoded
  `navigate(ROUTES.home)`, so opening Terms from `/sign-up?role=worker` and pressing
  Back lost the role step. The shared handler now uses `navigate(-1)` when
  `location.key !== "default"`, falling back to home only for a direct deep link.
- **Legal links toggled the consent checkbox.** The links sat inside
  `<label htmlFor="signup-terms">`, so clicking "Terms and Conditions" both navigated
  *and* flipped the agree box. Fixed with `stopPropagation` rather than by breaking the
  label, which keeps the text itself clickable.
- **Legal page overflowed horizontally at 320/375px.** A CSS grid child defaults to
  `min-width: auto` and refuses to shrink below its content; `min-w-0` on both children
  fixed it.
- **The sign-up draft was wiped on return.** Under StrictMode's double mount, the save
  effect ran before hydration and wrote empty state over the stored draft. Gated behind
  `isDraftHydrated`. Passwords were also removed from the draft while fixing this.
- **The consent banner covered the sign-up submit button at 320px.** A `ResizeObserver`
  now reserves matching body padding for the bar's real height.

### Cross-cutting

- **Shared components** — `Mobile/components/ui/MenuCard.tsx` (extracted from Settings),
  `Mobile/components/ui/StatTile.tsx`, `Mobile/hooks/useReviewSummary.ts`.
- **Icon reduction** — decorative icons removed from all 10 `EmployerAccordion` call
  sites and from `EmployerModeBanner` (`Mobile/components/employer/EmployerUI.tsx`);
  `icon` is now opt-in rather than defaulted. Menu-row icons were kept deliberately —
  they aid scanning in a long list.
- **Legibility** — sub-legible content labels (8–9px) raised in
  `pages/employer/ChatScreen.tsx`, `EmployerEWallet.tsx`, and `EmployerApplications.tsx`.
  Numeric badge counters left at 9px, which is conventional inside a small circle.
- **Locale guard** — `Mobile/scripts/checkLocales.cjs` (`npm run check:locales`, chained
  into `npm run verify`). Fails on invalid JSON, keys missing from a locale, mismatched
  `{{placeholders}}`, and wholesale reformatting of the locale files. Note it covers
  `Mobile/` only — the web locales under `client/src/locales/` are not guarded.
- **Dead auth keys removed** — `client/src/locales/{en,tl}/auth.json`, 186 → 161 keys
  each, left over from the auth rewrite: `signIn.hero.*`, `signUp.hero.*`,
  `signUp.userType.*`, `forgotPassword.progress.*`, `signUp.successBanner.title`.
  `signUp.roleChooser.roleName.*` was deliberately kept — it looks unused to a text
  search but is built as a template literal in `SignUp.tsx`, so scan for
  `` t(`…${ `` before deleting any key that appears orphaned.

### Conventions being followed

- **No gradients** — flat fills, opacity, elevation, and spacing instead.
- **Navy brand** (`#1C4D8D`) kept; reference mockups were copied for layout, not palette.
- **No invented data** — fields with no source in the schema (years of experience,
  work mode, rank percentile, pay ranges, shift windows) are omitted rather than faked.
- **Both locales** — every new string added to `en` *and* `fil` on mobile (`en` and `tl`
  on web); a missing key renders as the raw key path to the user.
- **No real people on public surfaces** — the site is public, so team members' names and
  photographs stay off it. Placeholder slots and invented names are fine.

---

## In progress

<!-- Nothing in flight. -->

---

## Backlog

- **Hero and team photography.** Both are empty slots waiting on real art —
  `heroPhoto` in `LandingPageBlue.tsx` and the team card image slots. The direction
  already ruled out: AI-style illustration, bare app screenshots, and photographs of
  the actual team.
- **Discoverability.** `llms.txt` exists, but there is still no meta description, no
  Open Graph tags, and no `sitemap.xml`, and the app ships as an unprerendered SPA
  shell — so link previews and search snippets are empty. Deferred, not rejected.

---

## Known gaps

### Web

**Verified in a running browser**, against isolated servers on ports 5099/8099 with an
in-memory Mongo so the live Atlas cluster was never touched: the landing page and its
job cards signed out, the sign-up role chooser, the legal page and its three redirects,
back-navigation out of the legal page, the cookie banner and preference centre, and
Google sign-in in both the configured and unconfigured states. Every route was swept at
320/375/768/1024/1440px for horizontal overflow and checked with `@axe-core/playwright`.
`npm run verify` passes end to end, including 257/257 server tests.

Still open:

- **A real portrait is still published.** `client/public/team/pic-portrait.png` is a
  photograph of an actual team member. Nothing in `client/` or `Mobile/` references it,
  but `vite.config.ts` sets `publicDir` to `client/public`, which Vite copies wholesale
  — so it ships in every production build and is reachable at `/team/pic-portrait.png`
  by anyone who guesses the path. Removing the component reference did not remove the
  file. It is tracked in git, so deleting it is reversible.
- **Google sign-in is untested end to end.** The button and its handlers are wired on
  both sign-in and sign-up and behave correctly in the configured and unconfigured
  states, but the actual token round-trip has never run — it needs `GOOGLE_CLIENT_ID`
  on the server and `VITE_GOOGLE_CLIENT_ID` on the client.
- **No NCR in the address picker.** The sign-up province list has 82 entries and does
  not include Metro Manila, so a Manila-based user cannot enter a true address. This is
  a data gap rather than a UI one, and is not fixed here.
- **Three e2e tests fail** (`worker and employer shells`, `admin user management`,
  `notification menu`). Confirmed pre-existing by running the same suite against an
  untouched `HEAD` in a separate worktree: identical 4 passed / 3 failed. Unrelated to
  the work above.

### Mobile

**Verified in a running app** (Expo web at `localhost:8081`, signed in as a worker):
Jobs home (greeting, filter button, Recent Jobs, new job card), the bottom nav and its
sliding pill, Profile (three stat tiles, no Hire Mode row, no GENERAL menu), the ratings
sheet opening from the AVG. rating tile, and Settings (Hire Mode toggle plus the
Manage Withdrawals row). One bug was found and fixed during this pass: the ratings sheet
showed "Ratings & Reviews" twice, because `ProfileReviews` renders its own heading — the
sheet header now carries only the close button.

Still unverified:

- **Employer screens, Job Details, and the onboarding dots** have not been tapped through.
- **Native rendering.** The above was checked via `react-native-web`, which does not
  exercise real native behaviour — most importantly the tab bar's blur.
- Android blur is weaker than iOS; the glass bar falls back to a flat frosted panel
  where real blurring is unavailable.
- The Jobs filter sheet opens the date CalendarSheet as a nested modal — supported in
  React Native, but worth a tap-through.
