import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';

import User from '../../models/User.js';
import Session from '../../models/Session.js';
import verifyToken from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/admin.js';
import { createAccessToken } from '../../lib/authSession.js';
import { getJwtSecret } from '../../lib/jwtSecret.js';

/**
 * Regression guard for a privilege-escalation bug that every existing admin
 * test missed.
 *
 * middleware/admin.js reads `req.user.staffRole` to decide which staff
 * sub-role a request carries, but verifyToken selected only `role status` from
 * the database and createAccessToken never signed staffRole into the token. So
 * `req.user.staffRole` was always undefined, and resolveStaffRole's
 * `?? 'admin_team'` fallback -- written for legacy admins predating the field
 * -- fired for *every* admin instead. A support_staff account therefore held
 * admin_team's `staff.create` and `staff.assignRole` and could mint new admin
 * accounts, while finance_team lost the finance permissions it exists for.
 *
 * adminPermission.test.js and adminRouteGating.test.js did not catch this
 * because they hand-build `{ role: 'admin', staffRole: 'finance_team' }` and
 * call requirePermission directly, never exercising verifyToken. These tests
 * deliberately go through the real middleware against a real database instead.
 */

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'auth-staff-role-tests' });
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const seedStaff = async (staffRole, role = 'admin') => {
  const user = new User({
    firstName: 'Staff',
    lastName: 'Member',
    email: `${new mongoose.Types.ObjectId()}@microjobs.ph`,
    role,
    staffRole,
    status: 'active',
  });
  await user.setPassword('CorrectHorse1!');
  await user.save();

  const session = await Session.create({
    user: user._id,
    userAgent: 'test',
    ip: '127.0.0.1',
    active: true,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  return { user, session };
};

/** Runs the real verifyToken and returns the req.user it produced. */
const authenticate = async (token) => {
  const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
  const res = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  let passed = false;
  await verifyToken(req, res, () => { passed = true; });
  return { req, res, passed };
};

const gate = (permission, user) => {
  let passed = false;
  let status = 200;
  requirePermission(permission)(
    { user },
    { status(code) { status = code; return this; }, json() { return this; } },
    () => { passed = true; }
  );
  return { passed, status };
};

test('verifyToken loads the staff sub-role from the database', async () => {
  const { user, session } = await seedStaff('finance_team');
  const { req, passed } = await authenticate(createAccessToken(user, session._id.toString()));

  assert.equal(passed, true);
  assert.equal(req.user.role, 'admin');
  assert.equal(req.user.staffRole, 'finance_team');
});

test('each staff sub-role survives authentication intact', async () => {
  for (const staffRole of ['admin_team', 'moderator', 'finance_team', 'analytics_team', 'support_staff']) {
    const { user, session } = await seedStaff(staffRole);
    const { req } = await authenticate(createAccessToken(user, session._id.toString()));
    assert.equal(req.user.staffRole, staffRole, `${staffRole} should survive verifyToken`);
  }
});

/**
 * The escalation itself: support_staff must not reach staff.create. Before the
 * fix this assertion failed -- the account resolved to admin_team and could
 * create administrator accounts.
 */
test('support_staff cannot reach staff.create after authenticating', async () => {
  const { user, session } = await seedStaff('support_staff');
  const { req } = await authenticate(createAccessToken(user, session._id.toString()));

  const create = gate('staff.create', req.user);
  assert.equal(create.passed, false);
  assert.equal(create.status, 403);

  const assign = gate('staff.assignRole', req.user);
  assert.equal(assign.passed, false);

  // ...but the permissions its own role does hold still work.
  assert.equal(gate('users.view', req.user).passed, true);
});

test('analytics_team cannot reach user data after authenticating', async () => {
  const { user, session } = await seedStaff('analytics_team');
  const { req } = await authenticate(createAccessToken(user, session._id.toString()));

  assert.equal(gate('users.view', req.user).passed, false);
  assert.equal(gate('users.suspend', req.user).passed, false);
  assert.equal(gate('analytics.view', req.user).passed, true);
});

/** The other half of the bug: finance_team was losing its own permissions. */
test('finance_team keeps the finance permissions it exists for', async () => {
  const { user, session } = await seedStaff('finance_team');
  const { req } = await authenticate(createAccessToken(user, session._id.toString()));

  assert.equal(gate('finance.payouts.review', req.user).passed, true);
  assert.equal(gate('finance.disputes.handle', req.user).passed, true);
  assert.equal(gate('finance.transactions.view', req.user).passed, true);
  // And still cannot do admin_team work.
  assert.equal(gate('staff.create', req.user).passed, false);
});

/**
 * staffRole is assigned after the `...decoded` spread precisely so a forged
 * claim cannot win. It is not signed into the token at all, so this token can
 * only come from someone who holds the signing key -- but if that assignment
 * order is ever reversed, this test fails.
 */
test('a staffRole forged into the token cannot override the database', async () => {
  const { user, session } = await seedStaff('support_staff');
  const forged = jwt.sign(
    {
      userId: user._id,
      role: 'admin',
      staffRole: 'admin_team',
      sessionId: session._id.toString(),
    },
    getJwtSecret(),
    { expiresIn: '15m' }
  );

  const { req } = await authenticate(forged);

  assert.equal(req.user.staffRole, 'support_staff');
  assert.equal(gate('staff.create', req.user).passed, false);
});

/** The documented fallback must still protect admins predating the field. */
test('a legacy admin with no stored sub-role still resolves to admin_team', async () => {
  const { user, session } = await seedStaff(null);
  const { req } = await authenticate(createAccessToken(user, session._id.toString()));

  assert.equal(req.user.staffRole, null);
  assert.equal(gate('users.view', req.user).passed, true);
  assert.equal(gate('finance.payouts.review', req.user).passed, false);
});

test('superadmin passes every gate regardless of sub-role', async () => {
  const { user, session } = await seedStaff(null, 'superadmin');
  const { req } = await authenticate(createAccessToken(user, session._id.toString()));

  assert.equal(gate('staff.create', req.user).passed, true);
  assert.equal(gate('finance.disputes.handle', req.user).passed, true);
});

/** A demotion must take effect on the next request, not at token expiry. */
test('a demotion applies immediately without waiting for the token to expire', async () => {
  const { user, session } = await seedStaff('admin_team');
  const token = createAccessToken(user, session._id.toString());

  assert.equal(gate('staff.create', (await authenticate(token)).req.user).passed, true);

  user.staffRole = 'analytics_team';
  await user.save();

  const { req } = await authenticate(token);
  assert.equal(req.user.staffRole, 'analytics_team');
  assert.equal(gate('staff.create', req.user).passed, false);
});
