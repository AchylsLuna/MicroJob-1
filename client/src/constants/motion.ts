/**
 * Web motion tokens — the counterpart to `Mobile/theme/motion.ts`.
 *
 * Durations are stored in milliseconds so both platforms cite one set of
 * numbers (and so `scripts/check-token-drift.mjs` can compare them directly).
 * The `motion` library takes seconds, so use `seconds()` at call sites:
 *
 *     transition={{ duration: seconds(motion.duration.fast) }}
 *
 * House rules these encode: 120–200ms for micro-interactions, 200–300ms for
 * larger moves, and only `transform`/`opacity` ever animated. Reduced motion is
 * handled by skipping animation entirely, never by shortening it — see
 * `useReducedMotion` from `motion/react`.
 */
export const motion = {
  duration: {
    instant: 120,
    enter: 240,
    fast: 180,
    standard: 260,
    exit: 220,
    launch: 420,
    modal: 220,
    toast: 240,
  },
  press: {
    scale: 0.97,
    opacity: 0.86,
  },
  spring: {
    damping: 18,
    stiffness: 220,
    mass: 0.8,
  },
  distance: {
    micro: 6,
    small: 8,
    medium: 16,
  },
} as const;

/**
 * Alias for call sites that already bind `motion` to the animation library:
 *
 *     import { motion, useReducedMotion } from "motion/react";
 *     import { motionTokens, seconds } from "../../constants/motion";
 */
export const motionTokens = motion;

/** Converts a token duration in milliseconds to the seconds `motion` expects. */
export const seconds = (ms: number) => ms / 1000;

export default motion;
