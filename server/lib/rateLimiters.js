import rateLimit, * as rateLimitModule from 'express-rate-limit';

const ipKeyGenerator = rateLimitModule.ipKeyGenerator || ((value) => String(value || 'unknown'));

export const buildAuthRateLimitKey = (req) => {
  const body = req.body || {};
  const identifier = String(
    body.emailOrUsername || body.email || body.username || body.phoneNumber || ''
  ).trim().toLowerCase();

  if (identifier) {
    return `auth:${identifier}`;
  }

  return `ip:${ipKeyGenerator(req.ip || req.connection?.remoteAddress || 'unknown')}`;
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
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { message: 'Too many OTP verification attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const passwordResetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const passwordResetConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { message: 'Too many password reset attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many password change attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const verificationPhoneSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { message: 'Too many phone verification requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const verificationPhoneConfirmLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { message: 'Too many verification code attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildAuthRateLimitKey,
});

export const qrSettlementLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: { message: 'Too many QR payment attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `qr:${String(req.user?.id || req.user?.userId || ipKeyGenerator(req.ip || 'unknown'))}`,
});
