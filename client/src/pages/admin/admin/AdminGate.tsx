import { ReactNode, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "../../../lib/toast";
import { useAuth } from "../../../contexts/AuthContext";
import { getDefaultDashboardPath } from "../../../utils/dashboardRoutes";
import { ROUTES } from "../../../utils/routes";

const DEFAULT_ALLOWED_ROLES = ["admin", "superadmin"] as const;

type AllowedRole = "admin" | "superadmin";

export function AdminGate({
  children,
  allowedRoles = DEFAULT_ALLOWED_ROLES,
  fallbackPath,
}: {
  children: ReactNode;
  allowedRoles?: readonly AllowedRole[];
  fallbackPath?: string;
}) {
  const { user } = useAuth();
  const role = (user?.role ?? "") as AllowedRole | "";
  const hasAccess = Boolean(user) && allowedRoles.includes(role as AllowedRole);
  const redirectPath = fallbackPath || (user ? getDefaultDashboardPath(user) : ROUTES.adminSignIn);

  useEffect(() => {
    if (user && !hasAccess) {
      toast.error("You don't have access to this admin section.");
    }
  }, [user, hasAccess]);

  if (!user) {
    return <Navigate to={ROUTES.adminSignIn} replace />;
  }

  if (!hasAccess) {
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}
