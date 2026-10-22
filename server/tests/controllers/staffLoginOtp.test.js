import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { OAuth2Client } from 'google-auth-library';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import OtpChallenge from '../../models/OtpChallenge.js';
import TrustedDevice from '../../models/TrustedDevice.js';
import { loginUser, loginOtpVerify, loginOtpResend, loginTrustedDevice, loginMfa, selectLoginMethod, googleLogin } from '../../controllers/AuthController.js';
import { getAdminUserList } from '../../controllers/AdminController.js';
import { issueLoginOtpChallenge, createMfaChallengeToken, createLoginMethodSelectionToken } from '../../lib/mfaHelpers.js';
import { issueTrustedDevice } from '../../lib/trustedDevice.js';
import { requestSecondaryEmailOtp, confirmSecondaryEmailOtp } from '../../controllers/StaffSecondaryEmailController.js';
import { getTestOtpCode } from '../../lib/otpChallenges.js';

let mongo;
let sent;
const originalFetch = globalThis.fetch;
const env = { NODE_ENV: process.env.NODE_ENV, RESEND_API_KEY: process.env.RESEND_API_KEY, GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID };
before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.RESEND_API_KEY = 'test-provider';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await OtpChallenge.init();
  globalThis.fetch = async (_url, options) => {
    sent.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ id: 'test-mail' }) };
  };
});
after(async () => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(env)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  sent = [];
  await Promise.all([User.deleteMany({}), OtpChallenge.deleteMany({}), Session.deleteMany({}), TrustedDevice.deleteMany({})]);
});
const response = () => ({ statusCode: 200, cookies: {}, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; }, cookie(name, value) { this.cookies[name] = value; return this; }, clearCookie() { return this; } });
const call = async (controller, body, user) => {
  const res = response();
  await controller({ body, ...(user ? { user: { id: user._id, role: user.role } } : {}), ip: '127.0.0.1', headers: {}, get: () => 'test' }, res);
  return res;
};
const makeUser = async (role = 'admin', staffRole = null, extra = {}) => {
  const user = new User({ email: `${new mongoose.Types.ObjectId()}@example.com`, firstName: 'Staff', lastName: 'Test', role, staffRole, status: 'active', ...extra });
  await user.setPassword('CurrentPass1!');
  return user.save();
};
const login = (user, extra = {}) => call(loginUser, { emailOrUsername: user.email, password: 'CurrentPass1!', ...extra });
const lastCode = () => sent.at(-1).text.match(/\b\d{6}\b/)[0];

for (const [role, staffRole] of [['superadmin', null], ['admin', null], ...['admin_team', 'moderator', 'finance_team', 'analytics_team', 'support_staff'].map((r) => ['admin', r])]) {
  test(`${role}/${staffRole}: primary email login requires secondary OTP before creating a session`, async () => {
    const user = await makeUser(role, staffRole, { secondaryEmail: 'secondary@example.com', secondaryEmailVerifiedAt: new Date(), mfaEnabled: true });
    const res = await login(user, { requireOtp: false });
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.data.otpRequired, true);
    assert.equal(res.payload.data.deliveryEmail, user.secondaryEmail);
    assert.equal(res.payload.data.token, undefined);
    assert.equal(res.payload.data.user, undefined);
    assert.equal(res.payload.data.code, undefined);
    assert.deepEqual(res.cookies, {});
    assert.deepEqual(sent[0].to, [user.secondaryEmail]);
    assert.equal(await Session.countDocuments({}), 0);
    const verified = await call(loginOtpVerify, { otpToken: res.payload.data.otpToken, code: lastCode(), rememberDevice: true });
    assert.equal(verified.statusCode, 200);
    assert.equal(verified.payload.data.user.email, user.email);
    assert.equal(verified.payload.data.user.otpEnabled, true);
    assert.equal(verified.payload.data.user.secondaryEmail, undefined);
    assert.equal(await Session.countDocuments({}), 1);
    assert.equal(await TrustedDevice.countDocuments({}), 0);
    assert.equal((await login(user)).payload.data.otpRequired, true);
  });
}

