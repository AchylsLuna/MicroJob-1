import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MicroJobsLogo } from "../components/MicroJobsLogo";
import { ROUTES } from "../utils/routes";
import { FindJobs } from "./worker/FindJobs";

/**
 * Read-only job search for signed-out visitors, reached from the landing
 * page's hero search. Reuses the worker FindJobs page as-is — it already
 * reads `useAuth()` internally and gates Apply/Save on `user` being present,
 * redirecting to sign-in with the current location as `state.from` — this
 * wrapper only supplies the minimal public chrome that `ProtectedDashboardLayout`
 * would otherwise provide, since this route sits outside it.
 */
export function PublicFindJobs() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh bg-[#F8FAFC]">
      <header className="border-b border-[#E5E7EB] bg-white">
        {/* Wraps rather than overflowing: the full wordmark plus both auth
            buttons need ~312px, which is wider than a 280px device leaves once
            the gutters are taken out, and this row was the one thing forcing a
            horizontal scroll on the whole page there. */}
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-y-3 px-4 py-4 sm:px-6 lg:px-8">
          <MicroJobsLogo onClick={() => navigate(ROUTES.home)} />
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(ROUTES.signIn)}
              className="min-h-11 rounded-xl px-4 text-sm font-semibold text-brand transition hover:bg-brand/[0.06]"
            >
              {t("publicFindJobs.header.signIn")}
            </button>
            <button
              type="button"
              onClick={() => navigate(ROUTES.signUp)}
              className="min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {t("publicFindJobs.header.signUp")}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <FindJobs />
      </main>
    </div>
  );
}
