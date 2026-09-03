import rateLimit, * as rateLimitModule from 'express-rate-limit';

const ipKeyGenerator = rateLimitModule.ipKeyGenerator || ((value) => String(value || 'unknown'));

export const buildAuthRateLimitKey = (req) => {
  const body = req.body || {};
  const identifier = String(
    body.emailOrUsername || body.email || body.username || body.phoneNumber || ''
  ).trim().toLowerCase();

  const ip = ipKeyGenerator(req.ip || req.connection?.remoteAddress || 'unknown');
  const account = identifier || String(req.user?.id || req.user?.userId || 'anonymous');
  return `auth:${ip}:${account}`;
};

/**
 * Keys on the target account alone, deliberately omitting the IP that
 * buildAuthRateLimitKey folds in. That IP component means one address gets a
 * fresh bucket for every account it names -- fine against a single account
 * hammered from one machine, useless against password spraying across many
 * accounts, and useless against a botnet spreading attempts on one account.
 * Chain this alongside the per-IP limiter so both ceilings apply.
 *
 * Falls back to the IP when no identifier is supplied, so malformed requests
 * get their own bucket instead of sharing one global key that any caller could
 * exhaust for everyone.
 */
export const buildAccountRateLimitKey = (req) => {
  const body = req.body || {};
  const identifier = String(
    body.emailOrUsername || body.email || body.username || body.phoneNumber || ''
  ).trim().toLowerCase();

  if (identifier) {
    return `account:${identifier}`;
  }
  return `account-ip:${ipKeyGenerator(req.ip || req.connection?.remoteAddress || 'unknown')}`;
};

export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many registration attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildAuthRateLimitKey,
});

export const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { message: 'Too many OTP requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildAuthRateLimitKey,
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { message: 'Too many OTP verification attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildAuthRateLimitKey,
});

export const passwordResetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildAuthRateLimitKey,
});

export const passwordResetConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { message: 'Too many password reset attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildAuthRateLimitKey,
});

export const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many password change attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildAuthRateLimitKey,
});

export const verificationPhoneSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { message: 'Too many phone verification requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildAuthRateLimitKey,
});

export const verificationPhoneConfirmLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { message: 'Too many verification code attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildAuthRateLimitKey,
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildAuthRateLimitKey,
});

/**
 * Per-account ceiling for the login entry points, chained after loginLimiter.
 * Lower than the per-IP allowance because it is scoped to one account: a real
 * person signing in does not need ten tries per quarter hour, while an attacker
 * spraying a stolen credential list is stopped at the account no matter how
 * many addresses they come from.
 */
export const accountLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildAccountRateLimitKey,
});

export const qrSettlementLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: { message: 'Too many QR payment attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `qr:${String(req.user?.id || req.user?.userId || ipKeyGenerator(req.ip || 'unknown'))}`,
});
