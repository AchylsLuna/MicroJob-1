import test from 'node:test';
import assert from 'node:assert/strict';

import csrfProtection, { csrfForCookieSession } from '../../middleware/csrf.js';

const response = () => ({
  statusCode: 200,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

test('cookie-authenticated writes require a matching CSRF header', () => {
  const res = response();
  let nextCalled = false;
  csrfForCookieSession({ method: 'POST', headers: {}, cookies: { token: 'session' }, get: () => '' }, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test('bearer-authenticated mobile writes do not require a browser CSRF cookie', () => {
  let nextCalled = false;
  csrfForCookieSession({
    method: 'POST',
    headers: { authorization: 'Bearer mobile-token' },
    cookies: {},
  }, response(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('strict CSRF validation accepts the configured cookie and header', () => {
  const previousName = process.env.CSRF_COOKIE_NAME;
  process.env.CSRF_COOKIE_NAME = 'csrfToken';
  let nextCalled = false;
  csrfProtection({
    cookies: { csrfToken: 'matching-token' },
    get: (name) => name === 'x-csrf-token' ? 'matching-token' : '',
  }, response(), () => { nextCalled = true; });
  if (previousName === undefined) delete process.env.CSRF_COOKIE_NAME;
  else process.env.CSRF_COOKIE_NAME = previousName;
  assert.equal(nextCalled, true);
});
