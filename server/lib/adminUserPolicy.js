const PRIVILEGED_ROLES = new Set(["admin", "superadmin"]);

export const isPrivilegedRole = (role) => PRIVILEGED_ROLES.has(String(role || ""));

export function getAdminUserCreationError({ actorRole, newRole }) {
  if (isPrivilegedRole(newRole) && actorRole !== "superadmin") {
    return { status: 403, message: "Only a superadmin can create administrator accounts." };
  }
  return null;
}

export function getAdminUserMutationError({ actorRole, actorId, targetId, targetRole, nextRole, nextStatus, activeSuperadminCount = 0 }) {
  if ((isPrivilegedRole(targetRole) || isPrivilegedRole(nextRole)) && actorRole !== "superadmin") {
    return { status: 403, message: "Only a superadmin can manage privileged accounts." };
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
