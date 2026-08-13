import crypto from 'crypto';
import axios from 'axios';

const DEFAULT_PHONE_OTP_TTL_MS = 5 * 60 * 1000;
const DEFAULT_PHONE_OTP_MAX_ATTEMPTS = 5;
const DEFAULT_PHONE_OTP_RESEND_COOLDOWN_MS = 60 * 1000;

const phoneOtpStore = new Map();

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const PHONE_OTP_TTL_MS = parsePositiveInt(process.env.PHONE_OTP_TTL_MS, DEFAULT_PHONE_OTP_TTL_MS);
const PHONE_OTP_MAX_ATTEMPTS = parsePositiveInt(
  process.env.PHONE_OTP_MAX_ATTEMPTS,
  DEFAULT_PHONE_OTP_MAX_ATTEMPTS
);
const PHONE_OTP_RESEND_COOLDOWN_MS = parsePositiveInt(
  process.env.PHONE_OTP_RESEND_COOLDOWN_MS,
  DEFAULT_PHONE_OTP_RESEND_COOLDOWN_MS
);
const PHONE_OTP_DEFAULT_COUNTRY_CODE = String(process.env.PHONE_OTP_DEFAULT_COUNTRY_CODE || '+63')
  .trim()
  .replace(/\s+/g, '');

const TWILIO_CONFIG_KEYS = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_PHONE'];

export const getPhoneOtpConfigStatus = (env = process.env) => {
  const requestedProvider = String(env.PHONE_OTP_PROVIDER || '').trim().toLowerCase();
  if (requestedProvider && !['development', 'twilio'].includes(requestedProvider)) {
    return { mode: requestedProvider, valid: false, errors: ['PHONE_OTP_PROVIDER must be development or twilio.'] };
  }
  if (requestedProvider === 'development') {
    if (String(env.NODE_ENV || '').toLowerCase() === 'production') {
      return { mode: 'development', valid: false, errors: ['Development phone OTP cannot be enabled in production.'] };
    }
    return { mode: 'development', valid: true, errors: [] };
  }

  const values = Object.fromEntries(
    TWILIO_CONFIG_KEYS.map((key) => [key, String(env[key] || '').trim()])
  );
  const configuredKeys = TWILIO_CONFIG_KEYS.filter((key) => Boolean(values[key]));

  if (configuredKeys.length === 0 && requestedProvider !== 'twilio') {
    if (String(env.NODE_ENV || '').toLowerCase() === 'production') {
      return {
        mode: 'twilio',
        valid: false,
        errors: [`Missing required Twilio Messaging variables: ${TWILIO_CONFIG_KEYS.join(', ')}.`],
      };
    }
    return { mode: 'development', valid: true, errors: [] };
  }

  const missingKeys = TWILIO_CONFIG_KEYS.filter((key) => !values[key]);
  // Never silently ignore partial provider credentials. Local development can
  // opt into the development provider explicitly with PHONE_OTP_PROVIDER.
  if (configuredKeys.length > 0 && missingKeys.length > 0) {
    return {
      mode: 'twilio',
      valid: false,
      errors: [`Missing required Twilio Messaging variables: ${missingKeys.join(', ')}.`],
    };
  }

  const errors = [];
  if (missingKeys.length > 0) {
    errors.push(`Missing required Twilio Messaging variables: ${missingKeys.join(', ')}.`);
  }
  if (values.TWILIO_ACCOUNT_SID && !/^AC[a-f0-9]{32}$/i.test(values.TWILIO_ACCOUNT_SID)) {
    errors.push('TWILIO_ACCOUNT_SID must be a valid Twilio Account SID beginning with AC.');
  }
  if (values.TWILIO_AUTH_TOKEN && values.TWILIO_AUTH_TOKEN.length < 16) {
    errors.push('TWILIO_AUTH_TOKEN is not in the expected format.');
  }
  if (values.TWILIO_FROM_PHONE && !/^\+[1-9]\d{7,14}$/.test(values.TWILIO_FROM_PHONE)) {
    errors.push('TWILIO_FROM_PHONE must be an E.164 phone number such as +15551234567.');
  }

  return { mode: 'twilio', valid: errors.length === 0, errors };
};

