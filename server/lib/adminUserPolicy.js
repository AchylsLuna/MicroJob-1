import { hasPermission } from "./adminPermissions.js";

const PRIVILEGED_ROLES = new Set(["admin", "superadmin"]);

export const isPrivilegedRole = (role) => PRIVILEGED_ROLES.has(String(role || ""));

/**
 * `admin_team` holds `staff.create`/`staff.assignRole`/`staff.toggleStatus` in
 * the permission matrix (server/lib/adminPermissions.js), so it may create or
 * manage the *other* four staff sub-roles without a superadmin. It may never
 * create or manage another `admin_team` member or a superadmin — per
 * client/src/lib/adminPermissions.ts, superadmin is "the only role that can
 * create or demote an Admin Team member."
 */
const actorEffectiveStaffRole = (actorRole, actorStaffRole) => (actorRole === "admin" ? actorStaffRole : null);
const isAdminTeamOrSuperadmin = (role, staffRole) => role === "superadmin" || staffRole === "admin_team";

export function getAdminUserCreationError({ actorRole, actorStaffRole, newRole, newStaffRole }) {
  if (!isPrivilegedRole(newRole)) return null;
  if (actorRole === "superadmin") return null;

  const canDelegateCreate = hasPermission(actorEffectiveStaffRole(actorRole, actorStaffRole), "staff.create");
  const creatingDelegableSubRole = newRole === "admin" && newStaffRole && newStaffRole !== "admin_team";
  if (canDelegateCreate && creatingDelegableSubRole) return null;

  return { status: 403, message: "Only a superadmin can create administrator accounts." };
}

export function getAdminUserMutationError({
  actorRole,
  actorStaffRole,
  actorId,
  targetId,
  targetRole,
  targetStaffRole,
  nextRole,
  nextStaffRole,
  nextStatus,
  activeSuperadminCount = 0,
}) {
  const touchesPrivileged = isPrivilegedRole(targetRole) || isPrivilegedRole(nextRole);
  if (touchesPrivileged && actorRole !== "superadmin") {
    const canDelegateManage =
      hasPermission(actorEffectiveStaffRole(actorRole, actorStaffRole), "staff.assignRole") ||
      hasPermission(actorEffectiveStaffRole(actorRole, actorStaffRole), "staff.toggleStatus");
    const touchesAdminTeamOrSuperadmin =
      isAdminTeamOrSuperadmin(targetRole, targetStaffRole) || isAdminTeamOrSuperadmin(nextRole, nextStaffRole);
    if (!canDelegateManage || touchesAdminTeamOrSuperadmin) {
      return { status: 403, message: "Only a superadmin can manage privileged accounts." };
    }
  }
  if (actorId && actorId === targetId && nextRole !== targetRole) {
    return { status: 403, message: "You cannot change your own role." };
  }
  if (actorId && actorId === targetId && nextStatus !== "active") {
    return { status: 403, message: "You cannot disable your own account." };
  }
  if (targetRole === "superadmin" && (nextRole !== "superadmin" || nextStatus !== "active") && activeSuperadminCount <= 1) {
    return { status: 409, message: "The last active superadmin cannot be demoted or disabled." };
  }
  return null;
}
