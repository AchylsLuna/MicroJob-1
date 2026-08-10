import crypto from 'crypto';
import axios from 'axios';
import PhoneVerification from '../models/PhoneVerification.js';
import { sendSMS as sendTextBeeSms } from './phone/sms.js';

const DEFAULT_PHONE_OTP_TTL_MS = 5 * 60 * 1000;
const DEFAULT_PHONE_OTP_MAX_ATTEMPTS = 5;
const DEFAULT_PHONE_OTP_RESEND_COOLDOWN_MS = 60 * 1000;

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const PHONE_OTP_TTL_MS = parsePositiveInt(process.env.PHONE_OTP_TTL_MS, DEFAULT_PHONE_OTP_TTL_MS);
const PHONE_OTP_MAX_ATTEMPTS = parsePositiveInt(
  process.env.PHONE_OTP_MAX_ATTEMPTS,
  DEFAULT_PHONE_OTP_MAX_ATTEMPTS,
);
const PHONE_OTP_RESEND_COOLDOWN_MS = parsePositiveInt(
  process.env.PHONE_OTP_RESEND_COOLDOWN_MS,
  DEFAULT_PHONE_OTP_RESEND_COOLDOWN_MS,
);
const PHONE_OTP_DEFAULT_COUNTRY_CODE = String(process.env.PHONE_OTP_DEFAULT_COUNTRY_CODE || '+63')
  .trim()
  .replace(/\s+/g, '');

export class PhoneOtpError extends Error {
  constructor(message, statusCode = 400, metadata = {}) {
    super(message);
    this.name = 'PhoneOtpError';
    this.statusCode = statusCode;
    this.metadata = metadata;
  }
}

const hashOtp = (value = '') =>
  crypto.createHash('sha256').update(String(value)).digest('hex');

const safeHashCompare = (left = '', right = '') => {
  const leftBuf = Buffer.from(String(left), 'hex');
  const rightBuf = Buffer.from(String(right), 'hex');
  return leftBuf.length > 0 && leftBuf.length === rightBuf.length && crypto.timingSafeEqual(leftBuf, rightBuf);
};

const normalizeCode = (value = '') => String(value).trim().replace(/\s+/g, '').replace(/-/g, '');
const createOtpCode = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

const maskPhone = (phone = '') => {
  const cleaned = String(phone).trim();
  if (cleaned.length <= 4) return cleaned;
  return `${cleaned.slice(0, 4)}${'*'.repeat(Math.max(0, cleaned.length - 8))}${cleaned.slice(-4)}`;
};

const getTwilioConfig = () => ({
  accountSid: String(process.env.TWILIO_ACCOUNT_SID || '').trim(),
  authToken: String(process.env.TWILIO_AUTH_TOKEN || ''),
  verifyServiceSid: String(process.env.TWILIO_VERIFY_SERVICE_SID || '').trim(),
  fromPhone: String(process.env.TWILIO_FROM_PHONE || '').trim(),
});

const twilioRequest = async (url, payload) => {
  const { accountSid, authToken } = getTwilioConfig();
  try {
    return await axios.post(url, new URLSearchParams(payload).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      auth: { username: accountSid, password: authToken },
      timeout: 10_000,
    });
  } catch (error) {
    console.error('Phone OTP provider error:', {
      provider: 'twilio',
      status: Number(error?.response?.status || 0) || undefined,
      code: String(error?.code || 'UNKNOWN'),
    });
    throw new PhoneOtpError('The SMS provider could not deliver the verification code.', 502);
  }
};

const sendTwilioVerify = async (to) => {
  const { accountSid, authToken, verifyServiceSid } = getTwilioConfig();
  if (!accountSid || !authToken || !verifyServiceSid) return false;
  await twilioRequest(
    `https://verify.twilio.com/v2/Services/${encodeURIComponent(verifyServiceSid)}/Verifications`,
    { To: to, Channel: 'sms' },
  );
  return 'twilio-verify';
};

const checkTwilioVerify = async (to, code) => {
  const { verifyServiceSid } = getTwilioConfig();
  if (!verifyServiceSid) throw new PhoneOtpError('Twilio Verify is not configured.', 500);
  const response = await twilioRequest(
    `https://verify.twilio.com/v2/Services/${encodeURIComponent(verifyServiceSid)}/VerificationCheck`,
    { To: to, Code: code },
  );
  return String(response?.data?.status || '').toLowerCase() === 'approved';
};

const sendTwilioMessage = async (to, body) => {
  const { accountSid, authToken, fromPhone } = getTwilioConfig();
  if (!accountSid || !authToken || !fromPhone) return false;
  await twilioRequest(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    { To: to, From: fromPhone, Body: body },
  );
  return 'twilio-sms';
};

const sendTextBeeMessage = async (to, body) => {
  if (!process.env.TEXTBEE_API_KEY || !process.env.TEXTBEE_DEVICE_ID) return false;
  try {
    await sendTextBeeSms(to, body);
    return 'textbee';
  } catch (error) {
    console.error('Phone OTP provider error:', {
      provider: 'textbee',
      code: String(error?.code || 'UNKNOWN'),
    });
    throw new PhoneOtpError('The SMS provider could not deliver the verification code.', 502);
  }
};

