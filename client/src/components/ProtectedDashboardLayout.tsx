import { Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { getSignInRouteForPath } from "../utils/authRedirects";
import { DashboardLayout } from "./DashboardLayout";
import { DashboardShellSkeleton } from "./ui/PageSkeletons";
import { Skeleton } from "./ui/Skeleton";

export function ProtectedDashboardLayout() {
  const { t } = useTranslation("common");
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  const getStoredUser = () => {
    try {
      const storedUser = localStorage.getItem("current_user") || localStorage.getItem("auth_user");
      if (!storedUser) return null;
      const parsed = JSON.parse(storedUser);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  };

  const storedUser = getStoredUser();
  const hasAuthenticatedSession = Boolean(user || storedUser);

  // The same frame the route fallback uses (`ui/PageSkeletons.tsx`), so the
  // shell does not change shape between "checking your session" and "loading
  // this page" -- two waits that can happen back to back on a cold load.
  if (isLoading) {
    return (
      <>
        <p role="status" aria-live="polite" className="sr-only">
          {t("loading")}
        </p>
        <DashboardShellSkeleton>
          <Skeleton className="h-8 w-56" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((tile) => (
              <Skeleton key={tile} className="h-28 w-full rounded-card" />
            ))}
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-72 w-full rounded-card lg:col-span-2" />
            <Skeleton className="h-72 w-full rounded-card" />
          </div>
        </DashboardShellSkeleton>
      </>
    );
  }

  // Redirect to role-aware sign-in page if not authenticated, carrying the page
  // they asked for so signing in returns them there instead of a generic dashboard.
  if (!isAuthenticated && !hasAuthenticatedSession) {
    return (
      <Navigate
        to={getSignInRouteForPath(location.pathname)}
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
        replace
      />
    );
  }

  return <DashboardLayout />;
}
