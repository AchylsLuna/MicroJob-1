import { ReactNode, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "../../../lib/toast";
import { useAuth } from "../../../contexts/AuthContext";
import { useAdminPermissions } from "../../../hooks/useAdminPermissions";
import { getDefaultDashboardPath } from "../../../utils/dashboardRoutes";
import { ROUTES } from "../../../utils/routes";
import type { AdminPermission } from "../../../lib/adminPermissions";

const DEFAULT_ALLOWED_ROLES = ["admin", "superadmin"] as const;

type AllowedRole = "admin" | "superadmin";

/**
 * Wraps an admin page and bounces anyone who may not see it.
 *
 * Prefer `permission` — it gates on the RBAC matrix in `lib/adminPermissions`
 * and is what every page should use. `allowedRoles` is the older coarse check
 * kept only so an ungated page still behaves; note it compares against
 * `user.role`, which `normalizeRole` has already flattened to "admin", so it
 * cannot distinguish staff sub-roles.
 */
export function AdminGate({
  children,
  permission,
  allowedRoles = DEFAULT_ALLOWED_ROLES,
  fallbackPath,
}: {
  children: ReactNode;
  permission?: AdminPermission;
  allowedRoles?: readonly AllowedRole[];
  fallbackPath?: string;
}) {
  const { t } = useTranslation("admin");
  const { user } = useAuth();
  const { can } = useAdminPermissions();
  const role = (user?.role ?? "") as AllowedRole | "";
  const hasAccess = Boolean(user) && (permission ? can(permission) : allowedRoles.includes(role as AllowedRole));
  const redirectPath = fallbackPath || (user ? getDefaultDashboardPath(user) : ROUTES.adminSignIn);

  useEffect(() => {
    if (user && !hasAccess) {
      toast.error(t("gate.toast.accessDenied"));
    }
  }, [user, hasAccess, t]);

  if (!user) {
    return <Navigate to={ROUTES.adminSignIn} replace />;
  }

  if (!hasAccess) {
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}
