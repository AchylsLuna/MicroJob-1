import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;
let PhoneVerification;
let phoneOtp;

const managedEnvironmentKeys = [
  'NODE_ENV',
  'PHONE_OTP_EXPOSE_CODE',
  'PHONE_OTP_MAX_ATTEMPTS',
  'PHONE_OTP_RESEND_COOLDOWN_MS',
  'PHONE_OTP_TTL_MS',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_VERIFY_SERVICE_SID',
  'TWILIO_FROM_PHONE',
  'TEXTBEE_API_KEY',
  'TEXTBEE_DEVICE_ID',
];
const originalEnvironment = new Map(managedEnvironmentKeys.map((key) => [key, process.env[key]]));

before(async () => {
  process.env.NODE_ENV = 'development';
  process.env.PHONE_OTP_EXPOSE_CODE = 'true';
  process.env.PHONE_OTP_MAX_ATTEMPTS = '2';
  process.env.PHONE_OTP_RESEND_COOLDOWN_MS = '60000';
  process.env.PHONE_OTP_TTL_MS = '300000';
  for (const key of managedEnvironmentKeys.slice(5)) delete process.env[key];

  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'phone-otp-tests' });
  ({ default: PhoneVerification } = await import('../../models/PhoneVerification.js'));
  phoneOtp = await import(`../../lib/phoneOtp.js?phoneOtpTest=${Date.now()}`);
});

beforeEach(async () => mongoose.connection.db.dropDatabase());

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  for (const [key, value] of originalEnvironment) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('phone numbers are normalized to E.164 and invalid numbers are rejected', () => {
  assert.equal(phoneOtp.toE164Phone('0917 123 4567'), '+639171234567');
  assert.equal(phoneOtp.toE164Phone('+63 917 123 4567'), '+639171234567');
  assert.throws(() => phoneOtp.toE164Phone('123'), phoneOtp.PhoneOtpError);
});

test('development phone OTP is hashed, rate limited, attempt limited, and removed after success', async () => {
  const userId = new mongoose.Types.ObjectId();
  const sent = await phoneOtp.sendPhoneVerificationOtp({
    userId,
    phoneNumber: '09171234567',
  });

  assert.equal(sent.provider, 'development');
  assert.match(sent.devCode, /^\d{6}$/);
  const stored = await PhoneVerification.findOne({ user: userId }).select('+codeHash').lean();
  assert.ok(stored.codeHash);
  assert.notEqual(stored.codeHash, sent.devCode);
  const wrongCode = sent.devCode === '000000' ? '000001' : '000000';

  await assert.rejects(
    phoneOtp.sendPhoneVerificationOtp({ userId, phoneNumber: '09171234567' }),
    (error) => error instanceof phoneOtp.PhoneOtpError && error.statusCode === 429,
  );

  await assert.rejects(
    phoneOtp.verifyPhoneVerificationOtp({ userId, phoneNumber: '09171234567', code: wrongCode }),
    (error) => error instanceof phoneOtp.PhoneOtpError && error.metadata.attemptsRemaining === 1,
  );

  const verified = await phoneOtp.verifyPhoneVerificationOtp({
    userId,
    phoneNumber: '09171234567',
    code: sent.devCode,
  });
  assert.deepEqual(verified, { verified: true });
  assert.equal(await PhoneVerification.exists({ user: userId }), null);
});

test('expired and attempt-limited phone OTP records are invalidated', async () => {
  const expiredUserId = new mongoose.Types.ObjectId();
  const expired = await phoneOtp.sendPhoneVerificationOtp({
    userId: expiredUserId,
    phoneNumber: '09171234567',
  });
  await PhoneVerification.updateOne(
    { user: expiredUserId },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  await assert.rejects(
    phoneOtp.verifyPhoneVerificationOtp({
      userId: expiredUserId,
      phoneNumber: '09171234567',
      code: expired.devCode,
    }),
    /expired/i,
  );
  assert.equal(await PhoneVerification.exists({ user: expiredUserId }), null);

  const limitedUserId = new mongoose.Types.ObjectId();
  const limited = await phoneOtp.sendPhoneVerificationOtp({
    userId: limitedUserId,
    phoneNumber: '09171234567',
  });
  const wrongCode = limited.devCode === '000000' ? '000001' : '000000';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await assert.rejects(
      phoneOtp.verifyPhoneVerificationOtp({
        userId: limitedUserId,
        phoneNumber: '09171234567',
        code: wrongCode,
      }),
      /Invalid verification code/i,
    );
  }
  await assert.rejects(
    phoneOtp.verifyPhoneVerificationOtp({
      userId: limitedUserId,
      phoneNumber: '09171234567',
      code: wrongCode,
    }),
    (error) => error instanceof phoneOtp.PhoneOtpError && error.statusCode === 429,
  );
  assert.equal(await PhoneVerification.exists({ user: limitedUserId }), null);
});
