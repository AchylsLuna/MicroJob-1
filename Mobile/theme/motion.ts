export const motion = {
  duration: {
    fast: 180,
    standard: 260,
    exit: 220,
    launch: 420,
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
    small: 8,
    medium: 16,
  },
} as const;
