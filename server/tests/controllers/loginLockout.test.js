import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import User from '../../models/User.js';
import { loginUser } from '../../controllers/AuthController.js';
import { MAX_FAILED_ATTEMPTS, LOCK_DURATIONS_MS } from '../../lib/loginLockout.js';

/**
 * Failed-login lockout, exercised through the real controller.
 *
 * Rate limiting alone left credential stuffing open: express-rate-limit keys
 * partly on IP, so an attacker spread across many addresses got a fresh
 * allowance per address. These counters live on the account, so they hold no
 * matter where the attempt arrives from.
 */

const PASSWORD = 'CorrectHorse1!';
const EMAIL = 'locked@example.ph';

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'login-lockout-tests' });
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  const user = new User({
    firstName: 'Locked',
    lastName: 'User',
    email: EMAIL,
    status: 'active',
  });
  await user.setPassword(PASSWORD);
  await user.save();
});

const response = () => ({
  statusCode: 200,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
  cookie() { return this; },
  clearCookie() { return this; },
  set() { return this; },
});

const attempt = async (password, emailOrUsername = EMAIL) => {
  const res = response();
  await loginUser(
    { body: { emailOrUsername, password }, ip: '127.0.0.1', get: () => 'test', headers: {} },
    res
  );
  return res;
};

/** Reads the lockout counters, which are `select: false` by design. */
const lockState = async () => User.findOne({ email: EMAIL })
  .select('+failedLoginAttempts +loginLockCount +lockUntil')
  .lean();

test('a correct password signs in and leaves no lock behind', async () => {
  const res = await attempt(PASSWORD);
  assert.equal(res.statusCode, 200);

  const state = await lockState();
  assert.equal(state.failedLoginAttempts, 0);
  assert.equal(state.lockUntil, null);
});

test('failed attempts accumulate on the account', async () => {
  await attempt('WrongPassword1!');
  await attempt('WrongPassword2!');

  const state = await lockState();
  assert.equal(state.failedLoginAttempts, 2);
  assert.equal(state.lockUntil, null);
});

test('the threshold locks the account and resets the attempt counter', async () => {
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
    await attempt(`WrongPassword${i}!`);
  }

  const state = await lockState();
  assert.equal(state.loginLockCount, 1);
  assert.ok(state.lockUntil instanceof Date);
  assert.ok(state.lockUntil.getTime() > Date.now());
  // Counter resets so the next lock needs a fresh run of failures.
  assert.equal(state.failedLoginAttempts, 0);
});

/** The point of the whole feature: guessing stops even if the guess is right. */
test('a locked account is refused even with the correct password', async () => {
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
    await attempt(`WrongPassword${i}!`);
  }

  const res = await attempt(PASSWORD);
  assert.equal(res.statusCode, 401);
});

test('the lock lifts on its own once it expires', async () => {
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
    await attempt(`WrongPassword${i}!`);
  }
  assert.equal((await attempt(PASSWORD)).statusCode, 401);

  // Wind the clock past the lock rather than waiting fifteen real minutes.
  await User.updateOne({ email: EMAIL }, { $set: { lockUntil: new Date(Date.now() - 1000) } });

  assert.equal((await attempt(PASSWORD)).statusCode, 200);
});

test('a successful sign-in clears the escalation history', async () => {
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
    await attempt(`WrongPassword${i}!`);
  }
  await User.updateOne({ email: EMAIL }, { $set: { lockUntil: new Date(Date.now() - 1000) } });
  await attempt(PASSWORD);

  const state = await lockState();
  assert.equal(state.failedLoginAttempts, 0);
  assert.equal(state.loginLockCount, 0);
  assert.equal(state.lockUntil, null);
});

test('repeated lockouts escalate the lock duration', async () => {
  const lockOnce = async () => {
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
      await attempt(`WrongPassword${i}!`);
    }
    const state = await lockState();
    const duration = state.lockUntil.getTime() - Date.now();
    // Expire it so the next run of failures can apply the following step.
    await User.updateOne({ email: EMAIL }, { $set: { lockUntil: new Date(Date.now() - 1000) } });
    return duration;
  };

  const first = await lockOnce();
  const second = await lockOnce();

  assert.ok(first <= LOCK_DURATIONS_MS[0] && first > LOCK_DURATIONS_MS[0] - 60_000);
  assert.ok(second <= LOCK_DURATIONS_MS[1] && second > LOCK_DURATIONS_MS[1] - 60_000);
  assert.ok(second > first, 'the second lock must last longer than the first');
});

/**
 * A lock on one account must not spill onto another -- otherwise an attacker
 * could deny service to any user they can name by failing against someone else.
 */
test('locking one account leaves other accounts signable', async () => {
  const other = new User({
    firstName: 'Other',
    lastName: 'User',
    email: 'other@example.ph',
    status: 'active',
  });
  await other.setPassword(PASSWORD);
  await other.save();

  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
    await attempt(`WrongPassword${i}!`);
  }

  assert.equal((await attempt(PASSWORD)).statusCode, 401);
  assert.equal((await attempt(PASSWORD, 'other@example.ph')).statusCode, 200);
});

/**
 * The lockout must not become the enumeration oracle that loginEnumeration.js
 * exists to prevent: a distinct "your account is locked" reply would confirm
 * the address is registered.
 */
test('a locked account is indistinguishable from a wrong password', async () => {
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
    await attempt(`WrongPassword${i}!`);
  }

  const locked = await attempt(PASSWORD);
  const unknownAccount = await attempt('AnyPassword1!', 'nobody@example.ph');

  assert.equal(locked.statusCode, unknownAccount.statusCode);
  assert.deepEqual(locked.payload, unknownAccount.payload);
});

test('the lockout counters never leak into an API response', async () => {
  await attempt('WrongPassword1!');
  const res = await attempt(PASSWORD);

  const serialized = JSON.stringify(res.payload);
  assert.ok(!serialized.includes('failedLoginAttempts'));
  assert.ok(!serialized.includes('loginLockCount'));
  assert.ok(!serialized.includes('lockUntil'));
});
