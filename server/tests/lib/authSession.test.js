import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAuthTokensPayload, isNativeAuthRequest, setSessionCookies } from '../../lib/authSession.js';

test('setSessionCookies uses the provided expiry dates for all auth cookies', () => {
  const cookies = [];
  const res = {
    cookie(name, value, options) {
      cookies.push({ name, value, options });
    },
  };

  const expiresAt = new Date('2025-01-01T00:00:00.000Z');
  const accessTokenExpiresAt = new Date('2025-01-01T01:00:00.000Z');

  setSessionCookies(res, {
    refreshToken: 'refresh-token',
    sessionId: 'session-id',
    accessToken: 'access-token',
    accessTokenExpiresAt,
    expiresAt,
    csrfToken: 'csrf-token',
  });

  assert.deepEqual(
    cookies.map((cookie) => cookie.name),
    ['csrfToken', 'refreshToken', 'sessionId', 'token']
  );

  const csrfCookie = cookies.find((cookie) => cookie.name === 'csrfToken');
  const refreshCookie = cookies.find((cookie) => cookie.name === 'refreshToken');
  const sessionCookie = cookies.find((cookie) => cookie.name === 'sessionId');
  const tokenCookie = cookies.find((cookie) => cookie.name === 'token');

  assert.equal(csrfCookie.options.expires, expiresAt);
  assert.equal(refreshCookie.options.expires, expiresAt);
  assert.equal(sessionCookie.options.expires, expiresAt);
  assert.equal(tokenCookie.options.expires, accessTokenExpiresAt);
});

test('refresh tokens are returned only to native-style authentication requests', () => {
  const authSession = {
    accessToken: 'access-token',
    accessTokenExpiresAt: new Date('2025-01-01T01:00:00.000Z'),
    refreshToken: 'refresh-token',
    expiresAt: new Date('2025-01-08T00:00:00.000Z'),
  };
  const nativeRequest = { get: (name) => name.toLowerCase() === 'x-microjobs-client' ? 'native' : undefined };
  const browserRequest = { get: (name) => name.toLowerCase() === 'origin' ? 'https://microjobs.test' : (name.toLowerCase() === 'x-microjobs-client' ? 'native' : undefined) };

  assert.equal(isNativeAuthRequest(nativeRequest), true);
  assert.equal(isNativeAuthRequest(browserRequest), false);
  assert.equal(buildAuthTokensPayload(nativeRequest, authSession).refreshToken, 'refresh-token');
  assert.equal('refreshToken' in buildAuthTokensPayload(browserRequest, authSession), false);
});
