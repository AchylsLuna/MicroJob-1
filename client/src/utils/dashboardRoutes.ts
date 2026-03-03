import { ROUTES } from "./routes";

export interface DashboardRouteUser {
  role?: string | null;
  user_type?: string | null;
  accountType?: string | null;
}

export const PATIENT_DASHBOARD_PATH = ROUTES.worker.dashboard;
export const WORKER_DASHBOARD_PATH = PATIENT_DASHBOARD_PATH;
export const EMPLOYER_DASHBOARD_PATH = ROUTES.employer.dashboard;
export const DOCTOR_DASHBOARD_PATH = EMPLOYER_DASHBOARD_PATH;
export const ADMIN_DASHBOARD_PATH = ROUTES.admin.dashboard;

const getRole = (user?: DashboardRouteUser | null) =>
  (user?.role || user?.user_type || "").toLowerCase();
const getAccountType = (user?: DashboardRouteUser | null) =>
  (user?.accountType || "").toLowerCase();

export function isAdmin(user?: DashboardRouteUser | null) {
  const role = getRole(user);
  return role === "admin" || role === "superadmin";
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

  return PATIENT_DASHBOARD_PATH;
}

// Legacy aliases retained for backward compatibility.
export const isDoctor = isEmployer;
export const isWorker = isPatient;
