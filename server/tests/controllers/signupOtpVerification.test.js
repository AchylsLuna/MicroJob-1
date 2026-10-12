import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import User from '../../models/User.js';
import Session from '../../models/Session.js';
import { sendOtp, verifyOtp } from '../../controllers/UserController.js';
import { issueOtpChallenge } from '../../lib/otpChallenges.js';

/**
 * `POST /api/auth/otp/verify` completes signup email verification. It used to
 * assign `status = "active"` unconditionally and then mint a full session plus
 * a 30-day trusted device for *any* account that could produce a valid code.
 * That made it three separate holes at once:
 *
 *   - every admin ban, disable and soft-delete was reversible by the account's
 *     own owner (send yourself a code, verify it, you are live again),
 *   - MFA was bypassed outright, because an enrolled account got a session here
 *     without ever presenting its second factor,
 *   - and `sendOtp` returned the code in the HTTP response body on any
 *     non-production deploy, so the whole thing needed no password at all.
 *
 * These tests pin all three shut.
 */

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'signup-otp-tests' });
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Session.deleteMany({}),
    mongoose.connection.collection('otpchallenges').deleteMany({}),
  ]);
});

const response = () => ({
  statusCode: 200,
  payload: null,
  cookies: {},
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
  cookie(name, value) { this.cookies[name] = value; return this; },
  clearCookie(name) { delete this.cookies[name]; return this; },
  set() { return this; },
});

const request = (body) => ({ body, ip: '127.0.0.1', get: () => 'test', headers: {} });

const seedUser = async (status, extra = {}) => {
  const user = new User({
    firstName: 'Otp',
    lastName: 'Subject',
    email: 'otp-subject@example.ph',
    status,
    ...extra,
  });
  await user.setPassword('CorrectHorse1!');
  await user.save();
  return user;
};

/** A real challenge for the address, so only the status gate is under test. */
const challengeFor = async (user) => {
  const { code } = await issueOtpChallenge({
    purpose: 'email-verification',
    subject: user.email,
    user: user._id,
  });
  return code;
};

for (const status of ['banned', 'disabled', 'deleted']) {
  test(`a ${status} account cannot reactivate itself through signup OTP verification`, async () => {
    const user = await seedUser(status);
    const code = await challengeFor(user);

    const res = response();
    await verifyOtp(request({ email: user.email, code }), res);

    assert.equal(res.statusCode, 401, `a ${status} account must be refused`);
    const after = await User.findById(user._id);
    assert.equal(after.status, status, 'status must be read before it is written, never overwritten');
    assert.equal(await Session.countDocuments({ user: user._id }), 0, 'no session may be created');
    assert.equal(res.cookies.refreshToken, undefined, 'no session cookies may be set');
    assert.equal(res.cookies.trustedDevice, undefined, 'no trusted device may be issued');
  });
}

test('a pending signup is promoted to active and does get a session', async () => {
  const user = await seedUser('pending');
  const code = await challengeFor(user);

  const res = response();
  await verifyOtp(request({ email: user.email, code }), res);

  assert.equal(res.statusCode, 200);
  const after = await User.findById(user._id);
  assert.equal(after.status, 'active');
  assert.equal(after.verification.emailVerified, true);
  assert.equal(res.payload.user.email, user.email, 'the signup client needs the user payload');
  assert.equal(await Session.countDocuments({ user: user._id }), 1, 'completing signup issues one session');
});

test('an already-active account verifies its email but is issued no session', async () => {
  // This is what closes the MFA bypass: MFA can only be enrolled by an account
  // that is already active, so it can never be `pending` above. Confirming a
  // mailbox proves control of the email, not of the password or the enrolled
  // authenticator, so it must not be an authentication event on its own.
  const user = await seedUser('active', { mfaEnabled: true });
  const code = await challengeFor(user);

  const res = response();
  await verifyOtp(request({ email: user.email, code }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.emailVerified, true);
  assert.equal(res.payload.user, undefined, 'no user payload may be returned without authentication');
  assert.equal(await Session.countDocuments({ user: user._id }), 0, 'no session may be created');
  assert.equal(res.cookies.refreshToken, undefined);
  assert.equal(res.cookies.trustedDevice, undefined, 'no OTP-skipping trusted device may be issued');

  const after = await User.findById(user._id);
  assert.equal(after.verification.emailVerified, true, 'the email is still recorded as verified');
});

test('sendOtp never returns the code in the response body', async () => {
  await seedUser('pending');

  const res = response();
  await sendOtp(request({ email: 'otp-subject@example.ph' }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.code, undefined, 'returning the code makes this an account-takeover primitive');
});
