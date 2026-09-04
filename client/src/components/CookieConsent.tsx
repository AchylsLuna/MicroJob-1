import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog } from "./ui";
import { ROUTES } from "../utils/routes";
import {
  OPEN_COOKIE_PREFERENCES_EVENT,
  OPTIONAL_CATEGORIES,
  acceptAllConsent,
  readConsent,
  rejectAllConsent,
  writeConsent,
  type CookieConsent as Consent,
} from "../lib/cookieConsent";

const CATEGORY_COPY: Record<string, { title: string; description: string }> = {
  necessary: {
    title: "Strictly necessary cookies",
    description:
      "Required for sign-in, session security, and core features. These cannot be switched off.",
  },
  performance: {
    title: "Performance cookies",
    description:
      "Help us understand which pages are slow or failing so we can fix them. Never used to identify you.",
  },
  functional: {
    title: "Functional cookies",
    description:
      "Remember preferences such as your language and saved filters so you don't set them every visit.",
  },
  targeting: {
    title: "Targeting cookies",
    description:
      "Used to measure whether our ads reach people looking for local work. Off unless you allow them.",
  },
};

/**
 * Cookie banner plus preference centre.
 *
 * Entirely client-side — the decision is kept in localStorage (see
 * lib/cookieConsent.ts) and nothing is sent to the server. Mounted once in
 * App.tsx so it covers every route.
 */
export function CookieConsent() {
  const [consent, setConsent] = useState<Consent | null>(() => readConsent());
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [draft, setDraft] = useState({ performance: true, functional: true, targeting: true });

  // The footer's "Your privacy choices" link reopens this from anywhere.
  useEffect(() => {
    const openPrefs = () => {
      const current = readConsent();
      setDraft({
        performance: current?.performance ?? true,
        functional: current?.functional ?? true,
        targeting: current?.targeting ?? true,
      });
      setPrefsOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, openPrefs);
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, openPrefs);
  }, []);

  const persist = useCallback((next: Consent) => {
    writeConsent(next);
    setConsent(next);
    setPrefsOpen(false);
  }, []);

  const confirmChoices = () =>
    persist({ necessary: true, ...draft, decidedAt: new Date().toISOString() });

  const bannerVisible = consent === null && !prefsOpen;
  const bannerRef = useRef<HTMLDivElement>(null);

  // The bar is fixed, so without reserving the space it sits on top of whatever
  // is at the bottom of the page — on a narrow screen it covered the sign-up and
  // password-reset submit buttons outright. Pad the body by its measured height
  // for as long as it is shown.
  useEffect(() => {
    const banner = bannerRef.current;
    if (!bannerVisible || !banner) return;
    const apply = () => {
      document.body.style.paddingBottom = `${banner.offsetHeight}px`;
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(banner);
    return () => {
      observer.disconnect();
      document.body.style.paddingBottom = "";
    };
  }, [bannerVisible]);

  return (
    <>
      {bannerVisible ? (
        <div
          ref={bannerRef}
          role="region"
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-0 z-[90] border-t border-slate-200 bg-white p-4 shadow-[0_-8px_24px_rgba(15,41,84,0.10)] sm:p-5"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-[14px] leading-6 text-slate-700">
              We use cookies to keep you signed in, remember your preferences, and understand how
              Micro Jobs is used.{" "}
              <Link
                to={ROUTES.legalDoc("cookies")}
                className="font-semibold text-[#1C4D8D] hover:opacity-80"
              >
                Read our Cookie Policy
              </Link>
              .
            </p>
            <div className="flex flex-wrap gap-2 lg:shrink-0">
              <button
                type="button"
                onClick={() => setPrefsOpen(true)}
                className="min-h-11 rounded-[10px] border border-slate-300 bg-white px-4 text-[14px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]"
              >
                Manage preferences
              </button>
              <button
                type="button"
                onClick={() => persist(rejectAllConsent())}
                className="min-h-11 rounded-[10px] border border-slate-300 bg-white px-4 text-[14px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]"
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={() => persist(acceptAllConsent())}
                className="brand-primary-interactive min-h-11 rounded-[10px] px-5 text-[14px] font-semibold"
              >
                Accept all
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        title="Privacy preference centre"
        description="Choose which cookies Micro Jobs may use. You can change this at any time from the footer."
      >
        <div className="space-y-3">
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-[15px] font-bold text-slate-900">
                {CATEGORY_COPY.necessary.title}
              </h3>
              <span className="shrink-0 text-[13px] font-semibold text-[#1C4D8D]">Always active</span>
            </div>
            <p className="mt-1.5 text-[13px] leading-6 text-slate-600">
              {CATEGORY_COPY.necessary.description}
            </p>
          </div>

          {OPTIONAL_CATEGORIES.map((category) => {
            const checked = draft[category];
            return (
              <div key={category} className="rounded-[12px] border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-[15px] font-bold text-slate-900">
                    {CATEGORY_COPY[category].title}
                  </h3>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    aria-label={CATEGORY_COPY[category].title}
                    onClick={() => setDraft((current) => ({ ...current, [category]: !checked }))}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2 ${
                      checked ? "bg-[#1C4D8D]" : "bg-slate-300"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-[left] ${
                        checked ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
                <p className="mt-1.5 text-[13px] leading-6 text-slate-600">
                  {CATEGORY_COPY[category].description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => persist(rejectAllConsent())}
            className="min-h-11 rounded-[10px] border border-slate-300 bg-white px-4 text-[14px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]"
          >
            Reject all
          </button>
          <button
            type="button"
            onClick={confirmChoices}
            className="brand-primary-interactive min-h-11 rounded-[10px] px-5 text-[14px] font-semibold"
          >
            Confirm my choices
          </button>
        </div>
      </Dialog>
    </>
  );
}