test('staff without a verified secondary email receive password login with OTP Off', async () => {
  for (const extra of [{}, { secondaryEmail: 'unverified@example.com' }]) {
    const user = await makeUser('admin', 'support_staff', extra);
    const res = await login(user);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.data.user.otpEnabled, false);
    assert.ok(res.payload.data.token);
    assert.equal(res.payload.data.otpRequired, undefined);
  }
  assert.equal(sent.length, 0);
});

test('staff cannot sign in using username, phone number or secondary email', async () => {
  const user = await makeUser('admin', null, { username: 'staffname', phoneNumber: '09123456789', secondaryEmail: 'secondary@example.com', secondaryEmailVerifiedAt: new Date() });
  for (const body of [
    { emailOrUsername: 'staffname' }, { phoneNumber: '09123456789' }, { emailOrUsername: 'secondary@example.com' },
  ]) {
    assert.equal((await call(loginUser, { ...body, password: 'CurrentPass1!' })).statusCode, 401);
  }
  assert.equal(await Session.countDocuments({}), 0);
  assert.equal(sent.length, 0);
  assert.equal((await login(user, { emailOrUsername: ` ${user.email.toUpperCase()} ` })).payload.data.otpRequired, true);
});

test('resend sends only to secondary email and invalidates the old code/token; codes are single-use', async () => {
  const user = await makeUser('admin', null, { secondaryEmail: 'secondary@example.com', secondaryEmailVerifiedAt: new Date() });
  const first = await login(user);
  const originalCode = lastCode();
  const renewed = await call(loginOtpResend, { otpToken: first.payload.data.otpToken });
  assert.equal(renewed.statusCode, 200);
  assert.deepEqual(sent.map((mail) => mail.to), [[user.secondaryEmail], [user.secondaryEmail]]);
  assert.equal((await call(loginOtpVerify, { otpToken: first.payload.data.otpToken, code: originalCode })).statusCode, 401);
  const body = { otpToken: renewed.payload.data.otpToken, code: lastCode() };
  const results = await Promise.all([call(loginOtpVerify, body), call(loginOtpVerify, body)]);
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 401]);
  assert.equal((await call(loginOtpVerify, body)).statusCode, 401);
  assert.equal(await Session.countDocuments({}), 1);
});

test('wrong codes, expired codes and disabled accounts cannot complete or resend staff OTP login', async () => {
  const user = await makeUser('admin', null, { secondaryEmail: 'secondary@example.com', secondaryEmailVerifiedAt: new Date() });
  const challenge = await login(user);
  const code = lastCode();
  const token = challenge.payload.data.otpToken;
  const wrong = code === '000000' ? '111111' : '000000';
  assert.equal((await call(loginOtpVerify, { otpToken: token, code: wrong })).statusCode, 401);
  await OtpChallenge.updateOne({ user: user._id, active: true }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await call(loginOtpVerify, { otpToken: token, code })).statusCode, 401);
  const fresh = await login(user);
  await User.updateOne({ _id: user._id }, { $set: { status: 'disabled' } });
  assert.equal((await call(loginOtpResend, { otpToken: fresh.payload.data.otpToken })).statusCode, 401);
  assert.equal((await call(loginOtpVerify, { otpToken: fresh.payload.data.otpToken, code: lastCode() })).statusCode, 401);
  assert.equal(await Session.countDocuments({}), 0);
});

test('secondary-email replacement invalidates login OTP and rejects stale recipients on resend/verify', async () => {
  const user = await makeUser('admin', null, { secondaryEmail: 'old@example.com', secondaryEmailVerifiedAt: new Date() });
  const res = await login(user);
  const code = lastCode();
  await call(requestSecondaryEmailOtp, { email: 'new@example.com', currentPassword: 'CurrentPass1!' }, user);
  const enrolled = await call(confirmSecondaryEmailOtp, { email: 'new@example.com', code: getTestOtpCode('secondary-email-verification', `staff-secondary-email:${user._id}`) }, user);
  assert.equal(enrolled.statusCode, 200);
  assert.equal((await call(loginOtpResend, { otpToken: res.payload.data.otpToken })).statusCode, 401);
  assert.equal((await call(loginOtpVerify, { otpToken: res.payload.data.otpToken, code })).statusCode, 401);
  assert.equal((await login(user)).payload.data.deliveryEmail, 'new@example.com');
});

