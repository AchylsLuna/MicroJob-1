/**
 * The app's stacking ladder, in one place so a new surface does not have to be
 * guessed at from whatever the neighbouring component happened to pick:
 *
 *   50    page furniture that scrolls with or sticks to content: the mobile tab
 *         bar, anchored dropdown menus, the landing page's own header
 *   45    the message dock launcher, deliberately *below* the tab bar
 *   60    navbar (sticky, `webUi.navbar.root`)
 *   90    cookie banner
 *   100   modals: `Dialog`, the nav drawer, the post-a-job modal, the message
 *         sheet, the date picker, and every per-page dialog
 *   110   alerts raised *by* a modal, which have to outrank the modal underneath
 *   9999  the global error layer in `lib/toast.tsx`, which outranks everything
 *
 * The rungs are what make the ladder a contract rather than a convention: a
 * modal that picks `z-50` because its neighbours did is centred *underneath*
 * the navbar and the cookie banner, which is the bug this file exists to stop.
 * `scripts/check-overlay-centering.mjs` fails the build on a fixed-position
 * overlay that spells its own z-index instead of taking a rung from here.
 *
 * Lives outside `ui/index.tsx` because that file may only export components --
 * a non-component export there breaks Fast Refresh for every component in it.
 */
export const LAYER_Z = {
  /** Below the mobile tab bar on purpose -- see `MessageDock`. */
  dockLauncher: "z-[45]",
  /** Mobile tab bar, anchored dropdowns, the landing header. */
  furniture: "z-50",
  /** The sticky dashboard navbar. */
  navbar: "z-[60]",
  /** The cookie banner: over page furniture, under every modal. */
  cookieBanner: "z-[90]",
  /** Every `aria-modal` surface: dialogs, drawers, sheets, the date picker. */
  modal: "z-[100]",
} as const;

export const ALERT_LAYER_Z = {
  overModal: "z-[110]",
  global: "z-[9999]",
} as const;
