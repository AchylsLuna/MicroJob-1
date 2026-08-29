import { useCallback, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { hasPermission, type AdminPermission, type AdminStaffRole } from "../lib/adminPermissions";
import { useDevRoleOverride } from "../lib/devRoleOverride";

/**
 * Reads the signed-in user's staff role and answers permission questions.
 *
 * Gate UI on `can(...)` rather than comparing role names, so the matrix in
 * `lib/adminPermissions` stays the only place roles are enumerated. Remember
 * this hides controls — it does not secure them; see that module's header.
 *
 * In development, a role picked via the dev role switcher (bottom-right of
 * any admin page) takes priority over the signed-in user's real role, so the
 * gating/nav for all six roles can be previewed without real staff accounts.
 * `useDevRoleOverride` always resolves to `null` in a production build.
 */
export function useAdminPermissions() {
  const { user } = useAuth();
  const devOverride = useDevRoleOverride();
  const role: AdminStaffRole | null = devOverride ?? user?.staffRole ?? null;

  const can = useCallback(
    (permission: AdminPermission) => hasPermission(role, permission),
    [role],
  );

  return useMemo(
    () => ({
      /** The current staff role, or `null` if the user is not staff. */
      role,
      /** True when the current role may perform this action. */
      can,
      /** True when the user is the platform owner. */
      isSuperadmin: role === "superadmin",
    }),
    [role, can],
  );
}
