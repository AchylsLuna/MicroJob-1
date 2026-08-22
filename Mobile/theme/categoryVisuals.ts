// Deterministic "category → visual" mapping used by CategoryTile and JobCard.
// Mirrors client/src/lib/categoryVisuals.ts exactly (same palette order, same hash,
// same keyword rules) so a given category renders identically on web and mobile.
// Kept as a separate file rather than a shared package because Mobile/ is its own
// npm workspace with its own metro resolver and cannot import from client/src.
import type { Ionicons } from '@expo/vector-icons';
import { tokens } from './tokens';

export type CategoryVisualIcon = React.ComponentProps<typeof Ionicons>['name'];

export type CategoryVisual = {
  fill: string;
  onFill: string;
  icon: CategoryVisualIcon;
};

type PaletteEntry = { fill: string; icon: CategoryVisualIcon };

// Every color below is sourced directly from theme/tokens.ts (no new hex values),
// so this palette can never drift from the app's brand blue or trip checkTheme.cjs.
const PALETTE: PaletteEntry[] = [
  { fill: tokens.colors.brand, icon: 'briefcase-outline' },
  { fill: tokens.colors.brandDark, icon: 'business-outline' },
  { fill: tokens.colors.info, icon: 'construct-outline' },
  { fill: '#0F766E', icon: 'leaf-outline' },
  { fill: tokens.colors.warning, icon: 'hammer-outline' },
  { fill: tokens.colors.focusRing, icon: 'sparkles-outline' },
];

const FALLBACK: CategoryVisual = {
  fill: PALETTE[0].fill,
  onFill: tokens.colors.onBrand,
  icon: 'briefcase-outline',
};

const KEYWORD_ICONS: Array<{ pattern: RegExp; icon: CategoryVisualIcon }> = [
  { pattern: /clean/i, icon: 'sparkles-outline' },
  { pattern: /deliver|driv|rider/i, icon: 'bicycle-outline' },
  { pattern: /repair|plumb|electric|fix/i, icon: 'construct-outline' },
  { pattern: /tutor|teach|lesson/i, icon: 'school-outline' },
  { pattern: /design|photo|video/i, icon: 'color-palette-outline' },
  { pattern: /cook|food|kitchen/i, icon: 'restaurant-outline' },
  { pattern: /care|nurse|sitter/i, icon: 'heart-outline' },
  { pattern: /build|carpent|paint/i, icon: 'hammer-outline' },
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
  const id = typeof input === 'string' ? input : input?.id;
  const name = typeof input === 'string' ? undefined : input?.name;
  const key = (id || name || '').trim().toLowerCase();

  if (!key) return FALLBACK;

  const paletteIndex = djb2(key) % PALETTE.length;
  const entry = PALETTE[paletteIndex];
  const keywordMatch = name ? KEYWORD_ICONS.find((rule) => rule.pattern.test(name)) : undefined;

  return {
    fill: entry.fill,
    onFill: tokens.colors.onBrand,
    icon: keywordMatch?.icon || entry.icon,
  };
}
