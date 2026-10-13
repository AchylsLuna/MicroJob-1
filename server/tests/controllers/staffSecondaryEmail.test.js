import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import OtpChallenge from '../../models/OtpChallenge.js';
import { getSecondaryEmail, requestSecondaryEmailOtp, confirmSecondaryEmailOtp } from '../../controllers/StaffSecondaryEmailController.js';
import { requestPasswordChangeOtp, changePasswordWithOtp, updateProfile } from '../../controllers/UserController.js';
import { getTestOtpCode, issueOtpChallenge } from '../../lib/otpChallenges.js';
import { staffPasswordChangeSubject } from '../../lib/staffSecurity.js';
import requireAdmin from '../../middleware/admin.js';

let mongo;
let sent;
const originalFetch = globalThis.fetch;
const env = { NODE_ENV: process.env.NODE_ENV, RESEND_API_KEY: process.env.RESEND_API_KEY };
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
  await Promise.all([User.deleteMany({}), OtpChallenge.deleteMany({}), Session.deleteMany({})]);
});
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } });
const request = (user, body = {}) => ({ user: { id: user._id, role: user.role }, body });
const call = async (fn, user, body) => { const res = response(); await fn(request(user, body), res); return res; };
const makeUser = async (role = 'admin', staffRole = null, extra = {}) => {
  const user = new User({ firstName: 'Staff', lastName: 'Test', email: `${new mongoose.Types.ObjectId()}@example.com`, role, staffRole, status: 'active', ...extra });
  await user.setPassword('CurrentPass1!');
  return user.save();
};
const enroll = async (user, email = 'secondary@example.com') => {
  const sentRes = await call(requestSecondaryEmailOtp, user, { email, currentPassword: 'CurrentPass1!' });
  assert.equal(sentRes.statusCode, 200);
  assert.equal(sentRes.payload.code, undefined);
  const code = getTestOtpCode('secondary-email-verification', `staff-secondary-email:${user._id}`);
  const res = await call(confirmSecondaryEmailOtp, user, { email, code });
  assert.equal(res.statusCode, 200);
  return { email, code, res };
};

