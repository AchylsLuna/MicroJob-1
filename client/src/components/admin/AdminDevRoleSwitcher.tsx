import { ADMIN_STAFF_ROLES, type AdminStaffRole } from "../../lib/adminPermissions";
import { setDevRoleOverride, useDevRoleOverride } from "../../lib/devRoleOverride";

const PREVIEW_ROLES: readonly AdminStaffRole[] = ["superadmin", ...ADMIN_STAFF_ROLES];

const ROLE_LABEL: Record<AdminStaffRole, string> = {
  superadmin: "Superadmin",
  admin_team: "Admin Team",
  moderator: "Moderator",
  finance_team: "Finance Team",
  analytics_team: "Analytics Team",
  support_staff: "Support Staff",
};

/**
 * Lets whoever is testing preview the admin UI as any of the six roles,
 * since the server can't hand out five real staff accounts yet. Renders only
 * in development and only for someone already in the admin area — see
 * `lib/devRoleOverride.ts` for why the guard here is safe to trust.
 */
export function AdminDevRoleSwitcher() {
  if (!import.meta.env.DEV) {
    return null;
  }
  return <AdminDevRoleSwitcherPanel />;
}

function AdminDevRoleSwitcherPanel() {
  const current = useDevRoleOverride();

  return (
    <div className="fixed bottom-4 right-4 z-[90] rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs shadow-lg">
      <label className="block font-semibold text-amber-900" htmlFor="dev-role-switcher">
        Preview as (dev only)
      </label>
      <select
        id="dev-role-switcher"
        value={current ?? ""}
        onChange={(event) => setDevRoleOverride(event.target.value ? (event.target.value as AdminStaffRole) : null)}
        className="mt-1 min-h-9 rounded-lg border border-amber-300 bg-white px-2 text-xs text-amber-950 outline-none focus:ring-2 focus:ring-amber-400"
      >
        <option value="">Actual role</option>
        {PREVIEW_ROLES.map((role) => (
          <option key={role} value={role}>{ROLE_LABEL[role]}</option>
        ))}
      </select>
    </div>
  );
}
