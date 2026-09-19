import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import User from '../../models/User.js';
import OtpChallenge from '../../models/OtpChallenge.js';
import { loginUser } from '../../controllers/AuthController.js';
import { resetPasswordWithOtp, verifyPasswordResetOtp } from '../../controllers/UserController.js';
import { issueOtpChallenge } from '../../lib/otpChallenges.js';

const EMAIL = 'reset-login@example.ph';
const OLD_PASSWORD = 'OldPassword1!';
const NEW_PASSWORD = 'NewPassword2!';
let mongoServer;

const response = () => ({
  statusCode: 200,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
  cookie() { return this; },
  clearCookie() { return this; },
  set() { return this; },
});

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'password-reset-login-tests' });
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), OtpChallenge.deleteMany({})]);
  const user = new User({
    firstName: 'Reset',
    lastName: 'User',
    email: EMAIL,
    status: 'pending',
    verification: { emailVerified: false },
    failedLoginAttempts: 0,
    loginLockCount: 1,
    lockUntil: new Date(Date.now() + 60_000),
  });
  await user.setPassword(OLD_PASSWORD);
  await user.save();
});

test('a verified reset replaces the password and permits immediate login', async () => {
  const { code } = await issueOtpChallenge({ purpose: 'password-reset', subject: EMAIL });

  const verifyRes = response();
  await verifyPasswordResetOtp({ body: { email: EMAIL, code } }, verifyRes);
  assert.equal(verifyRes.statusCode, 200);

  const resetRes = response();
  await resetPasswordWithOtp({ body: { email: EMAIL, code, newPassword: NEW_PASSWORD }, ip: '127.0.0.1', get: () => 'test' }, resetRes);
  assert.equal(resetRes.statusCode, 200);

  const user = await User.findOne({ email: EMAIL }).select('+passwordHashed +failedLoginAttempts +loginLockCount +lockUntil');
  assert.equal(await user.validatePassword(OLD_PASSWORD), false);
  assert.equal(await user.validatePassword(NEW_PASSWORD), true);
  assert.equal(user.failedLoginAttempts, 0);
  assert.equal(user.loginLockCount, 0);
  assert.equal(user.lockUntil, null);
  assert.equal(user.status, 'active');
  assert.equal(user.verification.emailVerified, true);

  const loginRes = response();
  await loginUser({ body: { emailOrUsername: EMAIL, password: NEW_PASSWORD, requireOtp: true }, ip: '127.0.0.1', get: () => 'test', headers: {} }, loginRes);
  assert.equal(loginRes.statusCode, 200);
  assert.equal(loginRes.payload.data.otpRequired, true);
});
