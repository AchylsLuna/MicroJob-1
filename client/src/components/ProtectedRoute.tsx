import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getDefaultDashboardPath } from "../utils/dashboardRoutes";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const authRaw = localStorage.getItem("auth_user");

  // If no authenticated user, redirect to appropriate signin
  if (!authRaw) {
    if (location.pathname.startsWith("/admin")) {
      return <Navigate to="/admin/signin" replace state={{ from: location }} />;
    }
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  let user: any = null;
  try {
    user = JSON.parse(authRaw);
  } catch {
    if (location.pathname.startsWith("/admin")) {
      return <Navigate to="/admin/signin" replace state={{ from: location }} />;
    }
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  const role: string = user?.role || "work";
  const path = location.pathname;

  const employerPaths = ["/employer", "/dashboard/employer"];
  const workerPaths = ["/worker", "/dashboard/worker", "/find-jobs"];

  const matchesAny = (patterns: string[]) => patterns.some((p) => path.startsWith(p));

  if (matchesAny(employerPaths) && !(role === "hire" || role === "both")) {
    // redirect to default dashboard for this user
    return <Navigate to={getDefaultDashboardPath(user)} replace />;
  }

  if (matchesAny(workerPaths) && !(role === "work" || role === "both")) {
    return <Navigate to={getDefaultDashboardPath(user)} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
