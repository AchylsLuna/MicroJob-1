import { ROUTES, matchesPath, startsWithPath } from "./routes";

export const isAdminNamespacePath = (pathname: string) =>
  matchesPath(pathname, ROUTES.adminSignIn) ||
  startsWithPath(pathname, ROUTES.admin.root) ||
  startsWithPath(pathname, ROUTES.legacyDashboard.admin.root);

export const isEmployerNamespacePath = (pathname: string) =>
  startsWithPath(pathname, ROUTES.doctor.root) ||
  startsWithPath(pathname, ROUTES.employer.root) ||
  startsWithPath(pathname, ROUTES.legacyDashboard.doctor.root) ||
  startsWithPath(pathname, ROUTES.legacyDashboard.employer.root);

export const getSignInRouteForPath = (pathname: string) =>
  isAdminNamespacePath(pathname) ? ROUTES.adminSignIn : ROUTES.signIn;
