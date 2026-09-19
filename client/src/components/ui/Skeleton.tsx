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
 */
export function Skeleton({ className = "", style }: Props) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`animate-pulse rounded-md bg-slate-200 motion-reduce:animate-none ${className}`}
    />
  );
}

export default Skeleton;
