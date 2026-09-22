/** Azure's default static and API hosts are cross-site, so cookie sessions are
 * not dependable there. This opt-in transport is limited to one browser tab. */
const ACCESS_TOKEN_KEY = 'microjobs_bearer_access_token';
const REFRESH_TOKEN_KEY = 'microjobs_bearer_refresh_token';

export const usesBearerAuthTransport = () => import.meta.env.VITE_AUTH_TRANSPORT === 'bearer';
export const getBearerAccessToken = () => !usesBearerAuthTransport() || typeof window === 'undefined' ? '' : sessionStorage.getItem(ACCESS_TOKEN_KEY) || '';
export const getBearerRefreshToken = () => !usesBearerAuthTransport() || typeof window === 'undefined' ? '' : sessionStorage.getItem(REFRESH_TOKEN_KEY) || '';
export const storeBearerTokens = (payload: { token?: unknown; refreshToken?: unknown }) => {
  if (!usesBearerAuthTransport() || typeof window === 'undefined') return;
  if (typeof payload.token === 'string' && payload.token) sessionStorage.setItem(ACCESS_TOKEN_KEY, payload.token);
  if (typeof payload.refreshToken === 'string' && payload.refreshToken) sessionStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
};
export const clearBearerTokens = () => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
};
