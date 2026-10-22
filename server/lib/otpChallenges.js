import crypto from 'node:crypto';
import OtpChallenge from '../models/OtpChallenge.js';
import { getJwtSecret } from './jwtSecret.js';

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const createOtpCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
const hashCode = (challengeId, code) => crypto.createHmac('sha256', getJwtSecret()).update(`${challengeId}:${String(code)}`).digest('hex');
const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ''), 'hex');
  const b = Buffer.from(String(right || ''), 'hex');
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
};

// Test-only: the isolated e2e/test harness runs with no SMTP credentials and
// has no mailbox to read from, so it needs a programmatic way to retrieve a
// code it can never see over the wire. Same mechanism and same hard
// NODE_ENV === 'test' gate as mfaHelpers' login-OTP equivalent, generalised by
// purpose so the signup, password-reset and password-change flows can all stop
// echoing their code back in the HTTP response -- an OTP that travels back in
// the same response it authorises is not a second factor.
//
// Populated only when NODE_ENV === 'test'; an unread Map in every other
// environment, and never read from outside that same guard.
const testOtpCodes = new Map();
const testOtpKey = (purpose, subject) => `${purpose}:${String(subject || '').trim().toLowerCase()}`;
export const rememberTestOtpCode = (purpose, subject, code) => {
  if (process.env.NODE_ENV === 'test') testOtpCodes.set(testOtpKey(purpose, subject), code);
};
export const getTestOtpCode = (purpose, subject) =>
  process.env.NODE_ENV === 'test' ? testOtpCodes.get(testOtpKey(purpose, subject)) : undefined;

/**
 * `carryAttempts` keeps the failed-attempt count from the challenge this one
 * replaces.
 *
 * Without it, re-issuing simply reset `attempts` to 0, so the `maxAttempts`
 * ceiling was resettable at will: a caller holding a password could guess five
 * login codes, resend, and guess five more, indefinitely. Carrying the count
 * makes the ceiling apply to the whole login episode rather than to each
 * individual code.
 */
export async function issueOtpChallenge({ purpose, subject, user = null, metadata = {}, ttlMs = OTP_TTL_MS, maxAttempts = OTP_MAX_ATTEMPTS, carryAttempts = false }) {
  const normalizedSubject = String(subject || '').trim().toLowerCase();
  const inheritedAttempts = carryAttempts
    ? (await OtpChallenge.findOne({ purpose, subject: normalizedSubject, active: true })
        .sort({ createdAt: -1 })
        .select('attempts')
        .lean())?.attempts || 0
    : 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const challengeId = crypto.randomBytes(18).toString('hex');
    const code = createOtpCode();
    const now = new Date();
    await OtpChallenge.updateMany(
      { purpose, subject: normalizedSubject, active: true },
      { $set: { active: false, invalidatedAt: now } },
    );
    try {
      const challenge = await OtpChallenge.create({
        purpose, subject: normalizedSubject, user, challengeId,
        codeHash: hashCode(challengeId, code), maxAttempts, attempts: inheritedAttempts,
        expiresAt: new Date(Date.now() + ttlMs), metadata, active: true,
      });
      return { challenge, code };
    } catch (error) {
      if (error?.code !== 11000 || attempt === 2) throw error;
    }
  }
  throw new Error('Unable to issue OTP challenge.');
}

export async function getOtpChallenge({ purpose, subject, challengeId }) {
  const query = { purpose, active: true, consumedAt: null, invalidatedAt: null };
  if (challengeId) query.challengeId = String(challengeId);
  else query.subject = String(subject || '').trim().toLowerCase();
  return OtpChallenge.findOne(query).sort({ createdAt: -1 }).select('+codeHash');
}

export async function verifyOtpChallenge({ purpose, subject, challengeId, code, markVerified = false, consume = false }) {
  const challenge = await getOtpChallenge({ purpose, subject, challengeId });
  if (!challenge) return { ok: false, reason: 'missing' };
  if (challenge.expiresAt.getTime() <= Date.now()) {
    challenge.active = false; challenge.invalidatedAt = new Date(); await challenge.save();
    return { ok: false, reason: 'expired' };
  }
  if (challenge.attempts >= challenge.maxAttempts) return { ok: false, reason: 'attempts' };
  if (!safeEqual(challenge.codeHash, hashCode(challenge.challengeId, code))) {
    const updated = await OtpChallenge.findOneAndUpdate(
      { _id: challenge._id, active: true, attempts: { $lt: challenge.maxAttempts } },
      { $inc: { attempts: 1 } },
      { returnDocument: 'after' },
    ).select('+codeHash');
    if (!updated) return { ok: false, reason: 'attempts' };
    if (updated.attempts >= updated.maxAttempts) {
      await OtpChallenge.updateOne(
        { _id: updated._id, active: true },
        { $set: { active: false, invalidatedAt: new Date() } },
      );
      return { ok: false, reason: 'attempts' };
    }
    return { ok: false, reason: 'invalid' };
  }
  const now = new Date();
  const claimed = await OtpChallenge.findOneAndUpdate(
    { _id: challenge._id, active: true, consumedAt: null, invalidatedAt: null },
    { $set: { ...(markVerified ? { verifiedAt: now } : {}), ...(consume ? { consumedAt: now, active: false } : {}) } },
    { returnDocument: 'after' },
  ).select('+codeHash');
  return claimed ? { ok: true, challenge: claimed } : { ok: false, reason: 'consumed' };
}

export const consumeVerifiedOtpChallenge = ({ purpose, subject, code }) =>
  verifyOtpChallenge({ purpose, subject, code, consume: true });

export const clearOtpChallenges = (subject) => OtpChallenge.deleteMany({ subject: String(subject || '').trim().toLowerCase() });
export const clearUserOtpChallenges = (user) => OtpChallenge.deleteMany({ user });
