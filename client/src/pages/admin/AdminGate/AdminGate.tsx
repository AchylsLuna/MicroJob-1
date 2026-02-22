import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "../../../lib/toast";
import { useAuth } from "../../../contexts/AuthContext";
import { getDefaultDashboardPath } from "../../../utils/dashboardRoutes";

const DEFAULT_ALLOWED_ROLES = ["superadmin"] as const;

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
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const role = user.role as AllowedRole;
    if (!allowedRoles.includes(role)) {
      toast.error("You don't have access to this admin section.");
      if (fallbackPath) {
        setRedirectPath(fallbackPath);
      } else if (role === "admin" || role === "superadmin") {
        setRedirectPath("/admin");
      } else {
        setRedirectPath(getDefaultDashboardPath(user));
      }
    }
  }, [user, allowedRoles, fallbackPath]);

  if (!user) {
    return <Navigate to="/admin/signin" replace />;
  }

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}