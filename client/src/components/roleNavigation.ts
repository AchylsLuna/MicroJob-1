import { ROUTES, matchesPath, startsWithPath } from "../utils/routes";

export type AccountMode = "worker" | "employer";

export type RoleNavigationItem = {
  id: string;
  label: string;
  path: string;
  exactPaths?: string[];
  nestedPaths?: string[];
};

export const workerBottomNavigation: RoleNavigationItem[] = [
  { id: "home", label: "Home", path: ROUTES.worker.dashboard, exactPaths: [ROUTES.worker.notifications] },
  {
    id: "jobs",
    label: "Jobs",
    path: ROUTES.worker.findJobs,
    exactPaths: [ROUTES.worker.appliedJobs, ROUTES.worker.savedJobs],
    nestedPaths: [ROUTES.worker.jobDetailsPattern.replace("/:jobId", "")],
  },
  { id: "wallet", label: "E-Wallet", path: ROUTES.worker.eWallet },
  { id: "messages", label: "Messages", path: ROUTES.worker.messages },
  { id: "profile", label: "Profile", path: ROUTES.worker.profile, exactPaths: [ROUTES.worker.settings, ROUTES.worker.support] },
];

export const employerBottomNavigation: RoleNavigationItem[] = [
  { id: "home", label: "Home", path: ROUTES.employer.dashboard },
  { id: "applications", label: "Applications", path: ROUTES.employer.applications },
  { id: "post-job", label: "Post Job", path: ROUTES.employer.postJob, exactPaths: [ROUTES.employer.jobs] },
  { id: "messages", label: "Messages", path: ROUTES.employer.messages },
  { id: "alerts", label: "Alerts", path: ROUTES.employer.notifications },
  {
    id: "profile",
    label: "Profile",
    path: ROUTES.employer.profile,
    exactPaths: [ROUTES.employer.settings, ROUTES.employer.support, ROUTES.employer.eWallet],
  },
];

export const dashboardPathForMode = (mode: AccountMode) =>
  mode === "employer" ? ROUTES.employer.dashboard : ROUTES.worker.dashboard;

export const settingsPathForMode = (mode: AccountMode) =>
  mode === "employer" ? ROUTES.employer.settings : ROUTES.worker.settings;

export const navigationForMode = (mode: AccountMode) =>
  mode === "employer" ? employerBottomNavigation : workerBottomNavigation;

export const isNavigationItemActive = (pathname: string, item: RoleNavigationItem) =>
  matchesPath(pathname, item.path) ||
  Boolean(item.exactPaths?.some((candidate) => matchesPath(pathname, candidate))) ||
  Boolean(item.nestedPaths?.some((candidate) => startsWithPath(pathname, candidate)));

export const activeNavigationItem = (pathname: string, items: RoleNavigationItem[]) =>
  items.find((item) => isNavigationItemActive(pathname, item));

export const isSettingsPath = (pathname: string) =>
  [ROUTES.worker.settings, ROUTES.employer.settings, ROUTES.settings, ROUTES.legacyDashboard.settings]
    .some((candidate) => matchesPath(pathname, candidate));