export const validatePhoneOtpConfiguration = (env = process.env) => {
  const status = getPhoneOtpConfigStatus(env);
  if (!status.valid) {
    throw new PhoneOtpError(status.errors.join(' '), 500, { configurationError: true });
  }
  return status;
};

export class PhoneOtpError extends Error {
  constructor(message, statusCode = 400, metadata = {}) {
    super(message);
    this.name = 'PhoneOtpError';
    this.statusCode = statusCode;
    this.metadata = metadata;
  }
}

const hashOtp = (value = '') => crypto.createHash('sha256').update(String(value)).digest('hex');

const safeHashCompare = (left = '', right = '') => {
  const leftBuf = Buffer.from(String(left), 'hex');
  const rightBuf = Buffer.from(String(right), 'hex');
  if (leftBuf.length === 0 || rightBuf.length === 0 || leftBuf.length !== rightBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuf, rightBuf);
};

const normalizeCode = (value = '') => String(value).trim().replace(/\s+/g, '').replace(/-/g, '');

const createOtpCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

const maskPhone = (phone = '') => {
  const cleaned = String(phone).trim();
  if (cleaned.length <= 4) return cleaned;
  return `${cleaned.slice(0, 4)}${'*'.repeat(Math.max(0, cleaned.length - 8))}${cleaned.slice(-4)}`;
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
  if (!digits) {
    throw new PhoneOtpError('Phone number format is invalid.', 400);
  }

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
  if (!defaultDigits) {
    throw new PhoneOtpError('Phone OTP country code configuration is invalid.', 500);
  }

  const normalizedLocal = digits.startsWith('0') ? digits.slice(1) : digits;
  const e164Digits = `${defaultDigits}${normalizedLocal}`;
  if (e164Digits.length < 8 || e164Digits.length > 15) {
    throw new PhoneOtpError('Phone number format is invalid.', 400);
  }
  return `+${e164Digits}`;
};

const sendTwilioSms = async ({ to, body }) => {
  const configuration = getPhoneOtpConfigStatus();
  // If explicitly configured for development, short-circuit and let the caller handle dev fallback
  if (configuration.mode === 'development') return false;

  // If configured for Twilio but configuration is invalid, surface the configuration error
  if (configuration.mode === 'twilio' && !configuration.valid) {
    throw new PhoneOtpError(configuration.errors.join(' '), 500, { configurationError: true });
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_PHONE;

  const payload = new URLSearchParams({
    To: to,
    From: from,
    Body: body,
  });

  try {
    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      payload.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: {
          username: sid,
          password: authToken,
        },
        timeout: 10_000,
      }
    );
    return 'twilio';
  } catch (error) {
    const providerStatus = Number(error?.response?.status) || undefined;
    const providerCode = error?.response?.data?.code || undefined;
    console.error('Twilio phone OTP delivery failed.', {
      status: providerStatus,
      code: providerCode,
    });
    throw new PhoneOtpError(
      providerStatus === 401
        ? 'Phone verification service credentials were rejected.'
        : 'Phone verification service could not deliver the code.',
      502,
      { providerStatus, providerCode }
    );
  }
};

const setOtpRecord = (userId, record) => {
  phoneOtpStore.set(String(userId), record);
};

const getOtpRecord = (userId) => phoneOtpStore.get(String(userId));

export const clearPhoneVerificationOtp = (userId) => {
  phoneOtpStore.delete(String(userId));
};

