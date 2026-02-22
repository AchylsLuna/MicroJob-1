import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ROUTES } from "../utils/routes";
import { WorkerSupport } from "./worker";

// Router component that picks the support page based on role
export default function SupportRouter() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to={ROUTES.signIn} replace />;
  }

  if (user.role === "admin" || user.role === "superadmin") {
    return <Navigate to={ROUTES.admin.dashboard} replace />;
  }

  return <WorkerSupport />;
}