test('staff cannot bypass OTP with trusted-device or stale MFA/method tokens', async () => {
  const user = await makeUser('admin', null, { secondaryEmail: 'secondary@example.com', secondaryEmailVerifiedAt: new Date(), mfaEnabled: true });
  const device = await issueTrustedDevice(user, {});
  assert.equal((await login(user, { trustedDeviceToken: device.token })).payload.data.otpRequired, true);
  assert.equal((await call(loginTrustedDevice, { trustedDeviceToken: device.token })).statusCode, 401);
  assert.equal((await call(loginMfa, { mfaToken: createMfaChallengeToken(String(user._id)), code: '123456' })).statusCode, 401);
  assert.equal((await call(selectLoginMethod, { selectionToken: createLoginMethodSelectionToken(String(user._id)), method: 'gmail_otp' })).statusCode, 401);
  assert.equal(await Session.countDocuments({}), 0);
});

test('Google cannot create a staff session or convert the staff password provider', async () => {
  const user = await makeUser();
  process.env.GOOGLE_CLIENT_ID = 'test-audience';
  const original = OAuth2Client.prototype.verifyIdToken;
  try {
    OAuth2Client.prototype.verifyIdToken = async () => ({ getPayload: () => ({ sub: 'staff-google-id', email: user.email, email_verified: true }) });
    assert.equal((await call(googleLogin, { credential: 'test-credential' })).statusCode, 401);
    assert.equal((await User.findById(user._id)).authProvider, 'password');
    assert.equal(await Session.countDocuments({}), 0);
  } finally { OAuth2Client.prototype.verifyIdToken = original; }
});

test('marketplace OTP still targets primary email and cannot create a staff-only login', async () => {
  for (const role of ['work', 'hire', 'both']) {
    const user = await makeUser(role);
    assert.equal((await login(user, { staffOnly: true })).statusCode, 401);
    const challenge = await login(user);
    assert.equal(challenge.payload.data.otpRequired, true);
    assert.equal(challenge.payload.data.staffLogin, undefined);
    assert.deepEqual(sent.at(-1).to, [user.email]);
    assert.equal((await call(loginOtpVerify, { otpToken: challenge.payload.data.otpToken, code: lastCode() })).statusCode, 200);
  }
});

test('an earlier marketplace OTP cannot authenticate a newly promoted staff account', async () => {
  const user = await makeUser('work');
  const challenge = await issueLoginOtpChallenge(user);
  const code = lastCode();
  await User.updateOne({ _id: user._id }, { $set: { role: 'admin', secondaryEmail: 'secondary@example.com', secondaryEmailVerifiedAt: new Date() } });
  assert.equal((await call(loginOtpResend, { otpToken: challenge.otpToken })).statusCode, 401);
  assert.equal((await call(loginOtpVerify, { otpToken: challenge.otpToken, code })).statusCode, 401);
});

test('Admins listing returns OTP On/Off only, without secondary-email address or verification timestamp', async () => {
  const on = await makeUser('admin', 'moderator', { secondaryEmail: 'private@example.com', secondaryEmailVerifiedAt: new Date() });
  const off = await makeUser('admin', 'support_staff');
  const regular = await makeUser('work');
  const res = response();
  await getAdminUserList({ user: { role: 'superadmin' } }, res);
  const listed = (id) => res.payload.find((u) => String(u._id) === String(id));
  assert.equal(listed(on._id).otpEnabled, true);
  assert.equal(listed(off._id).otpEnabled, false);
  assert.equal(listed(regular._id).otpEnabled, undefined);
  for (const user of res.payload) { assert.equal(user.secondaryEmail, undefined); assert.equal(user.secondaryEmailVerifiedAt, undefined); }
});
