import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import TrustedDevice from '../../models/TrustedDevice.js';
import { loginUser, loginOtpVerify, loginTrustedDevice } from '../../controllers/AuthController.js';
import { logout, revokeAllSessions, revokeTrustedDevice } from '../../controllers/SessionController.js';
import { issueTrustedDevice } from '../../lib/trustedDevice.js';
import { createSessionWithTokens } from '../../lib/authSession.js';
import { issueOtpChallenge } from '../../lib/otpChallenges.js';
import { createLoginOtpChallengeToken } from '../../lib/mfaHelpers.js';

let mongoServer;
before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'trusted-device-login-tests' });
});
after(async () => { await mongoose.disconnect(); await mongoServer.stop(); });
beforeEach(() => Promise.all([User.deleteMany({}), Session.deleteMany({}), TrustedDevice.deleteMany({})]));

const request = (body = {}, cookies = {}, user, headers = {}) => ({
  body, cookies, user, headers, ip: '127.0.0.1',
  get: (name) => String(name).toLowerCase() === 'user-agent' ? 'Trusted browser test' : headers[String(name).toLowerCase()],
});
const response = (cookieJar) => ({
  statusCode: 200, payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
  cookie(name, value) { cookieJar[name] = value; return this; },
  clearCookie(name) { delete cookieJar[name]; return this; },
  set() { return this; },
});
async function fixture(extra = {}) {
  const user = new User({ firstName: 'Trusted', lastName: 'User', email: 'trusted@example.ph', role: 'work', status: 'active', ...extra });
  await user.setPassword('TestPassword123!');
  await user.save();
  const trusted = await issueTrustedDevice(user, { label: 'Trusted browser test' });
  const session = await createSessionWithTokens(request(), user);
  const jar = { trustedDevice: trusted.token, refreshToken: session.refreshToken, token: session.accessToken, sessionId: session.sessionId, csrfToken: 'test-csrf' };
  return { user, trusted, session, jar };
}

test('normal sign-out preserves 30-day device trust for the next password sign-in', async () => {
  const { user, session, jar } = await fixture();
  await logout(request({}, { ...jar }, { id: String(user._id), sessionId: session.sessionId }), response(jar));
  assert.equal(await TrustedDevice.countDocuments({ user: user._id }), 1, 'normal sign-out must preserve the trusted-device record');
  assert.equal(jar.token, undefined, 'sign-out clears the session cookie');
  assert.equal(jar.refreshToken, undefined, 'sign-out clears refresh credentials');
  assert.equal((await Session.findById(session.sessionId)).active, false, 'the old session must end');
  const result = response(jar);
  await loginUser(request({ emailOrUsername: user.email, password: 'TestPassword123!' }, { ...jar }), result);
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.data.otpRequired, undefined, 'same trusted browser must not ask for another email OTP after normal sign-out');
  assert.equal(String(result.payload.data.user?.id), String(user._id));
});

test('email OTP verification returns device trust for the deployed bearer transport', async () => {
  const { user } = await fixture();
  await TrustedDevice.deleteMany({});
  const { challenge, code } = await issueOtpChallenge({ purpose: 'login', subject: String(user._id), user: user._id });
  const otpToken = createLoginOtpChallengeToken(String(user._id), challenge.challengeId);
  const result = response({});
  await loginOtpVerify(request({ otpToken, code, rememberDevice: true }, {}, undefined, { 'x-microjobs-auth-transport': 'bearer' }), result);
  assert.equal(result.statusCode, 200);
  assert.equal(typeof result.payload.data.trustedDeviceToken, 'string', 'bearer browsers need the issued trust token in the response because they do not use cookies');
  assert.ok(result.payload.data.trustedDeviceExpiresAt);
});

test('normal sign-out cannot be undone by passwordless trusted-device login', async () => {
  const { user, trusted, session, jar } = await fixture();
  await logout(request({}, { ...jar }, { id: String(user._id), sessionId: session.sessionId }), response(jar));
  const result = response({});
  await loginTrustedDevice(request({ trustedDeviceToken: trusted.token }), result);
  assert.equal(result.statusCode, 401);
  assert.equal(await Session.countDocuments({ user: user._id, active: true }), 0);
});

test('enabled two-factor authentication still requires verification on a trusted browser', async () => {
  const { user, jar } = await fixture({ mfaEnabled: true });
  const result = response(jar);
  await loginUser(request({ emailOrUsername: user.email, password: 'TestPassword123!' }, { ...jar }), result);
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.data.methodSelectionRequired, true);
  assert.equal(result.payload.data.user, undefined);
});

test('passwordless device login cannot bypass enabled two-factor authentication', async () => {
  const { trusted } = await fixture({ mfaEnabled: true });
  const result = response({});
  await loginTrustedDevice(request({ trustedDeviceToken: trusted.token }), result);
  assert.equal(result.statusCode, 401);
  assert.equal(result.payload.data?.user, undefined);
});

test('expired trust requires a new email code', async () => {
  const { user, trusted, jar } = await fixture();
  await TrustedDevice.updateOne({ _id: trusted.device._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const result = response(jar);
  await loginUser(request({ emailOrUsername: user.email, password: 'TestPassword123!' }, { ...jar }), result);
  assert.equal(result.payload.data.otpRequired, true);
});

test('revoking trust in Settings requires a new email code', async () => {
  const { user, trusted, jar } = await fixture();
  const revokeRequest = request({}, {}, { id: String(user._id) });
  revokeRequest.params = { id: String(trusted.device._id) };
  const revoked = response({});
  await revokeTrustedDevice(revokeRequest, revoked);
  assert.equal(revoked.statusCode, 200);
  const result = response(jar);
  await loginUser(request({ emailOrUsername: user.email, password: 'TestPassword123!' }, { ...jar }), result);
  assert.equal(result.payload.data.otpRequired, true);
});

test('signing out all sessions still revokes every trusted device', async () => {
  const { user, session, jar } = await fixture();
  await revokeAllSessions(request({}, { ...jar }, { id: String(user._id), sessionId: session.sessionId }), response(jar));
  assert.equal(await TrustedDevice.countDocuments({ user: user._id }), 0);
  assert.equal(jar.trustedDevice, undefined);
});
