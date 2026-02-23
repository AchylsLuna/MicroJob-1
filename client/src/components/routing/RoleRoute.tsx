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
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to={getSignInRouteForPath(location.pathname)} replace />;
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
