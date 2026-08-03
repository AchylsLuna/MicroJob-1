import assert from 'node:assert/strict';
import test from 'node:test';
import { setSessionCookies } from '../../lib/authSession.js';

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
