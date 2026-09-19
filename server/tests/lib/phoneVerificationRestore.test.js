import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { generateOtp, verifyOtp } from '../../lib/phone/otpPhone.js';
import { isValidPhoneNumber, toCountryFormat } from '../../lib/phone/phoneUtils.js';

test('restored phone verification utilities generate and validate Philippine SMS codes', () => {
  const otp = generateOtp();
  assert.match(otp, /^\d{6}$/);
  assert.equal(verifyOtp(otp, otp), true);
  assert.equal(verifyOtp(otp, '000000'), otp === '000000');
  assert.equal(isValidPhoneNumber('09171234567'), true);
  assert.equal(toCountryFormat('09171234567'), '639171234567');
});

test('TextBee phone verification routes are available without the removed provider', () => {
  const routes = readFileSync(new URL('../../routes/index.js', import.meta.url), 'utf8');
  const sender = readFileSync(new URL('../../lib/phone/sms.js', import.meta.url), 'utf8');

  assert.match(routes, /PhoneRoute/);
  assert.match(routes, /\/api\/verify-phone/);
  assert.match(sender, /api\.textbee\.dev/);
  assert.doesNotMatch(sender, /twilio/i);
  assert.equal(existsSync(new URL('../../models/PhoneVerification.js', import.meta.url)), true);
});
