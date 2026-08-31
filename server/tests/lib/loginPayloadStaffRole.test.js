import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLoginPayload } from '../../lib/authSession.js';

const baseUser = {
  _id: 'user-1',
  firstName: 'Angela',
  lastName: 'Cruz',
  email: 'angela.cruz@microjobs.ph',
};

/**
 * Regression guard: the login payload flattens every staff member to
 * `role: 'admin'`, so `staffRole` is the only thing that tells a moderator
 * apart from a finance_team member. When it was missing, the client derived
 * the sub-role from `role` and every staff account resolved to admin_team —
 * wrong nav, and 403s from routes the UI still offered.
 */
test('the login payload carries the admin sub-role', () => {
  const payload = buildLoginPayload({ ...baseUser, role: 'admin', staffRole: 'finance_team' });
  assert.equal(payload.role, 'admin');
  assert.equal(payload.staffRole, 'finance_team');
});

test('each staff sub-role survives the login payload intact', () => {
  for (const staffRole of ['admin_team', 'moderator', 'finance_team', 'analytics_team', 'support_staff']) {
    const payload = buildLoginPayload({ ...baseUser, role: 'admin', staffRole });
    assert.equal(payload.staffRole, staffRole, `${staffRole} should survive`);
  }
});

test('superadmin reports superadmin as its staff role', () => {
  const payload = buildLoginPayload({ ...baseUser, role: 'superadmin' });
  assert.equal(payload.staffRole, 'superadmin');
});

test('a legacy admin with no stored sub-role reports null', () => {
  // The server-side fallback to admin_team lives in resolveStaffRole, not here:
  // the payload reports what is actually stored so the client is not misled.
  const payload = buildLoginPayload({ ...baseUser, role: 'admin' });
  assert.equal(payload.staffRole, null);
});

test('a marketplace user carries no staff role', () => {
  assert.equal(buildLoginPayload({ ...baseUser, role: 'work' }).staffRole, null);
  assert.equal(buildLoginPayload({ ...baseUser, role: 'hire' }).staffRole, null);
});
