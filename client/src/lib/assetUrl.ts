/**
 * Resolves a stored-upload path (e.g. `/uploads/avatar_123.jpg`) to an
 * absolute URL the browser can actually fetch. Was duplicated verbatim in
 * `PublicProfile.tsx`, `worker/Profile.tsx`, `Settings.tsx`,
 * `LandingPageBlue.tsx`, and `ApplicationsManagement.tsx` — extracted here
 * since the profile redesign touches most of those files anyway.
 */
export function toAbsoluteAssetUrl(value?: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) {
    const apiBase = import.meta.env.VITE_API_BASE || "/api";
    const origin = apiBase.startsWith("http")
      ? apiBase.replace(/\/api\/?$/, "")
      : window.location.origin;
    return `${origin}${value}`;
  }
  return value;
}
