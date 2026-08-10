import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PhoneOtpError,
  getPhoneOtpConfigStatus,
  toE164Phone,
  validatePhoneOtpConfiguration,
} from '../../lib/phoneOtp.js';

test('phone OTP configuration uses development mode only when no Twilio values exist', () => {
  assert.deepEqual(getPhoneOtpConfigStatus({}), {
    mode: 'development',
    valid: true,
    errors: [],
  });
});

test('explicit development provider ignores partial local Twilio values outside production', () => {
  assert.deepEqual(getPhoneOtpConfigStatus({
    NODE_ENV: 'development',
    PHONE_OTP_PROVIDER: 'development',
    TWILIO_ACCOUNT_SID: 'stale-local-value',
  }), {
    mode: 'development',
    valid: true,
    errors: [],
  });
});

test('development phone OTP provider is rejected in production', () => {
  const status = getPhoneOtpConfigStatus({
    NODE_ENV: 'production',
    PHONE_OTP_PROVIDER: 'development',
  });
  assert.equal(status.valid, false);
  assert.match(status.errors[0], /cannot be enabled in production/i);
});

test('production phone OTP rejects an empty provider configuration', () => {
  const status = getPhoneOtpConfigStatus({ NODE_ENV: 'production' });
  assert.equal(status.mode, 'twilio');
  assert.equal(status.valid, false);
  assert.match(status.errors[0], /TWILIO_ACCOUNT_SID/);
});

test('phone OTP configuration rejects partial Twilio Messaging credentials', () => {
  const env = {
    TWILIO_ACCOUNT_SID: `AC${'a'.repeat(32)}`,
    TWILIO_AUTH_TOKEN: 'valid-looking-auth-token',
  };

  assert.throws(
    () => validatePhoneOtpConfiguration(env),
    (error) => error instanceof PhoneOtpError && /TWILIO_FROM_PHONE/.test(error.message)
  );
});

test('phone OTP configuration validates SID and E.164 sender formats', () => {
  const status = getPhoneOtpConfigStatus({
    TWILIO_ACCOUNT_SID: 'invalid-sid',
    TWILIO_AUTH_TOKEN: 'short',
    TWILIO_FROM_PHONE: '09171234567',
  });

  assert.equal(status.valid, false);
  assert.equal(status.errors.length, 3);
});

test('phone OTP configuration accepts a complete Messaging API setup', () => {
  const status = validatePhoneOtpConfiguration({
    TWILIO_ACCOUNT_SID: `AC${'1'.repeat(32)}`,
    TWILIO_AUTH_TOKEN: 'a'.repeat(32),
    TWILIO_FROM_PHONE: '+15551234567',
  });

  assert.equal(status.mode, 'twilio');
  assert.equal(status.valid, true);
});

test('Philippine local mobile numbers normalize to E.164', () => {
  assert.equal(toE164Phone('0917 123 4567'), '+639171234567');
});

const withOtpEnvironment = async (overrides, callback) => {
  const keys = ['NODE_ENV', 'PHONE_OTP_PROVIDER', 'PHONE_OTP_EXPOSE_CODE', 'PHONE_OTP_TTL_MS', 'PHONE_OTP_RESEND_COOLDOWN_MS'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    NODE_ENV: 'development',
    PHONE_OTP_PROVIDER: 'development',
    PHONE_OTP_EXPOSE_CODE: 'true',
    ...overrides,
  });
  try {
    const module = await import(`../../lib/phoneOtp.js?test=${Date.now()}-${Math.random()}`);
    await callback(module);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
};

test('development OTP sends, verifies once, and enforces resend cooldown', async () => {
  await withOtpEnvironment({}, async ({ sendPhoneVerificationOtp, verifyPhoneVerificationOtp }) => {
    const result = await sendPhoneVerificationOtp({ userId: 'otp-success', phoneNumber: '09171234567' });
    assert.equal(result.provider, 'development');
    assert.match(result.devCode, /^\d{6}$/);
    assert.throws(
      () => verifyPhoneVerificationOtp({ userId: 'otp-success', phoneNumber: '09171234567', code: '000000' }),
      /Invalid verification code/
    );
    assert.deepEqual(
      verifyPhoneVerificationOtp({ userId: 'otp-success', phoneNumber: '09171234567', code: result.devCode }),
      { verified: true }
    );
    await assert.rejects(
      sendPhoneVerificationOtp({ userId: 'otp-cooldown', phoneNumber: '09171234567' }).then(() =>
        sendPhoneVerificationOtp({ userId: 'otp-cooldown', phoneNumber: '09171234567' })
      ),
      (error) => error.statusCode === 429 && error.metadata.retryAfterSec > 0
    );
  });
});

test('OTP expires and changing the phone invalidates the pending code', async () => {
  await withOtpEnvironment({ PHONE_OTP_TTL_MS: '1' }, async ({ sendPhoneVerificationOtp, verifyPhoneVerificationOtp }) => {
    const expired = await sendPhoneVerificationOtp({ userId: 'otp-expired', phoneNumber: '09171234567' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.throws(
      () => verifyPhoneVerificationOtp({ userId: 'otp-expired', phoneNumber: '09171234567', code: expired.devCode }),
      /expired/i
    );
  });

  await withOtpEnvironment({}, async ({ sendPhoneVerificationOtp, verifyPhoneVerificationOtp }) => {
    const changed = await sendPhoneVerificationOtp({ userId: 'otp-changed', phoneNumber: '09171234567' });
    assert.throws(
      () => verifyPhoneVerificationOtp({ userId: 'otp-changed', phoneNumber: '09181234567', code: changed.devCode }),
      /Phone number changed/i
    );
    assert.throws(
      () => verifyPhoneVerificationOtp({ userId: 'otp-changed', phoneNumber: '09171234567', code: changed.devCode }),
      /No verification code found/i
    );
  });
});

test('OTP locks after the maximum invalid attempts', async () => {
  await withOtpEnvironment({}, async ({ sendPhoneVerificationOtp, verifyPhoneVerificationOtp }) => {
    const result = await sendPhoneVerificationOtp({ userId: 'otp-attempts', phoneNumber: '09171234567' });
    const wrongCode = result.devCode === '000000' ? '000001' : '000000';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.throws(
        () => verifyPhoneVerificationOtp({ userId: 'otp-attempts', phoneNumber: '09171234567', code: wrongCode }),
        /Invalid verification code/
      );
    }
    assert.throws(
      () => verifyPhoneVerificationOtp({ userId: 'otp-attempts', phoneNumber: '09171234567', code: result.devCode }),
      (error) => error.statusCode === 429 && /Too many invalid attempts/.test(error.message)
    );
  });
});
