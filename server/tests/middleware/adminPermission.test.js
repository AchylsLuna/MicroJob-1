import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLE_PERMISSIONS, requireAdminPermission } from '../../middleware/adminPermission.js';

const allPermissions = [
  'admin.dashboard',
  'staff.view',
  'staff.create',
  'staff.assignRole',
  'staff.toggleStatus',
  'audit.view',
  'users.view',
  'users.suspend',
  'users.ban',
  'users.resetPassword',
  'users.unlock',
  'verification.review',
  'moderation.review',
  'moderation.enforce',
  'jobs.view',
  'finance.transactions.view',
  'finance.reconciliation.view',
  'finance.flag',
  'finance.payouts.review',
  'finance.disputes.handle',
  'finance.logs.view',
  'analytics.view',
  'analytics.export',
  'support.tickets.handle',
  'support.escalate',
];

const check = (role, permission) => {
  let nextCalled = false;
  let statusCode = 200;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };
  requireAdminPermission(permission)({ user: { role: 'admin', staffRole: role } }, response, () => {
    nextCalled = true;
  });
  return { nextCalled, statusCode };
};

test('each staff role matches the declared permission matrix', () => {
  for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permission of allPermissions) {
      const result = check(role, permission);
      assert.equal(
        result.nextCalled,
        permissions.has(permission),
        `${role} unexpectedly ${permissions.has(permission) ? 'lacks' : 'has'} ${permission}`,
      );
      if (!permissions.has(permission)) assert.equal(result.statusCode, 403);
    }
  }
});

test('superadmin bypasses staff permission checks', () => {
  for (const permission of allPermissions) {
    let nextCalled = false;
    requireAdminPermission(permission)({ user: { role: 'superadmin', staffRole: null } }, {}, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true, `superadmin was denied ${permission}`);
  }
});

test('sensitive role boundaries remain denied', () => {
  const denied = [
    ['support_staff', 'finance.disputes.handle'],
    ['support_staff', 'users.suspend'],
    ['moderator', 'finance.payouts.review'],
    ['moderator', 'staff.view'],
    ['finance_team', 'users.view'],
    ['finance_team', 'moderation.enforce'],
    ['analytics_team', 'users.view'],
    ['analytics_team', 'finance.transactions.view'],
    ['analytics_team', 'admin.dashboard'],
  ];

  for (const [role, permission] of denied) {
    assert.equal(check(role, permission).statusCode, 403, `${role} should not have ${permission}`);
  }
});
