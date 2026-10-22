import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import RateLimitBucket from '../models/RateLimitBucket.js';
import { getJwtSecret } from './jwtSecret.js';

const memoryBuckets = new Map();

export const clientIp = (req) => String(req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown');

/**
 * The account a second-factor request belongs to, taken from its challenge token.
 *
 * The bodies of /login/mfa (`{mfaToken, code}`), /login/otp/verify
 * (`{otpToken, code}`) and /login/otp/resend (`{otpToken}`) carry no email,
 * username or phone, and `req.user` is undefined on these unauthenticated
 * routes. So both key builders below used to fall back to the *same* per-IP
 * bucket -- collapsing the two independent ceilings documented in
 * routes/authRoutes.js into one and leaving a distributed attacker with
 * effectively no per-account limit on second-factor verification.
 *
 * The token is verified rather than merely decoded: an unverified decode would
 * let a caller nominate any `userId` and so pick their own bucket, or
 * deliberately exhaust a victim's. An invalid or expired token yields '' and
 * the caller falls back to IP keying, which is the correct conservative answer.
 */
const challengeSubject = (req) => {
  const token = req.body?.otpToken || req.body?.mfaToken || req.body?.selectionToken || req.body?.token;
  if (!token) return '';
  try {
    const decoded = jwt.verify(String(token), getJwtSecret());
    return String(decoded?.userId || '').trim().toLowerCase();
  } catch {
    return '';
  }
};

const normalizedIdentifier = (req) => {
  const body = req.body || {};
  const supplied = String(body.emailOrUsername || body.email || body.username || body.phoneNumber || '').trim().toLowerCase();
  return supplied || challengeSubject(req);
};

export const buildAuthRateLimitKey = (req) => {
  const identifier = normalizedIdentifier(req);
  const account = identifier || String(req.user?.id || req.user?.userId || 'anonymous');
  return `auth:${clientIp(req)}:${account}`;
};

export const buildAccountRateLimitKey = (req) => {
  const identifier = normalizedIdentifier(req);
  return identifier ? `account:${identifier}` : `account-ip:${clientIp(req)}`;
};

export const buildIpRateLimitKey = (scope) => (req) => `${scope}:${clientIp(req)}`;
export const buildUserRateLimitKey = (scope) => (req) =>
  `${scope}:${String(req.user?.id || req.user?.userId || clientIp(req))}`;

const windowFor = (windowMs, now = Date.now()) => {
  const start = Math.floor(now / windowMs) * windowMs;
  return { start: new Date(start), resetAt: new Date(start + windowMs) };
};

const consumeInMemory = (key, limit, windowMs) => {
  const { start, resetAt } = windowFor(windowMs);
  const compoundKey = `${key}:${start.getTime()}`;
  const current = memoryBuckets.get(compoundKey) || 0;
  if (current >= limit) return { allowed: false, remaining: 0, resetAt };
  memoryBuckets.set(compoundKey, current + 1);
  return { allowed: true, remaining: limit - current - 1, resetAt };
};

const consumeMongoBucket = async (key, limit, windowMs) => {
  const { start, resetAt } = windowFor(windowMs);
  const filter = { key, windowStart: start, count: { $lt: limit } };
  const update = {
    $setOnInsert: { key, windowStart: start, expiresAt: resetAt },
    $inc: { count: 1 },
  };

  try {
    const bucket = await RateLimitBucket.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
    }).lean();
    return bucket ? { allowed: true, remaining: Math.max(0, limit - bucket.count), resetAt } : { allowed: false, remaining: 0, resetAt };
  } catch (error) {
    // An exhausted bucket causes an upsert duplicate-key race. Retry without
    // upsert once: success means a concurrent first request created room;
    // no match means the bucket really is exhausted.
    if (error?.code !== 11000) throw error;
    const bucket = await RateLimitBucket.findOneAndUpdate(filter, { $inc: { count: 1 } }, { new: true }).lean();
    return bucket ? { allowed: true, remaining: Math.max(0, limit - bucket.count), resetAt } : { allowed: false, remaining: 0, resetAt };
  }
};

