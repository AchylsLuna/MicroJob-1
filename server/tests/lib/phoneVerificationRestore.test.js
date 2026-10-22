import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { generateOtp, verifyOtp } from '../../lib/phone/otpPhone.js';
import { isValidPhoneNumber, toCountryFormat } from '../../lib/phone/phoneUtils.js';
import { sendSMS, SmsProviderError } from '../../lib/phone/sms.js';

test('restored phone verification utilities generate and validate Philippine SMS codes', () => {
  const otp = generateOtp();
  assert.match(otp, /^\d{6}$/);
  assert.equal(verifyOtp(otp, otp), true);
  assert.equal(verifyOtp(otp, '000000'), otp === '000000');
  assert.equal(isValidPhoneNumber('09171234567'), true);
  assert.equal(isValidPhoneNumber('+639171234567'), true);
  assert.equal(toCountryFormat('09171234567'), '+639171234567');
  assert.equal(toCountryFormat('+639171234567'), '+639171234567');
});

test('Textbee sender uses E.164 recipients and the documented optional deviceId field', async (t) => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.TEXTBEE_API_KEY;
  const originalDeviceId = process.env.TEXTBEE_DEVICE_ID;
  let request;

  t.after(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.TEXTBEE_API_KEY;
    else process.env.TEXTBEE_API_KEY = originalApiKey;
    if (originalDeviceId === undefined) delete process.env.TEXTBEE_DEVICE_ID;
    else process.env.TEXTBEE_DEVICE_ID = originalDeviceId;
  });

  process.env.TEXTBEE_API_KEY = 'test-key';
  process.env.TEXTBEE_DEVICE_ID = 'device-123';
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, text: async () => JSON.stringify({ data: { success: true, smsBatchId: 'batch-123' } }) };
  };

  const result = await sendSMS('+639171234567', 'Your code is 123456');

  assert.equal(request.url, 'https://api.textbee.dev/api/v1/gateway/send-sms');
  assert.equal(request.options.headers['x-api-key'], 'test-key');
  assert.deepEqual(JSON.parse(request.options.body), {
    recipients: ['+639171234567'],
    message: 'Your code is 123456',
    deviceId: 'device-123',
  });
  assert.equal(result.smsBatchId, 'batch-123');
});

test('Textbee sender classifies provider failures without exposing provider details to callers', async (t) => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.TEXTBEE_API_KEY;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.TEXTBEE_API_KEY;
    else process.env.TEXTBEE_API_KEY = originalApiKey;
  });

  process.env.TEXTBEE_API_KEY = 'test-key';
  global.fetch = async () => ({
    ok: false,
    status: 401,
    text: async () => JSON.stringify({ message: 'sensitive provider response' }),
  });

  await assert.rejects(
    sendSMS('+639171234567', 'Your code is 123456'),
    (error) => {
      assert.ok(error instanceof SmsProviderError);
      assert.equal(error.status, 503);
      assert.equal(error.code, 'provider_authentication_failed');
      assert.doesNotMatch(error.message, /sensitive provider response/);
      return true;
    },
  );
});

test('Textbee sender reports rate limiting distinctly', async (t) => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.TEXTBEE_API_KEY;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.TEXTBEE_API_KEY;
    else process.env.TEXTBEE_API_KEY = originalApiKey;
  });

  process.env.TEXTBEE_API_KEY = 'test-key';
  global.fetch = async () => ({
    ok: false,
    status: 429,
    text: async () => JSON.stringify({ message: 'rate limited' }),
  });

  await assert.rejects(
    sendSMS('+639171234567', 'Your code is 123456'),
    (error) => error instanceof SmsProviderError
      && error.status === 429
      && error.code === 'provider_rate_limited',
  );
});

test('TextBee phone verification routes are available without the removed provider', () => {
  const authRoutes = readFileSync(new URL('../../routes/authRoutes.js', import.meta.url), 'utf8');
  const sender = readFileSync(new URL('../../lib/phone/sms.js', import.meta.url), 'utf8');

  // The surviving phone-verification pair, which is what both clients call.
  assert.match(authRoutes, /\/verification\/phone'/);
  assert.match(authRoutes, /\/verification\/phone\/confirm'/);
  // Both must stay rate limited. The identical handlers were also mounted at
  // /api/verify-phone with no limiter at all, which made confirm an unlimited
  // brute force against a 6-digit code (PhoneVerification has no attempt
  // counter) and send an unlimited trigger for paid Textbee SMS.
  assert.match(authRoutes, /verificationPhoneSendLimiter/);
  assert.match(authRoutes, /verificationPhoneConfirmLimiter/);
  assert.match(sender, /api\.textbee\.dev/);
  assert.doesNotMatch(sender, /twilio/i);
  assert.equal(existsSync(new URL('../../models/PhoneVerification.js', import.meta.url)), true);
});

test('the unrated /api/verify-phone duplicate stays deleted', () => {
  const routes = readFileSync(new URL('../../routes/index.js', import.meta.url), 'utf8');
  assert.doesNotMatch(routes, /verify-phone/, 'the unlimited-attempt duplicate mount must not come back');
  assert.equal(existsSync(new URL('../../routes/PhoneRoute.js', import.meta.url)), false);
  // The controller itself is shared with the rate-limited path above and must
  // survive -- only the duplicate *mount* was the problem.
  assert.equal(existsSync(new URL('../../controllers/PhoneVerificationController.js', import.meta.url)), true);
});
