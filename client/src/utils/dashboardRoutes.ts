// Dashboard route constants and utilities for different user roles

export const WORKER_DASHBOARD_PATH = "/worker/dashboard";
export const EMPLOYER_DASHBOARD_PATH = "/employer/dashboard";
export const ADMIN_DASHBOARD_PATH = "/admin/dashboard";

export type UserRole = "admin" | "employer" | "worker";

export interface DashboardUser {
  role?: UserRole | string;
  user_type?: string;
}

/**
 * Get the default dashboard path based on user role
 */
export const getDefaultDashboardPath = (user: DashboardUser | null): string => {
  if (!user) {
    return WORKER_DASHBOARD_PATH;
  }

  const role = (user.role || user.user_type || "worker").toLowerCase();

  switch (role) {
    case "admin":
      return ADMIN_DASHBOARD_PATH;
    case "employer":
      return EMPLOYER_DASHBOARD_PATH;
    case "worker":
    default:
      return WORKER_DASHBOARD_PATH;
  }
};

/**
 * Check if a user has admin role
 */
export const isAdmin = (user: DashboardUser | null): boolean => {
  if (!user) return false;
  const role = (user.role || user.user_type || "").toLowerCase();
  return role === "admin";
};

/**
 * Check if a user has employer role
 */
export const isEmployer = (user: DashboardUser | null): boolean => {
  if (!user) return false;
  const role = (user.role || user.user_type || "").toLowerCase();
  return role === "employer";
};

/**
 * Check if a user has worker role
 */
export const isWorker = (user: DashboardUser | null): boolean => {
  if (!user) return false;
  const role = (user.role || user.user_type || "").toLowerCase();
  return role === "worker";
};