export const toE164Phone = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (raw.startsWith('+')) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) {
      throw new PhoneOtpError('Phone number format is invalid.', 400);
    }
    return `+${digits}`;
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) throw new PhoneOtpError('Phone number format is invalid.', 400);
  if (digits.startsWith('00')) {
    const intlDigits = digits.slice(2);
    if (intlDigits.length < 8 || intlDigits.length > 15) {
      throw new PhoneOtpError('Phone number format is invalid.', 400);
    }
    return `+${intlDigits}`;
  }

  if (!PHONE_OTP_DEFAULT_COUNTRY_CODE.startsWith('+')) {
    throw new PhoneOtpError('Phone OTP country code configuration is invalid.', 500);
  }
  const defaultDigits = PHONE_OTP_DEFAULT_COUNTRY_CODE.replace(/\D/g, '');
  const normalizedLocal = digits.startsWith('0') ? digits.slice(1) : digits;
  const e164Digits = `${defaultDigits}${normalizedLocal}`;
  if (!defaultDigits || e164Digits.length < 8 || e164Digits.length > 15) {
    throw new PhoneOtpError('Phone number format is invalid.', 400);
  }
  return `+${e164Digits}`;
};

export const clearPhoneVerificationOtp = async (userId) => {
  const userKey = String(userId || '').trim();
  if (!userKey) return;
  await PhoneVerification.deleteOne({ user: userKey });
};

export const sendPhoneVerificationOtp = async ({ userId, phoneNumber }) => {
  const userKey = String(userId || '').trim();
  if (!userKey) throw new PhoneOtpError('User context is required for phone verification.', 400);

  const phoneE164 = toE164Phone(phoneNumber);
  const now = Date.now();
  const existing = await PhoneVerification.findOne({ user: userKey });
  if (existing) {
    const retryAt = new Date(existing.lastSentAt).getTime() + PHONE_OTP_RESEND_COOLDOWN_MS;
    if (now < retryAt) {
      const retryAfterSec = Math.max(1, Math.ceil((retryAt - now) / 1000));
      throw new PhoneOtpError('Please wait before requesting another verification code.', 429, {
        retryAfterSec,
      });
    }
  }

  const code = createOtpCode();
  const message = `Your MicroJobs verification code is ${code}. It expires in ${Math.ceil(
    PHONE_OTP_TTL_MS / 60000,
  )} minutes.`;

  let provider = await sendTwilioVerify(phoneE164);
  if (!provider) provider = await sendTwilioMessage(phoneE164, message);
  if (!provider) provider = await sendTextBeeMessage(phoneE164, message);

  const isProduction = process.env.NODE_ENV === 'production';
  const shouldReturnDevCode =
    !isProduction && String(process.env.PHONE_OTP_EXPOSE_CODE || '').toLowerCase() === 'true';
  if (!provider) {
    if (isProduction) throw new PhoneOtpError('SMS provider is not configured.', 500);
    provider = 'development';
    console.warn(`Development phone OTP for ${maskPhone(phoneE164)}: ${code}`);
  }

  await PhoneVerification.findOneAndUpdate(
    { user: userKey },
    {
      $set: {
        user: userKey,
        phoneE164,
        provider,
        codeHash: provider === 'twilio-verify' ? null : hashOtp(code),
        attempts: 0,
        lastSentAt: new Date(now),
        expiresAt: new Date(now + PHONE_OTP_TTL_MS),
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  );

  return {
    message: 'Verification code sent.',
    provider,
    phoneMasked: maskPhone(phoneE164),
    expiresInSec: Math.ceil(PHONE_OTP_TTL_MS / 1000),
    ...(shouldReturnDevCode && provider !== 'twilio-verify' ? { devCode: code } : {}),
  };
};

export const verifyPhoneVerificationOtp = async ({ userId, phoneNumber, code }) => {
  const userKey = String(userId || '').trim();
  if (!userKey) throw new PhoneOtpError('User context is required for phone verification.', 400);

  const normalizedCode = normalizeCode(code);
  if (!/^\d{6}$/.test(normalizedCode)) {
    throw new PhoneOtpError('Verification code must be a 6-digit number.', 400);
  }

  const record = await PhoneVerification.findOne({ user: userKey }).select('+codeHash');
  if (!record) throw new PhoneOtpError('No verification code found. Request a new code.', 400);

  const now = Date.now();
  if (new Date(record.expiresAt).getTime() <= now) {
    await clearPhoneVerificationOtp(userKey);
    throw new PhoneOtpError('Verification code expired. Request a new code.', 400);
  }

  const phoneE164 = toE164Phone(phoneNumber);
  if (record.phoneE164 !== phoneE164) {
    await clearPhoneVerificationOtp(userKey);
    throw new PhoneOtpError('Phone number changed. Request a new verification code.', 400);
  }
  if ((record.attempts || 0) >= PHONE_OTP_MAX_ATTEMPTS) {
    await clearPhoneVerificationOtp(userKey);
    throw new PhoneOtpError('Too many invalid attempts. Request a new verification code.', 429);
  }

  const valid = record.provider === 'twilio-verify'
    ? await checkTwilioVerify(phoneE164, normalizedCode)
    : safeHashCompare(hashOtp(normalizedCode), record.codeHash);
  if (!valid) {
    record.attempts = Number(record.attempts || 0) + 1;
    await record.save();
    throw new PhoneOtpError('Invalid verification code.', 400, {
      attemptsRemaining: Math.max(0, PHONE_OTP_MAX_ATTEMPTS - record.attempts),
    });
  }

  await clearPhoneVerificationOtp(userKey);
  return { verified: true };
};
