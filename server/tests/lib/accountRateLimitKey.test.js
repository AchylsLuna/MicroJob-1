import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuthRateLimitKey, buildAccountRateLimitKey } from '../../lib/rateLimiters.js';

/**
 * buildAuthRateLimitKey folds the client IP into the bucket, which means one
 * address gets a fresh allowance for every account it names (password
 * spraying) and one account gets a fresh allowance per attacking address
 * (distributed credential stuffing). buildAccountRateLimitKey exists to close
 * both by keying on the account alone; the two are chained on the login routes
 * so each ceiling applies independently.
 */

const req = (body, ip = '203.0.113.10') => ({ body, ip });

test('the account key ignores the source address', () => {
  const fromOneIp = buildAccountRateLimitKey(req({ emailOrUsername: 'victim@example.ph' }, '203.0.113.10'));
  const fromAnother = buildAccountRateLimitKey(req({ emailOrUsername: 'victim@example.ph' }, '198.51.100.7'));

  assert.equal(fromOneIp, fromAnother, 'a botnet must share one bucket per account');
});

test('the existing per-IP key still separates addresses', () => {
  const fromOneIp = buildAuthRateLimitKey(req({ emailOrUsername: 'victim@example.ph' }, '203.0.113.10'));
  const fromAnother = buildAuthRateLimitKey(req({ emailOrUsername: 'victim@example.ph' }, '198.51.100.7'));

  assert.notEqual(fromOneIp, fromAnother);
});

test('different accounts get different buckets from one address', () => {
  const first = buildAccountRateLimitKey(req({ emailOrUsername: 'a@example.ph' }));
  const second = buildAccountRateLimitKey(req({ emailOrUsername: 'b@example.ph' }));

  assert.notEqual(first, second);
});

test('the identifier is normalized so case and padding cannot split the bucket', () => {
  const plain = buildAccountRateLimitKey(req({ emailOrUsername: 'victim@example.ph' }));
  const shouted = buildAccountRateLimitKey(req({ emailOrUsername: '  VICTIM@Example.PH  ' }));

  assert.equal(plain, shouted);
});

test('every accepted identifier field feeds the key', () => {
  assert.ok(buildAccountRateLimitKey(req({ email: 'a@example.ph' })).includes('a@example.ph'));
  assert.ok(buildAccountRateLimitKey(req({ username: 'someone' })).includes('someone'));
  assert.ok(buildAccountRateLimitKey(req({ phoneNumber: '09171234567' })).includes('09171234567'));
});

/**
 * Without a fallback every anonymous request would share one key, letting any
 * caller exhaust the window for everybody.
 */
test('a request naming no account falls back to a per-address bucket', () => {
  const first = buildAccountRateLimitKey(req({}, '203.0.113.10'));
  const second = buildAccountRateLimitKey(req({}, '198.51.100.7'));

  assert.notEqual(first, second);
  assert.notEqual(first, buildAccountRateLimitKey(req({ emailOrUsername: 'a@example.ph' })));
});

test('a missing body does not throw', () => {
  assert.doesNotThrow(() => buildAccountRateLimitKey({ ip: '203.0.113.10' }));
});
