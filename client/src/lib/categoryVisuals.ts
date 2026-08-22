// Deterministic "category → visual" mapping used by CategoryTile and JobCard.
// Mirrors Mobile/theme/categoryVisuals.ts exactly (same palette order, same hash,
// same keyword rules) so a given category renders identically on web and mobile.
// Kept as a separate file rather than a shared package because client/src and
// Mobile/ are separate npm workspaces with separate bundlers.
import {
  Briefcase,
  Building2,
  Wrench,
  Leaf,
  Hammer,
  Sparkles,
  Bike,
  GraduationCap,
  Palette,
  UtensilsCrossed,
  Heart,
  type LucideIcon,
} from "lucide-react";

export type CategoryVisual = {
  fill: string;
  onFill: string;
  icon: LucideIcon;
};

type PaletteEntry = { fill: string; icon: LucideIcon };

// Every color below mirrors Mobile/theme/tokens.ts exactly (no new hex values
// invented here), so the surface still reads as MicroJob blue overall.
const PALETTE: PaletteEntry[] = [
  { fill: "#1C4D8D", icon: Briefcase }, // brand
  { fill: "#0F2954", icon: Building2 }, // brandDark
  { fill: "#0369A1", icon: Wrench }, // info
  { fill: "#0F766E", icon: Leaf }, // success
  { fill: "#B45309", icon: Hammer }, // warning
  { fill: "#5F83B3", icon: Sparkles }, // focusRing
];

const FALLBACK: CategoryVisual = {
  fill: PALETTE[0].fill,
  onFill: "#FFFFFF",
  icon: Briefcase,
};

const KEYWORD_ICONS: Array<{ pattern: RegExp; icon: LucideIcon }> = [
  { pattern: /clean/i, icon: Sparkles },
  { pattern: /deliver|driv|rider/i, icon: Bike },
  { pattern: /repair|plumb|electric|fix/i, icon: Wrench },
  { pattern: /tutor|teach|lesson/i, icon: GraduationCap },
  { pattern: /design|photo|video/i, icon: Palette },
  { pattern: /cook|food|kitchen/i, icon: UtensilsCrossed },
  { pattern: /care|nurse|sitter/i, icon: Heart },
  { pattern: /build|carpent|paint/i, icon: Hammer },
];

// djb2 — tiny, dependency-free string hash. Only needs to be stable, not cryptographic.
function djb2(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

export function getCategoryVisual(input?: { id?: string; name?: string } | string | null): CategoryVisual {
  const id = typeof input === "string" ? input : input?.id;
  const name = typeof input === "string" ? undefined : input?.name;
  const key = (id || name || "").trim().toLowerCase();

  if (!key) return FALLBACK;

  const paletteIndex = djb2(key) % PALETTE.length;
  const entry = PALETTE[paletteIndex];
  const keywordMatch = name ? KEYWORD_ICONS.find((rule) => rule.pattern.test(name)) : undefined;

  return {
    fill: entry.fill,
    onFill: "#FFFFFF",
    icon: keywordMatch?.icon || entry.icon,
  };
}
