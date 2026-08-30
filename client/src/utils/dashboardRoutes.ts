import { ROUTES } from "./routes";
import { isStaffRole } from "../lib/adminPermissions";

export interface DashboardRouteUser {
  role?: string | null;
  staffRole?: string | null;
  user_type?: string | null;
  accountType?: string | null;
}

export const PATIENT_DASHBOARD_PATH = ROUTES.worker.dashboard;
export const WORKER_DASHBOARD_PATH = PATIENT_DASHBOARD_PATH;
/** Where a worker enters the app — see `getPostAuthLandingPath`. */
export const WORKER_LANDING_PATH = ROUTES.worker.findJobs;
export const EMPLOYER_DASHBOARD_PATH = ROUTES.employer.dashboard;
export const DOCTOR_DASHBOARD_PATH = EMPLOYER_DASHBOARD_PATH;
export const ADMIN_DASHBOARD_PATH = ROUTES.admin.dashboard;

const getRole = (user?: DashboardRouteUser | null) =>
  (user?.role || user?.user_type || "").toLowerCase();
const getAccountType = (user?: DashboardRouteUser | null) =>
  (user?.accountType || "").toLowerCase();
const getStaffRole = (user?: DashboardRouteUser | null) =>
  String(user?.staffRole || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

export function isAdmin(user?: DashboardRouteUser | null) {
  const role = getRole(user);
  // Accepts the five staff sub-roles too. This is called with both normalized
  // users (role already "admin") and raw API/localStorage shapes (role still
  // "moderator"), so it must agree with `normalizeRole` in AuthContext or a
  // staff member gets classified as a worker by `isPatient`'s fallback below.
  return role === "admin" || role === "superadmin" || isStaffRole(role);
}

export function isEmployer(user?: DashboardRouteUser | null) {
  const role = getRole(user);
  const accountType = getAccountType(user);
  
  // For users with "both" role, check their current accountType
  if (role === "both") {
    return accountType === "employer";
  }
  
  return (
    accountType === "doctor" ||
    accountType === "employer" ||
    role === "doctor" ||
    role === "employer" ||
    role === "hire"
  );
}

export function isPatient(user?: DashboardRouteUser | null) {
  const role = getRole(user);
  const accountType = getAccountType(user);
  
  // For users with "both" role, check their current accountType
  if (role === "both") {
    return accountType === "worker";
  }
  
  if (
    accountType === "patient" ||
    accountType === "worker" ||
    role === "patient" ||
    role === "user" ||
    role === "work" ||
    role === "worker"
  ) {
    return true;
  }
  return !isAdmin(user) && !isEmployer(user);
}

export function getDefaultDashboardPath(user?: DashboardRouteUser | null) {
  if (isAdmin(user)) {
    const staffRole = getStaffRole(user);
    if (staffRole === "support_staff") return ROUTES.admin.support;
    if (staffRole === "moderator") return ROUTES.admin.moderationQueue;
    if (staffRole === "finance_team") return ROUTES.admin.disputes;
    if (staffRole === "analytics_team") return ROUTES.admin.analytics;
    return ADMIN_DASHBOARD_PATH;
  }

  if (isEmployer(user)) {
    return EMPLOYER_DASHBOARD_PATH;
  }

  return PATIENT_DASHBOARD_PATH;
}

/**
 * Where to send someone who is *entering* the app — after sign-in, OTP, email
 * verification, signup, or the landing-page CTA when already authenticated.
 *
 * Workers land on Find Jobs rather than their dashboard: browsing work is the
 * reason they opened the app, and the dashboard stays one nav click away.
 *
 * Deliberately separate from `getDefaultDashboardPath`, which is still the
 * right answer for *bounces* (wrong-role redirects, the legacy /dashboard
 * route) where "your home" — not "get to work" — is the intent.
 */
export function getPostAuthLandingPath(user?: DashboardRouteUser | null) {
  if (isAdmin(user)) {
    return getDefaultDashboardPath(user);
  }

  if (isEmployer(user)) {
    return EMPLOYER_DASHBOARD_PATH;
  }

  return WORKER_LANDING_PATH;
}

// Legacy aliases retained for backward compatibility.
export const isDoctor = isEmployer;
export const isWorker = isPatient;