const writeRateLimitHeaders = (res, { limit, remaining, resetAt }) => {
  const resetSeconds = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
  res.set('RateLimit-Policy', `${limit};w=${resetSeconds}`);
  res.set('RateLimit', `limit=${limit}, remaining=${remaining}, reset=${resetSeconds}`);
  res.set('X-RateLimit-Limit', String(limit));
  res.set('X-RateLimit-Remaining', String(remaining));
  res.set('X-RateLimit-Reset', String(Math.ceil(resetAt.getTime() / 1000)));
  return resetSeconds;
};

/**
 * Production limiter backed by Mongo. Development/test fallback keeps route
 * unit tests independent of a database; production fails closed if Mongo is
 * unavailable instead of silently reverting to a per-instance limiter.
 */
export const createRateLimiter = ({ windowMs, limit, keyGenerator, message }) => async (req, res, next) => {
  const key = keyGenerator(req);
  try {
    const result = mongoose.connection.readyState === 1
      ? await consumeMongoBucket(key, limit, windowMs)
      : process.env.NODE_ENV === 'production'
        ? null
        : consumeInMemory(key, limit, windowMs);

    if (!result) return res.status(503).json({ message: 'Request protection is temporarily unavailable. Please try again shortly.' });

    const retryAfter = writeRateLimitHeaders(res, { limit, ...result });
    if (!result.allowed) {
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        message: typeof message === 'string' ? message : message?.message || 'Too many requests. Please try again later.',
        retryAfter,
      });
    }
    return next();
  } catch (error) {
    console.error('Rate limiter failed:', error?.message || error);
    return res.status(503).json({ message: 'Request protection is temporarily unavailable. Please try again shortly.' });
  }
};

const authLimiter = (windowMs, limit, message) => createRateLimiter({ windowMs, limit, message, keyGenerator: buildAuthRateLimitKey });
const ipLimiter = (scope, windowMs, limit, message) => createRateLimiter({ windowMs, limit, message, keyGenerator: buildIpRateLimitKey(scope) });

export const registerLimiter = authLimiter(15 * 60 * 1000, 20, 'Too many registration attempts. Please try again later.');
export const registerIpLimiter = ipLimiter('register-ip', 15 * 60 * 1000, 20, 'Too many registration attempts. Please try again later.');
export const otpSendLimiter = authLimiter(10 * 60 * 1000, 5, 'Too many OTP requests. Please try again later.');
export const otpSendIpLimiter = ipLimiter('otp-send-ip', 10 * 60 * 1000, 10, 'Too many OTP requests. Please try again later.');
export const otpVerifyLimiter = authLimiter(10 * 60 * 1000, 20, 'Too many OTP verification attempts. Please try again later.');
export const passwordResetRequestLimiter = authLimiter(15 * 60 * 1000, 5, 'Too many password reset requests. Please try again later.');
export const passwordResetConfirmLimiter = authLimiter(15 * 60 * 1000, 15, 'Too many password reset attempts. Please try again later.');
export const passwordChangeLimiter = authLimiter(15 * 60 * 1000, 10, 'Too many password change attempts. Please try again later.');
export const secondaryEmailSendLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, limit: 5,
  message: 'Too many secondary email OTP requests. Please try again later.', keyGenerator: buildUserRateLimitKey('secondary-email-send') });
export const secondaryEmailConfirmLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, limit: 15,
  message: 'Too many secondary email verification attempts. Please try again later.', keyGenerator: buildUserRateLimitKey('secondary-email-confirm') });
export const verificationPhoneSendLimiter = authLimiter(10 * 60 * 1000, 5, 'Too many phone verification requests. Please try again later.');
export const verificationPhoneConfirmLimiter = authLimiter(10 * 60 * 1000, 20, 'Too many verification code attempts. Please try again later.');
export const loginLimiter = authLimiter(3 * 60 * 1000, 20, 'Too many login attempts. Please try again later.');
export const accountLoginLimiter = createRateLimiter({ windowMs: 3 * 60 * 1000, limit: 5, message: 'Too many login attempts. Please try again later.', keyGenerator: buildAccountRateLimitKey });
export const qrSettlementLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, limit: 30, message: 'Too many QR payment attempts. Please try again later.', keyGenerator: buildUserRateLimitKey('qr') });
