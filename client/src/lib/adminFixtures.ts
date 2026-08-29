/**
 * Sample data for admin screens that have no backend endpoint yet: Staff
 * Management, Audit Logs, Moderation Queue, and Financial Disputes. (ID
 * Verification Review is not here — it reads real users via `useAdminData`
 * and writes through the real `updateAdminVerification` endpoint.)
 *
 * Every export below maps 1:1 to a future real endpoint, named in its
 * `// TODO(backend)` comment, so swapping fixtures for a real fetch later is
 * mechanical: replace the array with the response, keep the shape. Actions
 * on these screens (create, resolve, disable, ...) only mutate local
 * component state — nothing persists past a page reload.
 */

import type { AdminStaffRole } from "./adminPermissions";

/**
 * This repo's `server/.env` points at a real MongoDB Atlas cluster, and the
 * only endpoint that could create a privileged account (`createUserByAdmin`)
 * accepts `role: 'admin' | 'hire' | 'work'` only — it has no concept of the
 * five staff sub-roles. Calling it to "create a Finance Team member" would
 * actually create a real, fully-privileged `admin` account in production,
 * since the server can't distinguish sub-roles yet. Staff Management is
 * therefore fixture-backed rather than wired to that endpoint.
 */
export interface StaffAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  staffRole: AdminStaffRole;
  status: "active" | "disabled";
  lastActiveAt: string;
}

// TODO(backend): replace with GET /admin/staff
export const STAFF_ACCOUNT_FIXTURES: StaffAccount[] = [
  {
    id: "staff_001",
    firstName: "Maria",
    lastName: "Santos",
    email: "maria.santos@microjobs.ph",
    staffRole: "admin_team",
    status: "active",
    lastActiveAt: "2026-08-29T14:22:10Z",
  },
  {
    id: "staff_002",
    firstName: "Jose",
    lastName: "Reyes",
    email: "jose.reyes@microjobs.ph",
    staffRole: "moderator",
    status: "active",
    lastActiveAt: "2026-08-29T09:05:41Z",
  },
  {
    id: "staff_003",
    firstName: "Angela",
    lastName: "Cruz",
    email: "angela.cruz@microjobs.ph",
    staffRole: "finance_team",
    status: "active",
    lastActiveAt: "2026-08-28T17:40:03Z",
  },
  {
    id: "staff_004",
    firstName: "Paolo",
    lastName: "Garcia",
    email: "paolo.garcia@microjobs.ph",
    staffRole: "analytics_team",
    status: "disabled",
    lastActiveAt: "2026-08-20T11:12:55Z",
  },
  {
    id: "staff_005",
    firstName: "Liza",
    lastName: "Fernandez",
    email: "liza.fernandez@microjobs.ph",
    staffRole: "support_staff",
    status: "active",
    lastActiveAt: "2026-08-29T16:58:22Z",
  },
];

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  category: "system" | "error";
  reason?: string;
  at: string;
}

// TODO(backend): replace with GET /admin/audit-logs
export const AUDIT_LOG_FIXTURES: AuditLogEntry[] = [
  { id: "al_001", actor: "Maria Santos", action: "staff.create", target: "liza.fernandez@microjobs.ph", category: "system", at: "2026-08-29T14:22:10Z" },
  { id: "al_002", actor: "Jose Reyes", action: "user.suspend", target: "usr_8821", category: "system", reason: "Repeated no-shows", at: "2026-08-29T09:05:41Z" },
  { id: "al_003", actor: "System", action: "payout.retry_failed", target: "payout_4471", category: "error", reason: "Bank gateway timeout after 3 attempts", at: "2026-08-28T22:14:03Z" },
  { id: "al_004", actor: "Angela Cruz", action: "payout.approve", target: "payout_4409", category: "system", at: "2026-08-28T17:40:03Z" },
  { id: "al_005", actor: "System", action: "auth.session_error", target: "usr_2290", category: "error", reason: "Token refresh failed — expired refresh token", at: "2026-08-27T08:02:44Z" },
  { id: "al_006", actor: "Maria Santos", action: "staff.role_change", target: "paolo.garcia@microjobs.ph", category: "system", reason: "Moved to Analytics Team", at: "2026-08-20T11:12:55Z" },
];

export interface ModerationReport {
  id: string;
  targetType: "user" | "job";
  targetName: string;
  reportedBy: string;
  reason: string;
  reportedAt: string;
  status: "pending" | "resolved" | "dismissed";
  resolution?: string;
}

// TODO(backend): replace with GET /admin/moderation/reports
export const MODERATION_QUEUE_FIXTURES: ModerationReport[] = [
  { id: "mod_001", targetType: "user", targetName: "Carlo Ibanez", reportedBy: "employer@acme.ph", reason: "Requested payment outside the platform", reportedAt: "2026-08-29T11:05:00Z", status: "pending" },
  { id: "mod_002", targetType: "job", targetName: "\"Easy money, no verification\"", reportedBy: "worker@example.ph", reason: "Looks like a scam listing", reportedAt: "2026-08-28T19:40:00Z", status: "pending" },
  { id: "mod_003", targetType: "user", targetName: "Grace Villanueva", reportedBy: "worker@example2.ph", reason: "Abusive messages in chat", reportedAt: "2026-08-27T15:12:00Z", status: "pending" },
  { id: "mod_004", targetType: "user", targetName: "Ramon Dizon", reportedBy: "employer2@acme.ph", reason: "No-show after accepting a job", reportedAt: "2026-08-20T09:00:00Z", status: "resolved", resolution: "Warned — first offense" },
];

export interface FinancialDispute {
  id: string;
  subject: string;
  raisedBy: string;
  amount: number;
  reason: string;
  status: "open" | "investigating" | "resolved" | "rejected";
  raisedAt: string;
  resolutionNotes?: string;
}

// TODO(backend): replace with GET /admin/finance/disputes
export const FINANCIAL_DISPUTE_FIXTURES: FinancialDispute[] = [
  { id: "disp_001", subject: "Payout #4471 never received", raisedBy: "worker@example.ph", amount: 1250, reason: "Bank transfer shows completed but funds not received after 5 days", status: "open", raisedAt: "2026-08-29T10:00:00Z" },
  { id: "disp_002", subject: "Charged twice for job posting fee", raisedBy: "employer@acme.ph", amount: 300, reason: "Duplicate charge on card ending 4471", status: "investigating", raisedAt: "2026-08-28T14:30:00Z" },
  { id: "disp_003", subject: "Refund not processed", raisedBy: "worker@example2.ph", amount: 800, reason: "Job cancelled by employer, refund promised but not received", status: "resolved", raisedAt: "2026-08-20T08:00:00Z", resolutionNotes: "Refunded manually via e-wallet credit" },
];
