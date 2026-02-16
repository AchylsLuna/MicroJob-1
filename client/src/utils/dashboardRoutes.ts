export interface DashboardRouteUser {
  role?: string | null;
  user_type?: string | null;
  accountType?: string | null;
}

export const WORKER_DASHBOARD_PATH = "/worker/dashboard";
export const EMPLOYER_DASHBOARD_PATH = "/employer/dashboard";
export const ADMIN_DASHBOARD_PATH = "/admin/dashboard";

const getRole = (user?: DashboardRouteUser | null) =>
  (user?.role || user?.user_type || "").toLowerCase();

export function isAdmin(user?: DashboardRouteUser | null) {
  const role = getRole(user);
  return role === "admin" || role === "superadmin";
}

export function isEmployer(user?: DashboardRouteUser | null) {
  const role = getRole(user);
  return user?.accountType === "employer" || role === "employer" || role === "hire";
}

export function isWorker(user?: DashboardRouteUser | null) {
  return !isAdmin(user) && !isEmployer(user);
}

export function getDefaultDashboardPath(user?: DashboardRouteUser | null) {
  if (isAdmin(user)) {
    return ADMIN_DASHBOARD_PATH;
  }

  if (isEmployer(user)) {
    return EMPLOYER_DASHBOARD_PATH;
  }

  return WORKER_DASHBOARD_PATH;
}
