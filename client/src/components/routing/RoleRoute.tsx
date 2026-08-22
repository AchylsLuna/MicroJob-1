import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  getDefaultDashboardPath,
  isAdmin,
  isEmployer,
  isPatient,
} from "../../utils/dashboardRoutes";
import { getSignInRouteForPath } from "../../utils/authRedirects";

export type RouteRole = "patient" | "employer" | "admin";

export function RoleRoute({ requiredRole }: { requiredRole: RouteRole }) {
  const { user: contextUser, isLoading } = useAuth();
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
  // Let auth context finish initial sync before redirecting to sign-in.
  if (isLoading && !contextUser && !storedUser) {
    return null;
  }

  // Storage fallback protects against short-lived state sync races after OTP/login.
  const user = contextUser || storedUser;

  if (!user) {
    return (
      <Navigate
        to={getSignInRouteForPath(location.pathname)}
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
        replace
      />
    );
  }

  const hasAccess =
    requiredRole === "admin"
      ? isAdmin(user)
      : requiredRole === "employer"
      ? isEmployer(user)
      : isPatient(user);

  if (!hasAccess) {
    return <Navigate to={getDefaultDashboardPath(user)} replace />;
  }

  return <Outlet />;
}
