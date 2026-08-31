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
  assert.equal(res.payload.data.user.email, 'real@example.ph');
});
