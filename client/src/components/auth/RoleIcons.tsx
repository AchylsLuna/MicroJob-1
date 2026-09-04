/**
 * Role pictograms for the sign-up chooser.
 *
 * lucide-react has no combined person-plus-object glyph, so these are drawn
 * here as generic line-art pictograms. The stroke is deliberately heavier than
 * lucide's default: these render at ~44px, and a 2px stroke in a 48-unit
 * viewBox scales down to a hairline that turns to mush at that size.
 *
 * Decorative — the card's own title and description carry the meaning.
 */
type IconProps = { className?: string };

const common = {
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: "false" as const,
};

/** A person alongside a briefcase — someone who hires. */
export function EmployerIcon({ className }: IconProps) {
  return (
    <svg className={className} {...common}>
      <circle cx="16" cy="13" r="7" />
      <path d="M4 36c0-6.6 5.4-12 12-12 1.7 0 3.4.4 4.9 1" />
      <rect x="24" y="26" width="20" height="14" rx="3" />
      <path d="M31 26v-2.5a2.5 2.5 0 0 1 2.5-2.5h1a2.5 2.5 0 0 1 2.5 2.5V26" />
    </svg>
  );
}

/**
 * A person alongside an open laptop — someone who works. Mirrors the Employer
 * icon's person-left / object-right structure so the pair reads as a set.
 */
export function WorkerIcon({ className }: IconProps) {
  return (
    <svg className={className} {...common}>
      <circle cx="15" cy="13" r="7" />
      <path d="M4 36c0-6.1 4.9-11 11-11 1.6 0 3.2.3 4.6.9" />
      <rect x="26" y="23" width="16" height="12" rx="2" />
      <path d="M23 40h22" />
    </svg>
  );
}
