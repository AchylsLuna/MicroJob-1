import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import { getEmailTransporter, getMailFrom } from './emailTransporter.js';
import { getJwtSecret } from './jwtSecret.js';
import { issueOtpChallenge } from './otpChallenges.js';

export const MFA_LOGIN_PURPOSE = 'mfa-login';
export const LOGIN_OTP_PURPOSE = 'login-otp';
export const MFA_METHOD = 'authenticator';
export const MFA_CHALLENGE_TTL = '1m';
export const LOGIN_OTP_CHALLENGE_TTL = '5m';
export const MFA_BACKUP_CODES_COUNT = 8;

export const normalizeMfaCode = (value = '') =>
  String(value).trim().replace(/\s+/g, '').replace(/-/g, '').toUpperCase();

export const createMfaChallengeToken = (userId, includePhone = false) =>
  jwt.sign(
    { userId, purpose: MFA_LOGIN_PURPOSE, includePhone: Boolean(includePhone) },
    getJwtSecret(),
    { expiresIn: MFA_CHALLENGE_TTL }
  );

export const createLoginOtpChallengeToken = (userId, challengeId, includePhone = false) =>
  jwt.sign(
    { userId, challengeId, purpose: LOGIN_OTP_PURPOSE, includePhone: Boolean(includePhone) },
    getJwtSecret(),
    { expiresIn: LOGIN_OTP_CHALLENGE_TTL }
  );

export const issueLoginOtpChallenge = async (user, includePhone = false) => {
  const email = String(user.email || '').toLowerCase().trim();
  const { challenge, code } = await issueOtpChallenge({
    purpose: 'login',
    subject: String(user._id),
    user: user._id,
    metadata: { includePhone: Boolean(includePhone), email },
  });
  const otpToken = createLoginOtpChallengeToken(String(user._id), challenge.challengeId, includePhone);

  // Email is the only delivery channel for a login code. The code is never logged
  // and never returned to the caller: a second factor that travels back in the same
  // HTTP response it authorises is not a second factor.
  const transporter = getEmailTransporter();
  if (!transporter) {
    throw new Error('Email service is not configured.');
  }

  const fromAddress = getMailFrom();
  const displayName = user.firstName || 'there';
  await transporter.sendMail({
    from: `MicroJobs <${fromAddress}>`,
    to: user.email,
    subject: 'MicroJobs login verification code',
    text: `Hi ${displayName},\n\nUse this code to continue logging in to MicroJobs: ${code}\n\nThis code expires in 5 minutes.`,
    html: `
      <p>Hi ${displayName},</p>
      <p>Use this code to continue logging in to MicroJobs:</p>
      <p style="font-size: 20px; font-weight: bold; letter-spacing: 2px;">${code}</p>
      <p>This code expires in 5 minutes.</p>
    `,
  });

  return { otpToken };
};

export const generateBackupCodes = (count = MFA_BACKUP_CODES_COUNT) =>
  Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  });

export const hashBackupCodes = async (codes = []) =>
  Promise.all(codes.map((code) => bcrypt.hash(normalizeMfaCode(code), 10)));

export const verifyTotpCode = (secret, code) =>
  Boolean(
    secret &&
      speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: normalizeMfaCode(code),
        window: 1,
      })
  );

export const verifyAndMaybeConsumeBackupCode = async (user, code, consume = false) => {
  const normalized = normalizeMfaCode(code);
  if (!normalized || !Array.isArray(user?.mfaBackupCodes) || user.mfaBackupCodes.length === 0) {
    return false;
  }

  for (let index = 0; index < user.mfaBackupCodes.length; index += 1) {
    const hash = user.mfaBackupCodes[index];
    const matches = await bcrypt.compare(normalized, hash);
    if (!matches) continue;
    if (consume) {
      user.mfaBackupCodes.splice(index, 1);
    }
    return true;
  }

  return false;
};

export const verifyMfaCodeForUser = async (user, code, consumeBackup = false) => {
  const normalized = normalizeMfaCode(code);
  if (!normalized) {
    return { valid: false, usedBackup: false };
  }

  if (verifyTotpCode(user?.mfaSecret, normalized)) {
    return { valid: true, usedBackup: false };
  }

  const usedBackup = await verifyAndMaybeConsumeBackupCode(user, normalized, consumeBackup);
  return { valid: usedBackup, usedBackup };
};

export const mfaStatusPayload = (user) => ({
  enabled: Boolean(user?.mfaEnabled),
  method: user?.mfaMethod || null,
  backupCodesRemaining: Array.isArray(user?.mfaBackupCodes) ? user.mfaBackupCodes.length : 0,
  hasPendingSetup: Boolean(user?.mfaPendingSecret),
});
