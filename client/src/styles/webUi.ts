export const webUi = {
  layout: {
    // `h-screen` and `h-[100dvh]` were both set here; which one won was decided
    // by the generated stylesheet's order rather than this string's, so the
    // mobile-correct one only applied by luck. Keep the dvh unit only.
    shell: "bg-[#F7F8FA] flex h-[100dvh] w-full overflow-hidden",
    content: "h-full min-w-0 flex-1 flex flex-col overflow-y-auto overscroll-contain",
    // The bottom inset is the measured height of the mobile tab bar plus the
    // cookie banner when it is shown, not a guess at them: `pb-28` was a third
    // independent estimate of the tab bar's height alongside two others, and it
    // could not account for the banner at all because that compensated by
    // padding `body`, which never scrolls inside this shell.
    main: "min-w-0 flex-1 px-4 pt-4 pb-[calc(var(--mobile-bottom-nav-height,0px)+var(--cookie-banner-height,0px)+1.5rem)] sm:px-6 lg:px-8 lg:pt-6",
    maxContainer: "mx-auto w-full max-w-[1440px]",
  },
  navbar: {
    // Above the mobile tab bar's z-50: `sticky` + a z-index makes this header a
    // stacking context, so its dropdowns can never out-stack anything painted
    // above the header itself no matter what z-index they carry. Stays below
    // the cookie banner (z-90) and every modal surface (z-100: the nav drawer,
    // ui/index.tsx's Dialog, CalendarPanel, the MessageDock sheet).
    //
    // Not yet true of the hand-rolled modals that still sit at z-50 and so
    // paint *under* this header -- they are being migrated onto Dialog.
    root: "sticky top-0 z-[60] w-full bg-white/95 shadow-[inset_0_-1px_0_#e2e8f0] backdrop-blur",
    container:
      "mx-auto grid h-16 min-h-16 w-full max-w-[1440px] min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6 lg:px-8",
    title: "truncate text-lg font-bold leading-tight tracking-tight text-[#0F2954] sm:text-xl",
    // slate-600, not slate-500: at 12px the lighter tone measures 4.76:1 on the
    // header's own near-white background -- above the 4.5:1 floor, but close
    // enough that it drops under as soon as the header's `bg-white/95` is
    // composited over anything darker, which is exactly what happens while it
    // slides away over a page's coloured hero.
    subtitle: "hidden truncate text-xs text-slate-600 sm:block",
    searchInput:
      "h-full w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-950 outline-none transition focus:border-transparent focus:bg-white focus:ring-2 focus:ring-brand",
    iconButton:
      "relative flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
    popover: "rounded-card border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.16)]",
  },
  sidebar: {
    // `h-full` rather than a hardcoded `100dvh`: both the desktop rail and the
    // mobile drawer already sit in a parent that owns the height, and only the
    // parent knows what fixed chrome it has to leave room for (the mobile
    // drawer has to clear the cookie banner, which otherwise covered the last
    // few nav items).
    root: "dashboard-sidebar flex h-full flex-col overflow-hidden border-r border-slate-200 bg-white text-slate-800 shadow-[8px_0_28px_rgba(15,23,42,0.05)]",
    navButton:
      "relative flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
    navButtonActive: "bg-brand/[0.08] text-brand shadow-sm ring-1 ring-brand/20",
    navButtonIdle: "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
    sectionDivider: "border-slate-200",
  },
} as const;

// `surfaces.panel` / `surfaces.softPanel` were removed: both had zero
// consumers anywhere in client/src, and the two were byte-identical strings,
// so "soft" promised a variant that did not exist.
//
// The original note here also justified the removal by saying an import would
// have pulled in "a third panel radius" at 18px. That premise did not hold --
// `rounded-[18px]` already had five uses, so it was a fourth radius already in
// circulation, not a new one being introduced. The removal was still right,
// for the zero-consumers reason alone.
//
// The radius question itself is now settled in `tailwind.config.js` rather
// than counted in a comment: `rounded-card` (16), `rounded-panel` (14) and
// `rounded-control` (10) are real tokens sourced from `constants/tokens.ts`.
// A census pinned in prose drifts silently the moment anyone adds a component;
// a token does not.
