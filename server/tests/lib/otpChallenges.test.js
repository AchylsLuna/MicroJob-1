import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import OtpChallenge from '../../models/OtpChallenge.js';
import { issueOtpChallenge, verifyOtpChallenge } from '../../lib/otpChallenges.js';

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'otp-challenge-tests' });
  await OtpChallenge.init();
});

beforeEach(() => OtpChallenge.deleteMany({}));

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test('OTP challenges store only a hash and consume exactly once', async () => {
  const { challenge, code } = await issueOtpChallenge({ purpose: 'password-reset', subject: 'USER@EXAMPLE.COM' });
  const stored = await OtpChallenge.findById(challenge._id).select('+codeHash').lean();
  assert.notEqual(stored.codeHash, code);
  assert.equal(stored.subject, 'user@example.com');

  const [first, replay] = await Promise.all([
    verifyOtpChallenge({ purpose: 'password-reset', subject: 'user@example.com', code, consume: true }),
    verifyOtpChallenge({ purpose: 'password-reset', subject: 'user@example.com', code, consume: true }),
  ]);
  assert.equal([first.ok, replay.ok].filter(Boolean).length, 1);
});

test('resending invalidates the prior challenge across readers', async () => {
  const first = await issueOtpChallenge({ purpose: 'email-verification', subject: 'person@example.com' });
  const second = await issueOtpChallenge({ purpose: 'email-verification', subject: 'person@example.com' });

  const oldResult = await verifyOtpChallenge({ purpose: 'email-verification', challengeId: first.challenge.challengeId, code: first.code, consume: true });
  const newResult = await verifyOtpChallenge({ purpose: 'email-verification', challengeId: second.challenge.challengeId, code: second.code, consume: true });
  assert.equal(oldResult.ok, false);
  assert.equal(newResult.ok, true);
});

test('invalid OTP attempts lock the challenge', async () => {
  const issued = await issueOtpChallenge({ purpose: 'login', subject: 'user-id', maxAttempts: 2 });
  assert.equal((await verifyOtpChallenge({ purpose: 'login', challengeId: issued.challenge.challengeId, code: '111111' })).ok, false);
  const locked = await verifyOtpChallenge({ purpose: 'login', challengeId: issued.challenge.challengeId, code: '222222' });
  assert.equal(locked.ok, false);
  assert.equal(locked.reason, 'attempts');
  const correctAfterLock = await verifyOtpChallenge({ purpose: 'login', challengeId: issued.challenge.challengeId, code: issued.code });
  assert.equal(correctAfterLock.ok, false);
});
