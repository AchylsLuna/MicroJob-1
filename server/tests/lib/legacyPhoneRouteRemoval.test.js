import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('only canonical authenticated phone-verification routes remain', () => {
  const routes = readFileSync(new URL('../../routes/authRoutes.js', import.meta.url), 'utf8');
  const routeIndex = readFileSync(new URL('../../routes/index.js', import.meta.url), 'utf8');

  assert.match(routes, /router\.post\('\/verification\/phone'/);
  assert.match(routes, /router\.post\('\/verification\/phone\/confirm'/);
  assert.doesNotMatch(routeIndex, /PhoneRoute|verify-phone/i);
  assert.equal(existsSync(new URL('../../routes/PhoneRoute.js', import.meta.url)), false);
  assert.equal(existsSync(new URL('../../models/PhoneVerification.js', import.meta.url)), false);
});
