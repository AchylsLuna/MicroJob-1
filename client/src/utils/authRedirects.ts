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

const SIGN_IN_PATHS = [ROUTES.signIn, ROUTES.signInLegacy, ROUTES.adminSignIn, ROUTES.signUp, ROUTES.signUpLegacy];

/**
 * Where to land someone after they sign in. `from` is the path the auth gate
 * interrupted, round-tripped through router state — so it is only trusted after
 * confirming it is a same-origin path. A protocol-relative value like
 * "//evil.com" is a valid pathname to the router but an open redirect to the
 * browser, hence the explicit second-character check. Sign-in routes are
 * rejected so an interrupted visit to /sign-in cannot loop.
 */
export const getPostSignInPath = (from: unknown, fallback: string) => {
  if (typeof from !== "string" || !from.startsWith("/")) return fallback;
  if (from.startsWith("//") || from.startsWith("/\\")) return fallback;
  const [pathname] = from.split(/[?#]/);
  if (SIGN_IN_PATHS.some((route) => matchesPath(pathname, route))) return fallback;
  return from;
};
