import { getSignInRouteForPath } from "./authRedirects";

const AUTH_USER_KEY = "auth_user";
const CURRENT_USER_KEY = "current_user";
const AUTH_TOKEN_KEY = "auth_token";
const LEGACY_TOKEN_KEY = "token";
const PENDING_VERIFICATION_EMAIL_KEY = "pending_verification_email";
const PENDING_VERIFICATION_NAME_KEY = "pending_verification_name";
const PENDING_ACCOUNT_PREFERENCE_KEY = "pending_account_preference";
const TOKEN_ERROR_PATTERN = /(invalid|expired).*token|jwt/i;
const PUBLIC_AUTH_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/otp/send",
  "/auth/otp/verify",
]);

let redirectInProgress = false;

const normalizePath = (value?: string) => {
  if (!value) return "";
  // Handles both "/auth/login" and "http://host/api/auth/login".
  const withoutHost = value.replace(/^https?:\/\/[^/]+/i, "");
  const withoutApiPrefix = withoutHost.replace(/^\/api/, "");
  return withoutApiPrefix.split("?")[0];
};

export const isInvalidTokenError = ({
  status,
  message,
  path,
  hasToken,
}: {
  status?: number;
  message?: string;
  path?: string;
  hasToken?: boolean;
}) => {
  if (status !== 401) return false;

  const normalizedPath = normalizePath(path);
  if (PUBLIC_AUTH_PATHS.has(normalizedPath)) {
    // Login/register/otp failures should stay on the same form page.
    return false;
  }

  const text = String(message || "");
  if (TOKEN_ERROR_PATTERN.test(text)) {
    return true;
  }

  // Protected API returned 401 while we had a token, treat as expired session.
  return Boolean(hasToken);
};

export const clearAuthStorage = () => {
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
  localStorage.removeItem(PENDING_VERIFICATION_NAME_KEY);
  localStorage.removeItem(PENDING_ACCOUNT_PREFERENCE_KEY);
};

export const handleInvalidSession = () => {
  if (typeof window === "undefined") {
    return;
  }

  clearAuthStorage();
  window.dispatchEvent(new Event("auth_user_updated"));

  if (redirectInProgress) {
    return;
  }

  const signInPath = getSignInRouteForPath(window.location.pathname);
  const isAlreadyOnSignIn = window.location.pathname === signInPath;
  if (isAlreadyOnSignIn) {
    return;
  }

  redirectInProgress = true;
  window.location.assign(signInPath);
};
