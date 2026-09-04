/**
 * Cookie consent preferences, stored client-side only.
 *
 * Nothing here talks to the server: the choice lives in localStorage and is
 * read by whatever scripts we later gate on it. "Strictly necessary" is not a
 * choice — session and security cookies are required for the app to work at
 * all — so it is reported as always on and cannot be switched off.
 */
export const COOKIE_CONSENT_KEY = "cookie_consent_v1";

export type CookieCategory = "necessary" | "performance" | "functional" | "targeting";

export type CookieConsent = {
  necessary: true;
  performance: boolean;
  functional: boolean;
  targeting: boolean;
  /** ISO timestamp of the decision, so a future policy change can re-ask. */
  decidedAt: string;
};

export const OPTIONAL_CATEGORIES: Exclude<CookieCategory, "necessary">[] = [
  "performance",
  "functional",
  "targeting",
];

export const acceptAllConsent = (): CookieConsent => ({
  necessary: true,
  performance: true,
  functional: true,
  targeting: true,
  decidedAt: new Date().toISOString(),
});

export const rejectAllConsent = (): CookieConsent => ({
  necessary: true,
  performance: false,
  functional: false,
  targeting: false,
  decidedAt: new Date().toISOString(),
});

export function readConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsent>;
    if (typeof parsed?.decidedAt !== "string") return null;
    return {
      necessary: true,
      performance: Boolean(parsed.performance),
      functional: Boolean(parsed.functional),
      targeting: Boolean(parsed.targeting),
      decidedAt: parsed.decidedAt,
    };
  } catch {
    // Corrupt or unreadable (private mode, quota) — treat as "not asked yet"
    // rather than throwing during render.
    return null;
  }
}

export function writeConsent(consent: CookieConsent): void {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
  } catch {
    // Storage unavailable; the banner will simply ask again next visit.
  }
}

/** Lets the footer link reopen the preference centre from anywhere. */
export const OPEN_COOKIE_PREFERENCES_EVENT = "microjobs:open-cookie-preferences";

export function openCookiePreferences(): void {
  window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT));
}
