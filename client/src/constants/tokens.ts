/**
 * Web design tokens — the counterpart to `Mobile/theme/tokens.ts`.
 *
 * Scope is deliberately narrow. This file holds only the values Tailwind cannot
 * express as a utility class: raw numbers needed by inline styles and motion
 * offsets, plus the semantic state colours that today get retyped as ad-hoc hex
 * in JSX.
 *
 * It intentionally does NOT define the brand blue. `client/tailwind.config.js`
 * owns that, and its flat 500–950 scale is deliberate: the brand has no tint or
 * shade steps, so hover and pressed states must come from opacity, ring or
 * brightness — never a darker blue, which renders identically.
 *
 * The numeric scales below are mirrored from the mobile token file and are
 * checked for drift by `scripts/check-token-drift.mjs` (wired into `verify`).
 * Change them in both places or CI will fail.
 */
export const tokens = {
  radius: {
    sm: 10,
    md: 14,
    // The dominant panel radius on web -- roughly 160 call sites at 16px
    // against 53 at 14px. It was missing from this scale even though it is
    // what most cards on screen already use, so every one of those call sites
    // had to spell it as an arbitrary value. The 14px sites have since been
    // folded into it, leaving web with a three-step scale of 10 / 12 / 16.
    //
    // Counts are given in prose, not as literal utility strings. A previous
    // version of this comment spelled the class names out and a later codemod
    // rewrote them inside the comment, turning the explanation into nonsense.
    //
    // Keep comments in these groups free of colons. `check-token-drift.mjs`
    // scrapes each group body with a name-then-colon-then-value regex that
    // does not skip comments, so a colon in prose here registers as a phantom
    // token and fails CI. (This comment previously tripped that itself.)
    card: 16,
    lg: 18,
    pill: 999,
  },
  spacing: {
    xxs: 4,
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
  typography: {
    h1: 26,
    h2: 22,
    h3: 18,
    body: 14,
    // The single most-used text size in the web client (312 uses) and the only
    // one with no Tailwind equivalent -- it sits between `text-xs` (12) and
    // `text-sm` (14), so every one of those call sites spelled it as
    // `text-[13px]`.
    bodySm: 13,
    caption: 12,
    label: 14,
    control: 15,
  },
  controls: {
    minimumTouch: 44,
    fieldHeight: 52,
    buttonHeight: 52,
    compactHeight: 44,
  },
  /** Semantic state colours. Brand colours live in tailwind.config.js. */
  colors: {
    success: "#10B981",
    danger: "#EF4444",
    warning: "#F59E0B",
    info: "#0369A1",
    successSoft: "#ECFDF5",
    dangerSoft: "#FEF2F2",
    warningSoft: "#FEF3C7",
    infoSoft: "#E0F2FE",
  },
  opacity: {
    disabled: 0.5,
  },
} as const;

export default tokens;
