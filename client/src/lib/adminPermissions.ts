/**
 * Admin RBAC — the single source of truth for which staff role can do what.
 *
 * IMPORTANT: this is **UI enforcement only**. It hides links, pages, and
 * controls so each staff role sees a coherent app — it is *not* a security
 * boundary. The server currently has no concept of these roles and does not
 * check them, so anyone who can reach the API can still call it directly.
 * Treat this as presentation until the same matrix is enforced server-side.
 *
 * Nothing outside this module should hardcode a staff role name. Gate on a
 * permission via `useAdminPermissions().can(...)` instead, so adding a role
 * means editing one table here rather than hunting through pages.
 */

/**
 * `superadmin` is the platform owner and sits above the five staff roles —
 * it is the only role that can create or demote an Admin Team member.
 */
export type AdminStaffRole =
  | "superadmin"
  | "admin_team"
  | "moderator"
  | "finance_team"
  | "analytics_team"
  | "support_staff";

export type AdminPermission =
  // Staff accounts
  | "staff.view"
  | "staff.create"
  | "staff.assignRole"
  | "staff.toggleStatus"
  // System activity
  | "audit.view"
  // Marketplace users
  | "users.view"
  | "users.suspend"
  | "users.ban"
  | "users.resetPassword"
  | "users.unlock"
  // Moderation
  | "verification.review"
  | "moderation.review"
  | "moderation.enforce"
  | "jobs.view"
  // Finance
  | "finance.transactions.view"
  | "finance.reconciliation.view"
  | "finance.flag"
  | "finance.payouts.review"
  | "finance.disputes.handle"
  | "finance.logs.view"
  // Analytics
  | "analytics.view"
  | "analytics.export"
  // Support
  | "support.tickets.handle"
  | "support.escalate";

/**
 * Role → permission matrix.
 *
 * `superadmin` is intentionally absent from the explicit lists — `hasPermission`
 * short-circuits it to true, so a new permission never has to be added in two
 * places to keep the owner working.
 */
export const ROLE_PERMISSIONS: Record<AdminStaffRole, readonly AdminPermission[]> = {
  superadmin: [],

  admin_team: [
    "staff.view",
    "staff.create",
    "staff.assignRole",
    "staff.toggleStatus",
    "audit.view",
    "users.view",
    "users.suspend",
    "jobs.view",
    "analytics.view",
    "analytics.export",
    "support.tickets.handle",
  ],

  moderator: [
    "users.view",
    "users.suspend",
    "users.ban",
    "verification.review",
    "moderation.review",
    "moderation.enforce",
    "jobs.view",
  ],

  finance_team: [
    "finance.transactions.view",
    "finance.reconciliation.view",
    "finance.flag",
    "finance.payouts.review",
    "finance.disputes.handle",
    "finance.logs.view",
    "analytics.view",
    "analytics.export",
  ],

  // Deliberately analytics-only: the spec is "no write access to user data,
  // jobs, or transactions." No `users.view`, so User Management never appears
  // in this role's navigation at all.
  analytics_team: ["analytics.view", "analytics.export"],

  // Deliberately read-only on people and jobs: `users.view` and `jobs.view`
  // without `users.suspend`. This role's write surface is tickets, password
  // resets, and unlocks — anything heavier gets escalated.
  support_staff: [
    "users.view",
    "users.resetPassword",
    "users.unlock",
    "jobs.view",
    "support.tickets.handle",
    "support.escalate",
  ],
};

/** Assignable in the Staff Management role picker — `superadmin` is never offered. */
export const ADMIN_STAFF_ROLES: readonly AdminStaffRole[] = [
  "admin_team",
  "moderator",
  "finance_team",
  "analytics_team",
  "support_staff",
];

/**
 * Flat tint pills, matching the `statusStyle` convention in
 * AdminPayoutRequests. Solid fills only — no gradients.
 */
export const ROLE_BADGE_STYLE: Record<AdminStaffRole, string> = {
  superadmin: "bg-violet-100 text-violet-800",
  admin_team: "bg-blue-100 text-blue-800",
  moderator: "bg-amber-100 text-amber-800",
  finance_team: "bg-emerald-100 text-emerald-800",
  analytics_team: "bg-sky-100 text-sky-800",
  support_staff: "bg-slate-200 text-slate-700",
};

/**
 * Tolerant of however the server spells a role — `"Finance Team"`,
 * `"finance-team"`, and `"financeTeam"` all resolve to `finance_team`.
 * Mirrors the defensive style of `normalizeRole` in AuthContext.
 *
 * Returns `null` for a non-staff value (a worker, an employer, or garbage),
 * which `hasPermission` then treats as having no permissions at all.
 */
export function normalizeStaffRole(raw?: string | null): AdminStaffRole | null {
  const value = String(raw || "")
    .trim()
    // camelCase → snake_case first, while the capitals still exist, so
    // "financeTeam" collapses with "finance team" and "finance-team".
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  switch (value) {
    case "superadmin":
    case "super_admin":
      return "superadmin";
    case "admin":
    case "admin_team":
      return "admin_team";
    case "moderator":
    case "moderation":
      return "moderator";
    case "finance":
    case "finance_team":
      return "finance_team";
    case "analytics":
    case "analytics_team":
      return "analytics_team";
    case "support":
    case "support_staff":
      return "support_staff";
    default:
      return null;
  }
}

/** True when the role may perform the action. `superadmin` may always. */
export function hasPermission(
  role: AdminStaffRole | null | undefined,
  permission: AdminPermission,
): boolean {
  if (!role) {
    return false;
  }
  if (role === "superadmin") {
    return true;
  }
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** True for any role that belongs in the admin area at all. */
export function isStaffRole(raw?: string | null): boolean {
  return normalizeStaffRole(raw) !== null;
}
