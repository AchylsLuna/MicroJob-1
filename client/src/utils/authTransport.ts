/** Azure's default static and API hosts are cross-site, so cookie sessions are
 * not dependable there. Sessions are limited to one browser tab; an explicitly
 * trusted device has its own persistent, expiring OTP exemption. */
const ACCESS_TOKEN_KEY = 'microjobs_bearer_access_token';
const REFRESH_TOKEN_KEY = 'microjobs_bearer_refresh_token';
const TRUSTED_DEVICE_KEY = 'microjobs_bearer_trusted_device';

export const usesBearerAuthTransport = () => import.meta.env.VITE_AUTH_TRANSPORT === 'bearer';
export const getBearerAccessToken = () => !usesBearerAuthTransport() || typeof window === 'undefined' ? '' : sessionStorage.getItem(ACCESS_TOKEN_KEY) || '';
export const getBearerRefreshToken = () => !usesBearerAuthTransport() || typeof window === 'undefined' ? '' : sessionStorage.getItem(REFRESH_TOKEN_KEY) || '';
export const getBearerTrustedDeviceToken = () => {
  if (!usesBearerAuthTransport() || typeof window === 'undefined') return '';
  try {
    const device = JSON.parse(localStorage.getItem(TRUSTED_DEVICE_KEY) || 'null');
    if (typeof device?.token === 'string' && typeof device?.expiresAt === 'string' && Date.parse(device.expiresAt) > Date.now()) return device.token;
    localStorage.removeItem(TRUSTED_DEVICE_KEY);
  } catch {
    return '';
  }
  return '';
};
export const storeBearerTokens = (payload: { token?: unknown; refreshToken?: unknown; trustedDeviceToken?: unknown; trustedDeviceExpiresAt?: unknown }) => {
  if (!usesBearerAuthTransport() || typeof window === 'undefined') return;
  if (typeof payload.token === 'string' && payload.token) sessionStorage.setItem(ACCESS_TOKEN_KEY, payload.token);
  if (typeof payload.refreshToken === 'string' && payload.refreshToken) sessionStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
  // Azure's cross-site transport does not use cookies. Preserve the separately
  // issued OTP exemption for its advertised lifetime; sessions remain tab-only.
  if (typeof payload.trustedDeviceToken === 'string' && typeof payload.trustedDeviceExpiresAt === 'string' && Date.parse(payload.trustedDeviceExpiresAt) > Date.now()) {
    localStorage.setItem(TRUSTED_DEVICE_KEY, JSON.stringify({ token: payload.trustedDeviceToken, expiresAt: payload.trustedDeviceExpiresAt }));
  }
};
export const clearBearerTokens = () => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  // Device trust survives normal sign-out; the server requires a password
  // again. Explicit revocation and expiry still invalidate its token.
};
