import test from 'node:test';
import assert from 'node:assert/strict';
import { requirePermission, requireSuperadmin } from '../../middleware/admin.js';

const run = (gate, user) => {
  let passed = false;
  let status = 200;
  gate({ user }, { status(code) { status = code; return this; }, json() { return this; } }, () => { passed = true; });
  return { passed, status };
};

const staff = (staffRole) => ({ role: 'admin', staffRole });

/**
 * Regression guard: routes in UserRoute/CategoryRoute/PaymentRoute used to sit
 * behind `requireAdmin` alone, so any staff role — including analytics_team,
 * which the matrix restricts to analytics only — could delete or disable any
 * marketplace user by calling the API directly.
 */
test('analytics_team cannot write to marketplace users', () => {
  const gate = requirePermission('users.suspend');
  assert.equal(run(gate, staff('analytics_team')).passed, false);
  assert.equal(run(gate, staff('analytics_team')).status, 403);
});

test('support_staff is read-only on users despite reaching the admin panel', () => {
  assert.equal(run(requirePermission('users.view'), staff('support_staff')).passed, true);
  assert.equal(run(requirePermission('users.suspend'), staff('support_staff')).passed, false);
});

test('roles that own user moderation keep write access', () => {
  const gate = requirePermission('users.suspend');
  assert.equal(run(gate, staff('moderator')).passed, true);
  assert.equal(run(gate, staff('admin_team')).passed, true);
  assert.equal(run(gate, { role: 'superadmin' }).passed, true);
});

test('only admin_team and superadmin may list privileged accounts', () => {
  const gate = requirePermission('staff.view');
  assert.equal(run(gate, staff('admin_team')).passed, true);
  assert.equal(run(gate, { role: 'superadmin' }).passed, true);
  assert.equal(run(gate, staff('moderator')).passed, false);
  assert.equal(run(gate, staff('finance_team')).passed, false);
});

test('platform config routes are superadmin-only', () => {
  assert.equal(run(requireSuperadmin, { role: 'superadmin' }).passed, true);
  for (const role of ['admin_team', 'moderator', 'finance_team', 'analytics_team', 'support_staff']) {
    assert.equal(run(requireSuperadmin, staff(role)).passed, false, `${role} must not pass`);
  }
});

test('a legacy admin with no sub-role still cannot reach superadmin-only routes', () => {
  assert.equal(run(requireSuperadmin, { role: 'admin', staffRole: null }).passed, false);
});
