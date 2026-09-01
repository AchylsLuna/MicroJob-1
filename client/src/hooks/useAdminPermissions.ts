import { useCallback, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { hasPermission, type AdminPermission, type AdminStaffRole } from "../lib/adminPermissions";

/**
 * Reads the signed-in user's staff role and answers permission questions.
 *
 * Gate UI on `can(...)` rather than comparing role names, so the matrix in
 * `lib/adminPermissions` stays the only place roles are enumerated. Remember
 * this hides controls — it does not secure them; the real boundary is
 * `server/lib/adminPermissions.js` and `requirePermission` on each route.
 *
 * Always the signed-in user's real role — there is no dev preview override.
 * Test a staff role by signing in as a real account with that staffRole.
 */
export function useAdminPermissions() {
  const { user } = useAuth();
  const role: AdminStaffRole | null = user?.staffRole ?? null;

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