for (const [role, staffRole] of [['superadmin', null], ['admin', null], ...['admin_team', 'moderator', 'support_staff', 'analytics_team', 'finance_team'].map((r) => ['admin', r])]) {
  test(`${role}/${staffRole}: verify secondary email and send password OTP only there`, async () => {
    const user = await makeUser(role, staffRole);
    const enrollment = await enroll(user);
    assert.deepEqual(enrollment.res.payload, { email: enrollment.email, verified: true, message: 'Secondary email verified.' });
    assert.deepEqual((await call(getSecondaryEmail, user)).payload, { email: enrollment.email, verified: true });
    assert.equal((await User.findById(user._id).lean()).secondaryEmail, undefined);
    assert.equal((await User.findById(user._id).lean()).secondaryEmailVerifiedAt, undefined);
    const [current, other] = await Session.create([{ user: user._id }, { user: user._id }]);
    const send = await call(requestPasswordChangeOtp, user, { currentPassword: 'CurrentPass1!' });
    assert.equal(send.statusCode, 200);
    assert.equal(send.payload.code, undefined);
    assert.deepEqual(sent.map((mail) => mail.to), [[enrollment.email], [enrollment.email]]);
    const changeCode = sent[1].text.match(/\b\d{6}\b/)[0];
    const res = response();
    await changePasswordWithOtp({ ...request(user, { currentPassword: 'CurrentPass1!', newPassword: 'UpdatedPass2!', code: changeCode }), user: { id: user._id, sessionId: current._id } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(await (await User.findById(user._id).select('+passwordHashed')).validatePassword('UpdatedPass2!'), true);
    assert.equal((await Session.findById(current._id)).active, true);
    assert.equal((await Session.findById(other._id)).active, false);
    assert.equal((await call(changePasswordWithOtp, user, { currentPassword: 'UpdatedPass2!', newPassword: 'AnotherPass3!', code: changeCode })).statusCode, 400);
  });
}

test('staff without a verified secondary email cannot request or confirm password changes', async () => {
  for (const extra of [{}, { secondaryEmail: 'pending@example.com' }]) {
    const user = await makeUser('admin', null, extra);
    assert.equal((await call(requestPasswordChangeOtp, user, { currentPassword: 'CurrentPass1!' })).statusCode, 409);
    assert.equal((await call(changePasswordWithOtp, user, { currentPassword: 'CurrentPass1!', newPassword: 'UpdatedPass2!', code: '123456' })).statusCode, 409);
  }
  assert.equal(sent.length, 0);
});

test('invalid email, sign-in email and wrong password cannot enroll', async () => {
  const user = await makeUser();
  for (const email of ['invalid', user.email, ` ${user.email.toUpperCase()} `]) {
    assert.equal((await call(requestSecondaryEmailOtp, user, { email, currentPassword: 'CurrentPass1!' })).statusCode, 400);
  }
  assert.equal((await call(requestSecondaryEmailOtp, user, { email: 'other@example.com', currentPassword: 'wrong' })).statusCode, 401);
  assert.equal(sent.length, 0);
});

test('resend invalidates old code; verification binds the candidate to the account', async () => {
  const user = await makeUser();
  const other = await makeUser();
  const first = await issueOtpChallenge({ purpose: 'secondary-email-verification', subject: `staff-secondary-email:${user._id}`, user: user._id, metadata: { email: 'old@example.com' } });
  await call(requestSecondaryEmailOtp, user, { email: ' NEW@EXAMPLE.COM ', currentPassword: 'CurrentPass1!' });
  const code = getTestOtpCode('secondary-email-verification', `staff-secondary-email:${user._id}`);
  assert.equal((await OtpChallenge.findById(first.challenge._id)).active, false);
  assert.equal((await call(confirmSecondaryEmailOtp, other, { email: 'new@example.com', code })).statusCode, 400);
  assert.equal((await call(confirmSecondaryEmailOtp, user, { email: 'different@example.com', code })).statusCode, 400);
  assert.equal((await call(getSecondaryEmail, user)).payload.verified, false);
});

test('expired codes and five wrong attempts never verify or allow replay', async () => {
  const user = await makeUser();
  await call(requestSecondaryEmailOtp, user, { email: 'secondary@example.com', currentPassword: 'CurrentPass1!' });
  const subject = `staff-secondary-email:${user._id}`;
  const code = getTestOtpCode('secondary-email-verification', subject);
  const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) assert.ok((await call(confirmSecondaryEmailOtp, user, { email: 'secondary@example.com', code: wrong })).statusCode >= 400);
  assert.equal((await call(confirmSecondaryEmailOtp, user, { email: 'secondary@example.com', code })).statusCode, 400);
  const issued = await issueOtpChallenge({ purpose: 'secondary-email-verification', subject, user: user._id, ttlMs: -1 });
  assert.equal((await call(confirmSecondaryEmailOtp, user, { email: 'secondary@example.com', code: issued.code })).statusCode, 400);
});

test('replacement retains old verified email until success, then invalidates password OTPs', async () => {
  const user = await makeUser();
  await enroll(user, 'old@example.com');
  await call(requestPasswordChangeOtp, user, { currentPassword: 'CurrentPass1!' });
  const code = sent.at(-1).text.match(/\b\d{6}\b/)[0];
  await call(requestSecondaryEmailOtp, user, { email: 'new@example.com', currentPassword: 'CurrentPass1!' });
  assert.equal((await call(getSecondaryEmail, user)).payload.email, 'old@example.com');
  await call(confirmSecondaryEmailOtp, user, { email: 'new@example.com', code: getTestOtpCode('secondary-email-verification', `staff-secondary-email:${user._id}`) });
  assert.equal((await OtpChallenge.findOne({ subject: staffPasswordChangeSubject(user), purpose: 'password-change', active: true })), null);
  assert.equal((await call(changePasswordWithOtp, user, { currentPassword: 'CurrentPass1!', newPassword: 'UpdatedPass2!', code })).statusCode, 400);
});

test('worker, employer and dual-role users have no secondary email API access and retain primary password OTPs', async () => {
  for (const role of ['work', 'hire', 'both']) {
    const user = await makeUser(role);
    let passed = false;
    const gated = response();
    requireAdmin(request(user), gated, () => { passed = true; });
    assert.equal(passed, false);
    assert.equal(gated.statusCode, 403);
    for (const controller of [getSecondaryEmail, requestSecondaryEmailOtp, confirmSecondaryEmailOtp]) {
      assert.equal((await call(controller, user, { email: 'secondary@example.com', currentPassword: 'CurrentPass1!', code: '123456' })).statusCode, 403);
    }
    assert.equal((await call(requestPasswordChangeOtp, user, { currentPassword: 'CurrentPass1!' })).statusCode, 200);
    assert.deepEqual(sent.at(-1).to, [user.email]);
    const code = sent.at(-1).text.match(/\b\d{6}\b/)[0];
    assert.equal((await call(changePasswordWithOtp, user, { currentPassword: 'CurrentPass1!', newPassword: 'UpdatedPass2!', code })).statusCode, 200);
  }
});

test('generic profile edits cannot self-verify or replace a secondary email', async () => {
  const user = await makeUser();
  const req = request(user, { secondaryEmail: 'injected@example.com', secondaryEmailVerifiedAt: new Date().toISOString() });
  const res = response();
  await updateProfile(req, res);
  const stored = await User.findById(user._id).select('+secondaryEmail +secondaryEmailVerifiedAt');
  assert.equal(stored.secondaryEmail, null);
  assert.equal(stored.secondaryEmailVerifiedAt, null);
});

test('email delivery failure invalidates enrollment without saving the address', async () => {
  const user = await makeUser();
  const mockFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error('test mail outage'); };
    assert.equal((await call(requestSecondaryEmailOtp, user, { email: 'secondary@example.com', currentPassword: 'CurrentPass1!' })).statusCode, 500);
    assert.equal(await OtpChallenge.countDocuments({ user: user._id, active: true }), 0);
    assert.equal((await call(getSecondaryEmail, user)).payload.verified, false);
  } finally { globalThis.fetch = mockFetch; }
});

