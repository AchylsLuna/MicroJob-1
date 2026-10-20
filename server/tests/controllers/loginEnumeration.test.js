import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../../models/User.js';
import { loginUser } from '../../controllers/AuthController.js';

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'login-enumeration-tests' });
  const user = new User({ firstName: 'Real', lastName: 'User', email: 'real@example.ph', status: 'active' });
  await user.setPassword('CorrectHorse1!');
  await user.save();

  const superadmin = new User({
    firstName: 'Super',
    lastName: 'Admin',
    email: 'superadmin@example.ph',
    role: 'superadmin',
    status: 'active',
    mfaEnabled: true,
  });
  await superadmin.setPassword('SuperAdmin123!');
  await superadmin.save();
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const response = () => ({
  statusCode: 200,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
  // The success path sets session cookies; without these stubs it throws and
  // returns 500, which would let a broken login masquerade as "not a 401".
  cookie() { return this; },
  clearCookie() { return this; },
  set() { return this; },
});

const attempt = async (emailOrUsername, password) => {
  const res = response();
  await loginUser({ body: { emailOrUsername, password }, ip: '127.0.0.1', get: () => 'test', headers: {} }, res);
  return res;
};

/**
 * Regression guard for the user-enumeration hole: login must not reveal
 * whether an identifier is registered. Distinct messages let an attacker
 * validate a breach dump against the platform (OWASP ASVS 3.2.2).
 */
test('unknown account and wrong password are indistinguishable', async () => {
  const unknown = await attempt('nobody@example.ph', 'AnyPassword1!');
  const wrongPassword = await attempt('real@example.ph', 'WrongPassword1!');

  assert.equal(unknown.statusCode, 401);
  assert.equal(wrongPassword.statusCode, 401);
  assert.equal(
    unknown.payload.message,
    wrongPassword.payload.message,
    'the two failure messages must be byte-identical',
  );
});

test('the generic message never names the failure cause', async () => {
  const { payload } = await attempt('nobody@example.ph', 'AnyPassword1!');
  assert.doesNotMatch(payload.message, /no account|not found|does not exist/i);
  assert.doesNotMatch(payload.message, /incorrect password|wrong password/i);
});

test('correct credentials still authenticate', async () => {
  const res = await attempt('real@example.ph', 'CorrectHorse1!');
  assert.equal(res.statusCode, 200, 'a valid login must succeed, not merely avoid a 401');
  // Correct credentials now land on the mandatory email-OTP challenge rather
  // than straight on a session. Reaching the challenge *is* the success signal
  // here: a rejected credential never gets this far, it 401s above.
  assert.equal(res.payload.data.otpRequired, true);
  assert.ok(res.payload.data.otpToken, 'the challenge must carry an otpToken');
});

/**
 * Regression guard for the second-factor bypass.
 *
 * `requireOtp` used to be read straight off the request body, so a caller that
 * simply omitted it skipped the email OTP entirely and a password alone was
 * enough to get full session cookies -- while the comment above the code
 * asserted the decision was made server-side. `attempt()` sends no
 * `requireOtp` at all, which is exactly the bypass shape, so this test fails
 * if that gate is ever reintroduced.
 */
test('a login that omits requireOtp is still challenged and gets no session', async () => {
  const res = await attempt('real@example.ph', 'CorrectHorse1!');

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.data.otpRequired, true);
  assert.equal(res.payload.data.user, undefined, 'no user may be returned before the OTP is verified');
  assert.equal(res.payload.data.accessToken, undefined, 'no access token may be issued before the OTP is verified');
  assert.equal(res.payload.data.refreshToken, undefined, 'no refresh token may be issued before the OTP is verified');
});

/**
 * The bypass was reachable with an explicitly falsy flag too, not only by
 * omitting it, so both shapes are pinned.
 */
test('a login that sends requireOtp:false is still challenged', async () => {
  const res = response();
  await loginUser(
    { body: { emailOrUsername: 'real@example.ph', password: 'CorrectHorse1!', requireOtp: false }, ip: '127.0.0.1', get: () => 'test', headers: {} },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.data.otpRequired, true);
  assert.equal(res.payload.data.user, undefined);
});

test('an administrator without a verified secondary email signs in with OTP off', async () => {
  const res = await attempt('superadmin@example.ph', 'SuperAdmin123!');

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.data.user.role, 'superadmin');
  assert.ok(res.payload.data.token, 'an administrator receives a session token');
  assert.equal(res.payload.data.otpRequired, undefined);
  assert.equal(res.payload.data.methodSelectionRequired, undefined);
  assert.equal(res.payload.data.user.otpEnabled, false);
});
