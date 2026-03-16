import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ROUTES } from "../utils/routes";
import { isEmployer } from "../utils/dashboardRoutes";
import { WorkerSupport } from "./worker";

// Router component that picks the support page based on role
export default function SupportRouter() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to={ROUTES.signIn} replace />;
  }

  const normalizedRole = String(user.role || "").toLowerCase();
  if (normalizedRole === "admin" || normalizedRole === "superadmin") {
    return <Navigate to={ROUTES.admin.support} replace />;
  }

  // Route generic support entry to the active account workspace.
  if (location.pathname === ROUTES.support) {
    if (isEmployer(user) || (normalizedRole === "both" && user.accountType === "employer")) {
      return <Navigate to={ROUTES.employer.support} replace />;
    }
    return <Navigate to={ROUTES.worker.support} replace />;
  }

  return <WorkerSupport />;
}
