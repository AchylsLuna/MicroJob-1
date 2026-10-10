// Deterministic "person → avatar visual" mapping, used wherever a user has no
// uploaded photo. Same shape and discipline as categoryVisuals.ts: a stable
// hash picks a flat fill, and every hex below is already in the palette that
// file mirrors from Mobile/theme/tokens.ts (no new colors invented here).
//
// Flat fills only -- the standing design rule that keeps the profile cover band
// a solid colour applies here too, so these are never gradients.
//
// Unlike categoryVisuals.ts there is no Mobile counterpart yet; Mobile renders
// its own avatar fallbacks. If one is added later, mirror the palette order and
// the hash below so a given person reads identically on both clients.

export type AvatarVisual = {
  fill: string;
  onFill: string;
};

// Mirrors the PALETTE in categoryVisuals.ts (same order, same hex values) so a
// person and a category tile sitting next to each other draw from one set.
const PALETTE: string[] = [
  "#1C4D8D", // brand
  "#0F2954", // brandDark
  "#0369A1", // info
  "#0F766E", // success
  "#B45309", // warning
  "#5F83B3", // focusRing
];

const FALLBACK: AvatarVisual = {
  fill: PALETTE[0],
  onFill: "#FFFFFF",
};

// djb2 -- identical to categoryVisuals.ts. Only needs to be stable, not
// cryptographic. Kept as a local copy rather than exported from there because
// the two modules are independent and neither should own the other's hash.
function djb2(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Picks a stable fill for one person.
 *
 * Prefer passing a user id: it survives a rename, so someone editing their
 * display name does not change colour. Falling back to the name is fine for
 * records that arrive without an id (deleted accounts, "Verified user"), it
 * just means the colour is tied to the text.
 */
export function getAvatarVisual(key?: string | null): AvatarVisual {
  const normalized = (key || "").trim().toLowerCase();
  if (!normalized) return FALLBACK;

  return {
    fill: PALETTE[djb2(normalized) % PALETTE.length],
    onFill: "#FFFFFF",
  };
}

/**
 * Up to two uppercase letters for an avatar placeholder.
 *
 * Takes the first letter of the first and last whitespace-separated words, so
 * "Maria Santos" reads "MS" and a single-word company name reads one letter
 * rather than two from the same word. Returns "" for empty input; callers
 * should render their own neutral glyph in that case rather than an empty
 * circle, since "" and a real initial are visually very different.
 */
export function getInitials(name?: string | null): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
  return `${first}${last}`.toUpperCase();
}