test('secondary email OTP is single-use under concurrent confirmations', async () => {
  const user = await makeUser();
  const email = 'secondary@example.com';
  await call(requestSecondaryEmailOtp, user, { email, currentPassword: 'CurrentPass1!' });
  const code = getTestOtpCode('secondary-email-verification', `staff-secondary-email:${user._id}`);
  const responses = await Promise.all([call(confirmSecondaryEmailOtp, user, { email, code }), call(confirmSecondaryEmailOtp, user, { email, code })]);
  assert.deepEqual(responses.map((res) => res.statusCode).sort(), [200, 400]);
  assert.equal((await call(confirmSecondaryEmailOtp, user, { email, code })).statusCode, 400);
});

test('a shared secondary mailbox cannot mix password challenges between staff accounts', async () => {
  const first = await makeUser();
  const second = await makeUser();
  await enroll(first);
  await enroll(second);
  await call(requestPasswordChangeOtp, first, { currentPassword: 'CurrentPass1!' });
  const firstChallenge = await OtpChallenge.findOne({ subject: staffPasswordChangeSubject(first), active: true });
  await call(requestPasswordChangeOtp, second, { currentPassword: 'CurrentPass1!' });
  assert.equal((await OtpChallenge.findById(firstChallenge._id)).active, true);
  assert.equal(await OtpChallenge.countDocuments({ purpose: 'password-change', active: true }), 2);
});

test('staff enrollment and password changes fail closed without mail transport outside tests', async () => {
  const user = await makeUser();
  await enroll(user);
  const keys = ['NODE_ENV', 'RESEND_API_KEY', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const values = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    process.env.NODE_ENV = 'development';
    assert.equal((await call(requestSecondaryEmailOtp, user, { email: 'new@example.com', currentPassword: 'CurrentPass1!' })).statusCode, 503);
    assert.equal((await call(requestPasswordChangeOtp, user, { currentPassword: 'CurrentPass1!' })).statusCode, 503);
    assert.equal(await OtpChallenge.countDocuments({ user: user._id, active: true }), 0);
  } finally {
    for (const [key, value] of Object.entries(values)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