export const sendPhoneVerificationOtp = async ({ userId, phoneNumber }) => {
  const userKey = String(userId || '').trim();
  if (!userKey) {
    throw new PhoneOtpError('User context is required for phone verification.', 400);
  }
  // Log incoming phone for debugging (masked)
  try {
    console.info('[phoneOtp] sendPhoneVerificationOtp called for user', userKey, 'phone', maskPhone(String(phoneNumber || '')));
  } catch (e) {
    // ignore logging errors
  }

  const phoneE164 = toE164Phone(phoneNumber);
  console.info('[phoneOtp] normalized phone to E.164', maskPhone(phoneE164));
  const now = Date.now();
  const existing = getOtpRecord(userKey);

  if (existing && existing.expiresAt > now) {
    const retryAt = Number(existing.lastSentAt || 0) + PHONE_OTP_RESEND_COOLDOWN_MS;
    if (now < retryAt) {
      const retryAfterSec = Math.max(1, Math.ceil((retryAt - now) / 1000));
      throw new PhoneOtpError('Please wait before requesting another verification code.', 429, {
        retryAfterSec,
      });
    }
  }

  const code = createOtpCode();
  const message = `Your MicroJobs verification code is ${code}. It expires in ${Math.ceil(
    PHONE_OTP_TTL_MS / 60000
  )} minutes.`;

  let provider = await sendTwilioSms({ to: phoneE164, body: message });
  const isProduction = process.env.NODE_ENV === 'production';
  const shouldReturnDevCode =
    !isProduction && String(process.env.PHONE_OTP_EXPOSE_CODE || '').toLowerCase() === 'true';

  if (!provider) {
    if (isProduction) throw new PhoneOtpError('Phone verification service is not configured.', 500);
    provider = 'development';
    console.warn(`Development phone OTP for ${maskPhone(phoneE164)}: ${code}`);
  }

  setOtpRecord(userKey, {
    phoneE164,
    codeHash: hashOtp(code),
    attempts: 0,
    lastSentAt: now,
    expiresAt: now + PHONE_OTP_TTL_MS,
  });

  return {
    message: 'Verification code sent.',
    provider,
    phoneMasked: maskPhone(phoneE164),
    expiresInSec: Math.ceil(PHONE_OTP_TTL_MS / 1000),
    ...(shouldReturnDevCode ? { devCode: code } : {}),
  };
};

export const verifyPhoneVerificationOtp = ({ userId, phoneNumber, code }) => {
  const userKey = String(userId || '').trim();
  if (!userKey) {
    throw new PhoneOtpError('User context is required for phone verification.', 400);
  }

  const normalizedCode = normalizeCode(code);
  if (!/^\d{6}$/.test(normalizedCode)) {
    throw new PhoneOtpError('Verification code must be a 6-digit number.', 400);
  }

  const record = getOtpRecord(userKey);
  if (!record) {
    throw new PhoneOtpError('No verification code found. Request a new code.', 400);
  }

  const now = Date.now();
  if (record.expiresAt <= now) {
    clearPhoneVerificationOtp(userKey);
    throw new PhoneOtpError('Verification code expired. Request a new code.', 400);
  }

  const phoneE164 = toE164Phone(phoneNumber);
  if (record.phoneE164 !== phoneE164) {
    clearPhoneVerificationOtp(userKey);
    throw new PhoneOtpError('Phone number changed. Request a new verification code.', 400);
  }

  if ((record.attempts || 0) >= PHONE_OTP_MAX_ATTEMPTS) {
    clearPhoneVerificationOtp(userKey);
    throw new PhoneOtpError('Too many invalid attempts. Request a new verification code.', 429);
  }

  const incomingHash = hashOtp(normalizedCode);
  if (!safeHashCompare(incomingHash, record.codeHash)) {
    record.attempts = Number(record.attempts || 0) + 1;
    setOtpRecord(userKey, record);
    throw new PhoneOtpError('Invalid verification code.', 400, {
      attemptsRemaining: Math.max(0, PHONE_OTP_MAX_ATTEMPTS - record.attempts),
    });
  }

  clearPhoneVerificationOtp(userKey);
  return { verified: true };
};
