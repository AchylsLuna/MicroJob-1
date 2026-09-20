import type { CSSProperties } from "react";

type Props = {
  /** Tailwind sizing/shape classes, e.g. "h-4 w-1/2". */
  className?: string;
  style?: CSSProperties;
};

/**
 * A single placeholder block for content whose shape is known before it loads.
 *
 * Prefer this over a spinner wherever the eventual layout is predictable — a
 * list of job cards, a profile header — so the page does not visibly jump when
 * data arrives. Spinners remain fine for genuinely unknown-shape waits.
 *
 * Compose rows from several blocks rather than reaching for a variant prop;
 * each screen's placeholder should match that screen's real layout.
 *
 * The pulse is dropped entirely under reduced motion rather than slowed, and
 * the element is hidden from assistive tech — the surrounding region owns the
 * loading announcement.
 *
 * `slate-100` / `rounded-[10px]` mirror the mobile skeleton's
 * `tokens.colors.contentMuted` (#F1F5F9) and `tokens.radius.sm` (10), so a
 * loading state reads the same on both platforms. This component previously
 * used `slate-200` and `rounded-md`, which made it the odd one out against
 * both mobile and the hand-rolled placeholders in Messages and
 * EmployerDashboard. `className` is appended last, so a call site can still
 * override either.
 */
export function Skeleton({ className = "", style }: Props) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`animate-pulse rounded-[10px] bg-slate-100 motion-reduce:animate-none ${className}`}
    />
  );
}

export default Skeleton;
