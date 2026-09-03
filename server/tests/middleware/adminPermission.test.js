import test from 'node:test';
import assert from 'node:assert/strict';
import { requirePermission } from '../../middleware/admin.js';

/**
 * NOTE: every `user` below is hand-built, so these tests exercise the
 * permission matrix in isolation and say nothing about whether the request
 * pipeline actually populates `staffRole`. It did not, for a while: verifyToken
 * omitted the field entirely and every admin silently collapsed to the
 * admin_team fallback while this file stayed green. The end-to-end coverage
 * that catches that lives in tests/middleware/authStaffRole.test.js -- add
 * wiring-level assertions there, not here.
 */

const response = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

const run = (permission, user) => {
  const res = response();
  let passed = false;
  requirePermission(permission)({ user }, res, () => {
    passed = true;
  });
  return { passed, res };
};

test('a staff role holding the permission passes through', () => {
  const { passed } = run('finance.payouts.review', { role: 'admin', staffRole: 'finance_team' });
  assert.equal(passed, true);
});

test('a staff role missing the permission is rejected with 403', () => {
  const { passed, res } = run('finance.payouts.review', { role: 'admin', staffRole: 'moderator' });
  assert.equal(passed, false);
  assert.equal(res.statusCode, 403);
});

test('superadmin passes every permission gate', () => {
  assert.equal(run('staff.create', { role: 'superadmin' }).passed, true);
  assert.equal(run('finance.disputes.handle', { role: 'superadmin' }).passed, true);
});

test('a legacy admin with no sub-role keeps admin_team access but not finance', () => {
  assert.equal(run('users.view', { role: 'admin', staffRole: null }).passed, true);
  const { passed, res } = run('finance.payouts.review', { role: 'admin', staffRole: null });
  assert.equal(passed, false);
  assert.equal(res.statusCode, 403);
});

test('analytics_team cannot reach user data', () => {
  assert.equal(run('users.view', { role: 'admin', staffRole: 'analytics_team' }).passed, false);
  assert.equal(run('analytics.view', { role: 'admin', staffRole: 'analytics_team' }).passed, true);
});
