import { ROUTES } from "./routes";
import { isStaffRole } from "../lib/adminPermissions";

export interface DashboardRouteUser {
  role?: string | null;
  user_type?: string | null;
  accountType?: string | null;
}

/** Workers have no dashboard — Find Jobs is their home. */
export const WORKER_LANDING_PATH = ROUTES.worker.findJobs;
export const EMPLOYER_DASHBOARD_PATH = ROUTES.employer.dashboard;
export const DOCTOR_DASHBOARD_PATH = EMPLOYER_DASHBOARD_PATH;
export const ADMIN_DASHBOARD_PATH = ROUTES.admin.dashboard;

const getRole = (user?: DashboardRouteUser | null) =>
  (user?.role || user?.user_type || "").toLowerCase();
const getAccountType = (user?: DashboardRouteUser | null) =>
  (user?.accountType || "").toLowerCase();

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
    return ADMIN_DASHBOARD_PATH;
  }

  if (isEmployer(user)) {
    return EMPLOYER_DASHBOARD_PATH;
  }

  return WORKER_LANDING_PATH;
}

/**
 * Where to send someone who is *entering* the app — after sign-in, OTP, email
 * verification, signup, or the landing-page CTA when already authenticated.
 *
 * Kept separate from `getDefaultDashboardPath` (which handles *bounces*:
 * wrong-role redirects and the legacy /dashboard route) because they differ
 * for admins and employers. For workers the two now agree: there is no worker
 * dashboard, so Find Jobs is both their landing page and their home.
 */
export function getPostAuthLandingPath(user?: DashboardRouteUser | null) {
  if (isAdmin(user)) {
    return ADMIN_DASHBOARD_PATH;
  }

  if (isEmployer(user)) {
    return EMPLOYER_DASHBOARD_PATH;
  }

  return WORKER_LANDING_PATH;
}

// Legacy aliases retained for backward compatibility.
export const isDoctor = isEmployer;
export const isWorker = isPatient;
