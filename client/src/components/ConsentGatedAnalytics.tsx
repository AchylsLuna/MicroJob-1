import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import {
  COOKIE_CONSENT_CHANGED_EVENT,
  readConsent,
  type CookieConsent,
} from "../lib/cookieConsent";

/**
 * Vercel Analytics, mounted only once the visitor has allowed performance
 * cookies.
 *
 * It used to render unconditionally in main.tsx, which meant the preference
 * centre offered a "Performance cookies" toggle that changed nothing — the
 * tracker loaded for everyone, including people who pressed "Reject all".
 *
 * Unmounting stops further events. Anything the script already sent before a
 * visitor rejected cannot be recalled, which is why the default is off until
 * they actively opt in.
 */
export function ConsentGatedAnalytics() {
  const [consent, setConsent] = useState<CookieConsent | null>(() => readConsent());

  useEffect(() => {
    const sync = () => setConsent(readConsent());
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, sync);
    // Another tab deciding should apply here too.
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!consent?.performance) return null;
  return <Analytics />;
}
