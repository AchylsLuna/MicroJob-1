export const ROUTES = {
  home: "/",
  signIn: "/sign-in",
  signInLegacy: "/signin",
  signUp: "/sign-up",
  signUpLegacy: "/signup",
  adminSignIn: "/admin-sign-in",
  // Legacy path kept for backward compatibility; redirects to generic sign-in.
  doctorSignIn: "/doctor-sign-in",
  emailVerification: "/email-verification",
  topUpSuccess: "/topup-success",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  terms: "/terms",
  privacy: "/privacy",
  cookiePolicy: "/cookie-policy",

  settings: "/settings",
  publicProfilePattern: "/profiles/:userId",
  publicProfile: (userId: string) => `/profiles/${userId}`,
  notifications: "/notifications",
  support: "/support",

  worker: {
    dashboard: "/worker/dashboard",
    findJobs: "/worker/find-jobs",
    appliedJobs: "/worker/applied-jobs",
    savedJobs: "/worker/saved-jobs",
    notifications: "/worker/notifications",
    profile: "/worker/profile",
    support: "/worker/support",
    messages: "/worker/messages",
    eWallet: "/worker/e-wallet",
    jobDetailsPattern: "/worker/job-details/:jobId",
    jobDetails: (jobId: string) => `/worker/job-details/${jobId}`,
  },

  employer: {
    root: "/employer",
    dashboard: "/employer/dashboard",
    postJob: "/employer/post-job",
    applications: "/employer/applications",
    jobs: "/employer/jobs",
    messages: "/employer/messages",
    eWallet: "/employer/e-wallet",
    notifications: "/employer/notifications",
    support: "/employer/support",
    settings: "/employer/settings",
  },

  doctor: {
    // Legacy doctor namespace kept as redirects to employer routes.
    root: "/doctor",
    dashboard: "/doctor/dashboard",
    postJob: "/doctor/post-job",
    applications: "/doctor/applications",
    jobs: "/doctor/jobs",
    messages: "/doctor/messages",
    eWallet: "/doctor/e-wallet",
    notifications: "/doctor/notifications",
    support: "/doctor/support",
    settings: "/doctor/settings",
  },

  admin: {
    root: "/admin",
    dashboard: "/admin/dashboard",
    messages: "/admin/messages",
    analytics: "/admin/analytics",
    reports: "/admin/reports",
    eWallet: "/admin/e-wallet",
    jobs: "/admin/jobs",
    security: "/admin/security",
    userManagement: "/admin/user-management",
  },

  legacyDashboard: {
    root: "/dashboard",
    findJobs: "/dashboard/find-jobs",
    jobDetailsPattern: "/dashboard/job-details/:jobId",
    jobDetailsNewPattern: "/dashboard/job-details-new/:jobId",
    jobDetails: (jobId: string) => `/dashboard/job-details/${jobId}`,
    jobDetailsNew: (jobId: string) => `/dashboard/job-details-new/${jobId}`,
    eWallet: "/dashboard/e-wallet",
    messages: "/dashboard/messages",
    appliedJobs: "/dashboard/applied-jobs",
    savedJobs: "/dashboard/saved-jobs",
    notifications: "/dashboard/notifications",
    support: "/dashboard/support",
    profile: "/dashboard/profile",
    settings: "/dashboard/settings",
    employer: {
      root: "/dashboard/employer",
      applications: "/dashboard/employer/applications",
      postJob: "/dashboard/employer/post-job",
      jobs: "/dashboard/employer/jobs",
      messages: "/dashboard/employer/messages",
      eWallet: "/dashboard/employer/e-wallet",
      notifications: "/dashboard/employer/notifications",
      support: "/dashboard/employer/support",
      settings: "/dashboard/employer/settings",
    },
    doctor: {
      root: "/dashboard/doctor",
      applications: "/dashboard/doctor/applications",
      postJob: "/dashboard/doctor/post-job",
      jobs: "/dashboard/doctor/jobs",
      messages: "/dashboard/doctor/messages",
      eWallet: "/dashboard/doctor/e-wallet",
      notifications: "/dashboard/doctor/notifications",
      support: "/dashboard/doctor/support",
      settings: "/dashboard/doctor/settings",
    },
    admin: {
      root: "/dashboard/admin-dashboard",
      messages: "/dashboard/admin-dashboard/messages",
      analytics: "/dashboard/admin-dashboard/analytics",
      reports: "/dashboard/admin-dashboard/reports",
      eWallet: "/dashboard/admin-dashboard/e-wallet",
      jobs: "/dashboard/admin-dashboard/jobs",
      security: "/dashboard/admin-dashboard/security",
      userManagement: "/dashboard/admin-dashboard/user-management",
    },
  },

  legacyShortcuts: {
    findJobs: "/find-jobs",
    jobDetailsPattern: "/job-details/:jobId",
    jobDetails: (jobId: string) => `/job-details/${jobId}`,
    eWallet: "/e-wallet",
    messages: "/messages",
    appliedJobs: "/applied-jobs",
    savedJobs: "/saved-jobs",
    profile: "/profile",
  },
} as const;

export const WORKER_ROUTE_PREFIX = "/worker";
export const EMPLOYER_ROUTE_PREFIX = "/employer";
export const DOCTOR_ROUTE_PREFIX = "/doctor";
export const ADMIN_ROUTE_PREFIX = "/admin";

const stripTrailingSlash = (value: string) =>
  value !== "/" && value.endsWith("/") ? value.slice(0, -1) : value;

export const matchesPath = (pathname: string, target: string) =>
  stripTrailingSlash(pathname) === stripTrailingSlash(target);

export const startsWithPath = (pathname: string, prefix: string) => {
  const normalizedPath = stripTrailingSlash(pathname);
  const normalizedPrefix = stripTrailingSlash(prefix);
  return (
    normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`)
  );
};

export const matchesAnyPath = (pathname: string, targets: string[]) =>
  targets.some((target) => startsWithPath(pathname, target));

export const isWorkerPath = (pathname: string) => startsWithPath(pathname, WORKER_ROUTE_PREFIX);
export const isEmployerPath = (pathname: string) => startsWithPath(pathname, EMPLOYER_ROUTE_PREFIX);
export const isDoctorPath = (pathname: string) => startsWithPath(pathname, DOCTOR_ROUTE_PREFIX);
export const isAdminPath = (pathname: string) => startsWithPath(pathname, ADMIN_ROUTE_PREFIX);
