/**
 * The app's stacking ladder, in one place so a new surface does not have to be
 * guessed at from whatever the neighbouring component happened to pick:
 *
 *   60    navbar (sticky, `webUi.navbar.root`)
 *   90    cookie banner
 *   100   modals: `Dialog`, the nav drawer, the post-a-job modal, the message sheet
 *   110   alerts raised *by* a modal, which have to outrank the modal underneath
 *   9999  the global error layer in `lib/toast.tsx`, which outranks everything
 *
 * Lives outside `ui/index.tsx` because that file may only export components --
 * a non-component export there breaks Fast Refresh for every component in it.
 */
export const ALERT_LAYER_Z = {
  overModal: "z-[110]",
  global: "z-[9999]",
} as const;
