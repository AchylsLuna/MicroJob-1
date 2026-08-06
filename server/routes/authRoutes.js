import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit, * as rateLimitModule from 'express-rate-limit';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import speakeasy from 'speakeasy';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { basename, dirname, extname, join, resolve } from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import csrfProtection from '../middleware/csrf.js';
import Session from '../models/Session.js';
import { disconnectSession } from '../lib/socket.js';
import User from '../models/User.js';
import JobApplication from '../models/JobApplication.js';
import verifyToken from '../middleware/auth.js';
import {
  sendOtp,
  verifyOtp,
  updateMe,
  getPublicProfile,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithOtp,
  requestPasswordChangeOtp,
  changePasswordWithOtp,
  requestSelfDelete,
  changeInitialPassword,
} from '../controllers/UserController.js';
import {
  isValidName,
  isValidPhone,
  NAME_VALIDATION_MESSAGE,
  normalizeName,
  normalizeEmail,
  normalizePhone,
  PHONE_VALIDATION_MESSAGE,
} from '../lib/authValidation.js';

// express-rate-limit added ipKeyGenerator in v8. Keep local installs on v6 usable
// while package installs from the current lockfile receive IPv6 subnet handling.
const ipKeyGenerator = rateLimitModule.ipKeyGenerator || ((value) => String(value || 'unknown'));
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../lib/passwordPolicy.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';
import { getJwtSecret } from '../lib/jwtSecret.js';
import {
  PhoneOtpError,
  sendPhoneVerificationOtp,
  verifyPhoneVerificationOtp,
} from '../lib/phoneOtp.js';

const router = express.Router();

// Setup multer for file uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uploadsDir = join(__dirname, '..', 'uploads');
const uploadsRoot = `${resolve(uploadsDir)}${process.platform === 'win32' ? '\\' : '/'}`;

const safeExt = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9.]/g, '');

const isSafeUploadFileName = (value = '') => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  if (normalized !== basename(normalized)) return false;
  if (normalized.includes('..')) return false;
  return /^[a-zA-Z0-9._-]+$/.test(normalized);
};

const resolveUploadPath = (fileName = '') => {
  if (!isSafeUploadFileName(fileName)) return null;
  const fullPath = resolve(uploadsDir, fileName);
  if (fullPath !== resolve(uploadsDir) && !fullPath.startsWith(uploadsRoot)) return null;
  return fullPath;
};

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage for resume files
const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id;
    const timestamp = Date.now();
    const ext = safeExt(extname(file.originalname)) || '.bin';
    cb(null, `resume_${userId}_${timestamp}${ext}`);
  },
});

// Multer storage for avatar images
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id;
    const timestamp = Date.now();
    const ext = safeExt(extname(file.originalname)) || '.jpg';
    cb(null, `avatar_${userId}_${timestamp}${ext}`);
  },
});

const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const userId = req.user?.id;
    const timestamp = Date.now();
    const ext = safeExt(extname(file.originalname)) || '.bin';
    cb(null, `verification_${userId}_${timestamp}${ext}`);
  },
});

// Multer for resume uploads (PDF, DOC, DOCX)
const multerResume = multer({
  storage: resumeStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    const allowedMime = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);
    const ext = safeExt(extname(file.originalname));
    if (allowed.includes(ext) && allowedMime.has(String(file.mimetype || '').toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOC files are allowed for resumes'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Multer for avatar uploads (JPG, PNG, GIF, WEBP)
const multerAvatar = multer({
  storage: avatarStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const allowedMime = new Set([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ]);
    const ext = safeExt(extname(file.originalname));
    if (allowed.includes(ext) && allowedMime.has(String(file.mimetype || '').toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, GIF, and WEBP images are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Verification documents may be images or PDFs, matching the formats offered by clients.
const multerDocument = multer({
  storage: documentStorage,
  fileFilter: (req, file, cb) => {
    const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
    const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
    const ext = safeExt(extname(file.originalname));
    if (allowed.has(ext) && allowedMime.has(String(file.mimetype || '').toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WEBP, and PDF files are allowed for verification documents'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const removeUploadFile = (value) => {
  const fileName = basename(String(value || '').replace(/\\/g, '/'));
  const filePath = resolveUploadPath(fileName);
  if (!filePath || !fs.existsSync(filePath)) return;
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    console.warn(`Failed to remove upload ${fileName}:`, error?.message || error);
  }
};

const hasValidVerificationFileSignature = (file) => {
  if (!file?.path) return false;
  let bytes;
  try {
    bytes = fs.readFileSync(file.path).subarray(0, 12);
  } catch {
    return false;
  }
  const extension = safeExt(extname(file.originalname));
  if (extension === '.pdf') return bytes.subarray(0, 4).toString() === '%PDF';
  if (extension === '.png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (extension === '.webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (extension === '.jpg' || extension === '.jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return false;
};

const readUploadHeader = (file, length = 16) => {
  try {
    return file?.path ? fs.readFileSync(file.path).subarray(0, length) : null;
  } catch {
    return null;
  }
};

export const hasValidResumeFileSignature = (file) => {
  const bytes = readUploadHeader(file);
  if (!bytes) return false;
  const extension = safeExt(extname(file.originalname));
  if (extension === '.pdf') return bytes.subarray(0, 4).toString() === '%PDF';
  if (extension === '.doc') {
    return bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  }
  if (extension === '.docx') {
    const zipSignature = `${bytes[2]}:${bytes[3]}`;
    return bytes[0] === 0x50 && bytes[1] === 0x4b && ['3:4', '5:6', '7:8'].includes(zipSignature);
  }
  return false;
};

export const hasValidAvatarFileSignature = (file) => {
  const bytes = readUploadHeader(file);
  if (!bytes) return false;
  const extension = safeExt(extname(file.originalname));
  if (extension === '.png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (extension === '.webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (extension === '.jpg' || extension === '.jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === '.gif') return ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString());
  return false;
};

const withUploadErrors = (middleware) => (req, res, next) => {
  middleware(req, res, (error) => {
    if (!error) return next();
    if (req.file?.filename) removeUploadFile(req.file.filename);
    if (error?.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 413, 'File is too large. Maximum size is 5 MB.');
    }
    return sendError(res, 400, error?.message || 'Invalid file upload.');
  });
};

const uploadAvatarFile = withUploadErrors(multerAvatar.single('avatar'));
const uploadResumeFile = withUploadErrors(multerResume.single('resume'));
const uploadVerificationFile = withUploadErrors(multerDocument.single('document'));

const SELF_SERVICE_ROLES = new Set(['hire', 'work', 'both']);
const cookieSecurityOptions = {
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
};
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const normalizeUsername = (value = '') => String(value).trim().replace(/\s+/g, ' ').toLowerCase();
const normalizeDisplayName = (value = '') => String(value).trim().replace(/\s+/g, ' ');
const MFA_LOGIN_PURPOSE = 'mfa-login';
const LOGIN_OTP_PURPOSE = 'login-otp';
const MFA_METHOD = 'authenticator';
const MFA_CHALLENGE_TTL = '1m';
const LOGIN_OTP_CHALLENGE_TTL = '5m';
const LOGIN_OTP_TTL_MS = 5 * 60 * 1000;
const LOGIN_OTP_MAX_ATTEMPTS = 5;
const MFA_BACKUP_CODES_COUNT = 8;
const loginOtpStore = new Map();

const getEmailTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    return null;
  }

  const secure = port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
};

const createAccessToken = (user, sessionId) =>
  jwt.sign(
    { userId: user._id, role: user.role || 'user', sessionId },
    getJwtSecret(),
    { expiresIn: '15m' }
  );

const createSessionWithTokens = async (req, user) => {
  const requestIp = req.ip || req.socket.remoteAddress || '';
  const userAgent = req.get('User-Agent') || '';
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  // Check for existing active session from same device (userAgent + IP combination)
  let session = await Session.findOne({
    user: user._id,
    userAgent: userAgent,
    ip: requestIp,
    active: true,
  });

  if (session) {
    // Update existing session instead of creating duplicate
    session.expiresAt = expiresAt;
    session.createdAt = new Date(); // Update last login time
  } else {
    // Clean up old inactive sessions for this user (keep only last 10 inactive)
    const inactiveSessions = await Session.find({
      user: user._id,
      active: false,
    }).sort({ endedAt: -1 }).skip(10);

    if (inactiveSessions.length > 0) {
      const idsToDelete = inactiveSessions.map(s => s._id);
      await Session.deleteMany({ _id: { $in: idsToDelete } });
    }

    // Create new session if none exists
    session = await Session.create({
      user: user._id,
      userAgent: userAgent,
      ip: requestIp,
      active: true,
      expiresAt,
    });
  }

  const accessToken = createAccessToken(user, session._id.toString());
  const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  session.refreshTokenHash = refreshHash;
  await session.save();

  return {
    accessToken,
    accessTokenExpiresAt,
    refreshToken,
    expiresAt,
    sessionId: session._id.toString(),
    session,
  };
};

const setSessionCookies = (
  res,
  { refreshToken, sessionId, accessToken, accessTokenExpiresAt, expiresAt, csrfToken }
) => {
  if (csrfToken) {
    res.cookie('csrfToken', csrfToken, {
      httpOnly: false,
      ...cookieSecurityOptions,
      expires: expiresAt,
    });
  }

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    ...cookieSecurityOptions,
    expires: expiresAt,
  });
  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    ...cookieSecurityOptions,
    expires: expiresAt,
  });

  if (accessToken) {
    res.cookie('token', accessToken, {
      httpOnly: true,
      ...cookieSecurityOptions,
      expires: accessTokenExpiresAt || expiresAt,
    });
  }
};

const buildLoginPayload = (user, includePhone = false) => {
  // Compute account options based on role
  let accountOptions = [];
  const role = user.role || 'work';

  if (role === 'hire') {
    accountOptions = ['hire'];
  } else if (role === 'work') {
    accountOptions = ['work'];
  } else if (role === 'both') {
    accountOptions = ['hire', 'work'];
  } else if (role === 'admin' || role === 'superadmin') {
    accountOptions = [];
  }

  return {
    id: user._id,
    ...(includePhone ? { phoneNumber: user.phoneNumber } : {}),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: role,
    accountOptions,
    avatarUrl: user.avatarUrl,
    city: user.city,
    country: user.country,
    province: user.province,
    barangay: user.barangay,
    addressType: user.addressType,
    address: user.address,
    linkedin: user.linkedin,
    website: user.website,
    jobPosition: user.jobPosition,
    passwordChangeRequired: Boolean(user.passwordChangeRequired),
  };
};

const normalizeMfaCode = (value = '') =>
  String(value).trim().replace(/\s+/g, '').replace(/-/g, '').toUpperCase();

const createMfaChallengeToken = (userId, includePhone = false) =>
  jwt.sign(
    { userId, purpose: MFA_LOGIN_PURPOSE, includePhone: Boolean(includePhone) },
    getJwtSecret(),
    { expiresIn: MFA_CHALLENGE_TTL }
  );

const createLoginOtpChallengeToken = (userId, challengeId, includePhone = false) =>
  jwt.sign(
    { userId, challengeId, purpose: LOGIN_OTP_PURPOSE, includePhone: Boolean(includePhone) },
    getJwtSecret(),
    { expiresIn: LOGIN_OTP_CHALLENGE_TTL }
  );

const issueLoginOtpChallenge = async (user, includePhone = false) => {
  const challengeId = crypto.randomBytes(18).toString('hex');
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const otpToken = createLoginOtpChallengeToken(String(user._id), challengeId, includePhone);
  const expiresAt = Date.now() + LOGIN_OTP_TTL_MS;

  loginOtpStore.set(challengeId, {
    userId: String(user._id),
    includePhone: Boolean(includePhone),
    email: String(user.email || '').toLowerCase().trim(),
    code,
    attempts: 0,
    expiresAt,
  });

  const transporter = getEmailTransporter();
  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email service is not configured.');
    }
    console.warn(`SMTP is not configured. Development login OTP for ${user.email}: ${code}`);
    return { otpToken, code };
  }

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
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

const generateBackupCodes = (count = MFA_BACKUP_CODES_COUNT) =>
  Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  });

const hashBackupCodes = async (codes = []) =>
  Promise.all(codes.map((code) => bcrypt.hash(normalizeMfaCode(code), 10)));

const verifyTotpCode = (secret, code) =>
  Boolean(
    secret &&
      speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: normalizeMfaCode(code),
        window: 1,
      })
  );

const verifyAndMaybeConsumeBackupCode = async (user, code, consume = false) => {
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

const verifyMfaCodeForUser = async (user, code, consumeBackup = false) => {
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

const mfaStatusPayload = (user) => ({
  enabled: Boolean(user?.mfaEnabled),
  method: user?.mfaMethod || null,
  backupCodesRemaining: Array.isArray(user?.mfaBackupCodes) ? user.mfaBackupCodes.length : 0,
  hasPendingSetup: Boolean(user?.mfaPendingSecret),
});

const buildAuthRateLimitKey = (req) => {
  const body = req.body || {};
  const identifier = String(
    body.emailOrUsername || body.email || body.username || body.phoneNumber || ''
  ).trim().toLowerCase();

  if (identifier) {
    return `auth:${identifier}`;
  }

  return `ip:${ipKeyGenerator(req.ip || req.connection?.remoteAddress || 'unknown')}`;
};

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many registration attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildAuthRateLimitKey,
});

// Register a new user (supports both email/username and phone-based registration)
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, email, password, phoneNumber, firstName, lastName, role } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phoneNumber || '');
    const normalizedUsername = normalizeUsername(username);
    const displayUsername = normalizeDisplayName(username);
    const providedFirstName = String(firstName || '').trim();
    const providedLastName = String(lastName || '').trim();
    const userRole = SELF_SERVICE_ROLES.has(role) ? role : 'work';

    if (!normalizedEmail) {
      return sendError(res, 400, 'Email is required');
    }

    if (!password) {
      return sendError(res, 400, 'Password is required');
    }
    if (!isStrongPassword(password)) {
      return sendError(res, 400, PASSWORD_POLICY_MESSAGE);
    }
    if (normalizedPhone && !isValidPhone(normalizedPhone)) {
      return sendError(res, 400, PHONE_VALIDATION_MESSAGE);
    }

    let userFirstName = providedFirstName;
    let userLastName = providedLastName;
    if (!userFirstName || !userLastName) {
      if (!displayUsername) {
        return sendError(res, 400, 'Username or full name is required');
      }
      const nameParts = displayUsername.split(' ').filter(Boolean);
      userFirstName = nameParts[0] || displayUsername;
      userLastName = nameParts.slice(1).join(' ') || userFirstName;
    }

    userFirstName = normalizeName(userFirstName);
    userLastName = normalizeName(userLastName);
    if (!isValidName(userFirstName) || !isValidName(userLastName)) {
      return sendError(res, 400, NAME_VALIDATION_MESSAGE);
    }

    const duplicateQuery = [
      { email: normalizedEmail },
      ...(normalizedPhone ? [{ phoneNumber: normalizedPhone }] : []),
      ...(normalizedUsername ? [{ username: normalizedUsername }] : []),
    ];
    const existingUser = await User.findOne({ $or: duplicateQuery });
    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        return sendError(res, 409, 'Email is already registered');
      }
      if (normalizedPhone && existingUser.phoneNumber === normalizedPhone) {
        return sendError(res, 409, 'Phone number is already registered');
      }
      return sendError(res, 409, 'Username is already taken');
    }

    const user = new User({
      username: normalizedUsername || undefined,
      firstName: userFirstName,
      lastName: userLastName,
      email: normalizedEmail,
      phoneNumber: normalizedPhone || undefined,
      role: userRole,
      status: 'pending',
    });
    await user.setPassword(password);
    await user.save();

    const userPayload = {
      id: user._id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      email: user.email,
      role: user.role,
    };
    return sendSuccess(
      res,
      201,
      'User registered successfully',
      { user: userPayload }
    );
  } catch (error) {
    if (error instanceof Error && error.message === PASSWORD_POLICY_MESSAGE) {
      return sendError(res, 400, PASSWORD_POLICY_MESSAGE);
    }
    if (error?.code === 11000) {
      const duplicateField = Object.keys(error?.keyPattern || {})[0] || '';
      if (duplicateField === 'email') {
        return sendError(res, 409, 'Email is already registered');
      }
      if (duplicateField === 'phoneNumber') {
        return sendError(res, 409, 'Phone number is already registered');
      }
      if (duplicateField === 'username') {
        return sendError(res, 409, 'Username is already taken');
      }
      return sendError(res, 409, 'Account already exists');
    }
    if (error?.name === 'ValidationError' && error?.errors) {
      const firstValidation = Object.values(error.errors)[0];
      const validationMessage =
        firstValidation?.message || 'Please check your inputs and try again.';
      return sendError(res, 400, `Invalid input: ${validationMessage}`);
    }
    console.error('Register error:', error);
    return sendError(res, 500, 'Server error during registration');
  }
});

const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { message: 'Too many OTP requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { message: 'Too many OTP verification attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { message: 'Too many password reset attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many password change attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const verificationPhoneSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { message: 'Too many phone verification requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const verificationPhoneConfirmLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { message: 'Too many verification code attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/otp/send', otpSendLimiter, sendOtp);
router.post('/otp/verify', otpVerifyLimiter, verifyOtp);
router.post('/password-reset/request', passwordResetRequestLimiter, requestPasswordResetOtp);
router.post('/password-reset/verify', passwordResetConfirmLimiter, verifyPasswordResetOtp);
router.post('/password-reset/confirm', passwordResetConfirmLimiter, resetPasswordWithOtp);
router.post('/password-change/request', verifyToken, passwordChangeLimiter, requestPasswordChangeOtp);
router.post('/password-change/confirm', verifyToken, passwordChangeLimiter, changePasswordWithOtp);
router.post('/password/initial-change', verifyToken, passwordChangeLimiter, changeInitialPassword);

// Login an existing user (supports email/username and phone)
// Key the limiter by account identifier so shared IPs do not throttle each other.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildAuthRateLimitKey,
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { emailOrUsername, password, phoneNumber, requireOtp } = req.body;
    if (!password) {
      return sendError(res, 400, 'Password is required');
    }

    let user;
    let includePhone = false;
    let invalidMessage = 'Invalid credentials';
    const normalizedPhone = normalizePhone(phoneNumber || '');

    if (normalizedPhone) {
      if (!isValidPhone(normalizedPhone)) {
        return sendError(res, 400, PHONE_VALIDATION_MESSAGE);
      }
      includePhone = true;
      invalidMessage = 'Invalid phone number or password';
      user = await User.findOne({ phoneNumber: normalizedPhone }).select('+passwordHashed');
    } else {
      const loginInput = String(emailOrUsername || '').trim();
      if (!loginInput) {
        return sendError(res, 400, 'Email/username and password are required');
      }
      user = await User.findOne({
        $or: [
          { email: normalizeEmail(loginInput) },
          { username: normalizeUsername(loginInput) },
        ],
      }).select('+passwordHashed');
    }

    if (!user || !(await user.validatePassword(password))) {
      return sendError(res, 401, invalidMessage);
    }

    if (user.status === 'pending') {
      return sendError(res, 401, 'Please verify your email before signing in.');
    }
    if (user.status === 'disabled') {
      return sendError(res, 401, 'Account is disabled. Contact an admin.');
    }
    if (user.status === 'deleted') {
      return sendError(res, 401, 'Account has been deleted.');
    }

    if (requireOtp) {
      const loginOtp = await issueLoginOtpChallenge(user, includePhone);
      return sendSuccess(
        res,
        200,
        'OTP verification required',
        {
          otpRequired: true,
          otpToken: loginOtp.otpToken,
          ...(loginOtp.code && process.env.NODE_ENV !== 'production' ? { code: loginOtp.code } : {}),
        }
      );
    }

    if (user.mfaEnabled) {
      const mfaToken = createMfaChallengeToken(String(user._id), includePhone);
      return sendSuccess(
        res,
        200,
        'MFA verification required',
        {
          mfaRequired: true,
          mfaToken,
          method: user.mfaMethod || MFA_METHOD,
        }
      );
    }

    const authSession = await createSessionWithTokens(req, user);
    const csrfToken = crypto.randomBytes(24).toString('hex');
    // `csrfToken` is intentionally NOT httpOnly so client JS can read it and include in `x-csrf-token` header
    setSessionCookies(res, {
      refreshToken: authSession.refreshToken,
      sessionId: authSession.sessionId,
      accessToken: authSession.accessToken,
      accessTokenExpiresAt: authSession.accessTokenExpiresAt,
      expiresAt: authSession.expiresAt,
      csrfToken,
    });

    const userPayload = buildLoginPayload(user, includePhone);
    return sendSuccess(
      res,
      200,
      'Login successful',
      { token: authSession.accessToken, user: userPayload }
    );
  } catch (error) {
    console.error('Login error:', error);
    return sendError(res, 500, 'Server error during login');
  }
});

router.post('/login/mfa', loginLimiter, async (req, res) => {
  try {
    const { mfaToken, code } = req.body || {};
    if (!mfaToken || !code) {
      return sendError(res, 400, 'MFA token and code are required');
    }

    let decoded;
    try {
      decoded = jwt.verify(String(mfaToken), getJwtSecret());
    } catch {
      return sendError(res, 401, 'MFA challenge expired. Please sign in again.');
    }

    if (decoded?.purpose !== MFA_LOGIN_PURPOSE || !decoded?.userId) {
      return sendError(res, 401, 'Invalid MFA challenge.');
    }

    const user = await User.findById(decoded.userId).select('+mfaSecret +mfaBackupCodes');
    if (!user) {
      return sendError(res, 401, 'Account not found.');
    }
    if (!user.mfaEnabled) {
      return sendError(res, 400, 'MFA is not enabled for this account.');
    }
    if (user.status === 'pending') {
      return sendError(res, 401, 'Please verify your email before signing in.');
    }
    if (user.status === 'disabled') {
      return sendError(res, 401, 'Account is disabled. Contact an admin.');
    }
    if (user.status === 'deleted') {
      return sendError(res, 401, 'Account has been deleted.');
    }

    const verification = await verifyMfaCodeForUser(user, code, true);
    if (!verification.valid) {
      return sendError(res, 401, 'Invalid MFA code.');
    }
    if (verification.usedBackup) {
      await user.save();
    }

    const authSession = await createSessionWithTokens(req, user);
    const csrfToken = crypto.randomBytes(24).toString('hex');
    setSessionCookies(res, {
      refreshToken: authSession.refreshToken,
      sessionId: authSession.sessionId,
      accessToken: authSession.accessToken,
      accessTokenExpiresAt: authSession.accessTokenExpiresAt,
      expiresAt: authSession.expiresAt,
      csrfToken,
    });

    const userPayload = buildLoginPayload(user, Boolean(decoded.includePhone));
    return sendSuccess(
      res,
      200,
      'Login successful',
      { token: authSession.accessToken, user: userPayload }
    );
  } catch (error) {
    console.error('Login MFA error:', error);
    return sendError(res, 500, 'Server error during MFA verification');
  }
});

router.post('/login/otp/verify', loginLimiter, async (req, res) => {
  try {
    const token = req.body?.otpToken || req.body?.token;
    const code = String(req.body?.code || '').trim();
    if (!token || !code) {
      return sendError(res, 400, 'otpToken and code are required.');
    }

    let decoded;
    try {
      decoded = jwt.verify(String(token), getJwtSecret());
    } catch {
      return sendError(res, 401, 'Invalid or expired OTP token.');
    }

    if (decoded?.purpose !== LOGIN_OTP_PURPOSE || !decoded?.challengeId) {
      return sendError(res, 401, 'Invalid OTP challenge token.');
    }

    const challenge = loginOtpStore.get(decoded.challengeId);
    if (!challenge) {
      return sendError(res, 401, 'OTP challenge not found or expired.');
    }
    if (challenge.expiresAt <= Date.now()) {
      loginOtpStore.delete(decoded.challengeId);
      return sendError(res, 401, 'OTP challenge expired.');
    }

    challenge.attempts = (challenge.attempts || 0) + 1;
    if (challenge.attempts > LOGIN_OTP_MAX_ATTEMPTS) {
      loginOtpStore.delete(decoded.challengeId);
      return sendError(res, 429, 'Too many OTP attempts. Please login again.');
    }

    if (challenge.code !== code) {
      return sendError(res, 401, 'Invalid OTP code.');
    }

    const user = await User.findById(challenge.userId);
    loginOtpStore.delete(decoded.challengeId);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }
    if (user.status === 'pending') {
      return sendError(res, 401, 'Please verify your email before signing in.');
    }
    if (user.status === 'disabled') {
      return sendError(res, 401, 'Account is disabled. Contact an admin.');
    }
    if (user.status === 'deleted') {
      return sendError(res, 401, 'Account has been deleted.');
    }

    const includePhone = challenge.includePhone || false;
    const authSession = await createSessionWithTokens(req, user);
    const csrfToken = crypto.randomBytes(24).toString('hex');
    setSessionCookies(res, {
      refreshToken: authSession.refreshToken,
      sessionId: authSession.sessionId,
      accessToken: authSession.accessToken,
      accessTokenExpiresAt: authSession.accessTokenExpiresAt,
      expiresAt: authSession.expiresAt,
      csrfToken,
    });

    const payload = buildLoginPayload(user, includePhone);
    return sendSuccess(res, 200, 'Login successful', { token: authSession.accessToken, user: payload });
  } catch (e) {
    console.error('Login OTP verify error:', e);
    return sendError(res, 500, 'Server error');
  }
});

router.post('/login/otp/resend', loginLimiter, async (req, res) => {
  try {
    const token = req.body?.otpToken || req.body?.token;
    if (!token) {
      return sendError(res, 400, 'otpToken is required.');
    }

    let decoded;
    try {
      decoded = jwt.verify(String(token), getJwtSecret());
    } catch {
      return sendError(res, 401, 'Invalid or expired OTP token.');
    }
    if (decoded?.purpose !== LOGIN_OTP_PURPOSE || !decoded?.challengeId) {
      return sendError(res, 401, 'Invalid OTP challenge token.');
    }

    const challenge = loginOtpStore.get(decoded.challengeId);
    if (!challenge) {
      return sendError(res, 401, 'OTP challenge not found or expired.');
    }

    const user = await User.findById(challenge.userId);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    const renewed = await issueLoginOtpChallenge(user, challenge.includePhone || false);
    loginOtpStore.delete(decoded.challengeId);
    return sendSuccess(res, 200, 'OTP resent', {
      otpRequired: true,
      otpToken: renewed.otpToken,
      ...(renewed.code && process.env.NODE_ENV !== 'production' ? { code: renewed.code } : {}),
    });
  } catch (e) {
    console.error('Login OTP resend error:', e);
    return sendError(res, 500, 'Server error');
  }
});

// Refresh access token
router.post('/refresh', csrfProtection, async (req, res) => {
  try {
    const incoming = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!incoming) return res.status(400).json({ message: 'Refresh token required' });

    const incomingHash = crypto.createHash('sha256').update(incoming).digest('hex');
    const session = await Session.findOne({ refreshTokenHash: incomingHash });
    if (!session || !session.active) return res.status(401).json({ message: 'Invalid session' });
    if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
      session.active = false;
      session.endedAt = new Date();
      await session.save();
      return res.status(401).json({ message: 'Session expired' });
    }

    const user = await User.findById(session.user);
    if (!user) return res.status(401).json({ message: 'Invalid session user' });

    // issue new access token (15m)
    const newAccess = createAccessToken(user, session._id.toString());

    // rotate refresh token
    const newRefresh = crypto.randomBytes(64).toString('hex');
    const newHash = crypto.createHash('sha256').update(newRefresh).digest('hex');
    session.refreshTokenHash = newHash;
    // Keep a hard 7-day session lifetime from session creation time.
    // Refresh rotates tokens but does not extend the session window.
    const sessionStart = session.createdAt ? new Date(session.createdAt).getTime() : Date.now();
    session.expiresAt = new Date(sessionStart + SESSION_TTL_MS);
    await session.save();

    // set cookies
    setSessionCookies(res, {
      refreshToken: newRefresh,
      sessionId: session._id.toString(),
      accessToken: newAccess,
      accessTokenExpiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
      expiresAt: session.expiresAt,
    });

    return res.status(200).json({ token: newAccess });
  } catch (err) {
    console.error('Refresh error', err);
    return res.status(500).json({ message: 'Failed to refresh token' });
  }
});

// List active sessions for current user
router.get('/sessions', verifyToken, async (req, res) => {
  try {
    const currentSessionId = req.user.sessionId || null;
    const now = new Date();

    // First, clean up expired sessions
    await Session.deleteMany({
      user: req.user.id,
      $or: [
        { expiresAt: { $lt: now } },
        { active: false }
      ]
    });

    // Get only valid active sessions
    const sessions = await Session.find({
      user: req.user.id,
      active: true,
      expiresAt: { $gt: now }
    })
    .sort({ createdAt: -1 })
    .select('-refreshTokenHash -token');

    // Mark the current session
    const sessionsWithCurrent = sessions.map(session => ({
      ...session.toObject(),
      isCurrent: session._id.toString() === currentSessionId,
    }));

    return res.status(200).json({ sessions: sessionsWithCurrent, currentSessionId });
  } catch (err) {
    console.error('Sessions list error', err);
    return res.status(500).json({ message: 'Failed to list sessions' });
  }
});

// Revoke a session (by id) for the current user
router.delete('/sessions/:id', verifyToken, async (req, res) => {
  try {
    const s = await Session.findById(req.params.id);
    if (!s) return res.status(404).json({ message: 'Session not found' });
    if (s.user.toString() !== String(req.user.id)) return res.status(403).json({ message: 'Not authorized' });

    // Prevent revoking current session
    if (req.user.sessionId && s._id.toString() === req.user.sessionId) {
      return res.status(400).json({ message: 'Cannot revoke current session. Use sign-out instead.' });
    }

    // Actually delete the session instead of marking inactive
    await Session.findByIdAndDelete(req.params.id);
    disconnectSession(req.params.id);
    return res.status(200).json({ message: 'Session revoked' });
  } catch (err) {
    console.error('Revoke session error', err);
    return res.status(500).json({ message: 'Failed to revoke session' });
  }
});

// Revoke all sessions for current user (sign out everywhere)
router.delete('/sessions', verifyToken, async (req, res) => {
  try {
    const sessionIds = await Session.find({ user: req.user.id }).distinct('_id');
    // Delete all sessions except the current one
    await Session.deleteMany({
      user: req.user.id,
      _id: { $ne: req.user.sessionId }
    });

    // Also delete current session to log out
    if (req.user.sessionId) {
      await Session.findByIdAndDelete(req.user.sessionId);
    }
    sessionIds.forEach((sessionId) => disconnectSession(sessionId));

    // clear cookies
    res.clearCookie('refreshToken', { ...cookieSecurityOptions, httpOnly: true });
    res.clearCookie('sessionId', { ...cookieSecurityOptions, httpOnly: true });
    res.clearCookie('csrfToken', { ...cookieSecurityOptions, httpOnly: false });
    res.clearCookie('token', { ...cookieSecurityOptions, httpOnly: true });
    return res.status(200).json({ message: 'All sessions revoked' });
  } catch (err) {
    console.error('Revoke all sessions error', err);
    return res.status(500).json({ message: 'Failed to revoke sessions' });
  }
});

// Clean up inactive sessions for current user
router.post('/sessions/cleanup', verifyToken, async (req, res) => {
  try {
    const now = new Date();
    const result = await Session.deleteMany({
      user: req.user.id,
      $or: [
        { active: false },
        { expiresAt: { $lt: now } }
      ]
    });
    return res.status(200).json({
      message: 'Inactive sessions cleaned up',
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error('Cleanup sessions error', err);
    return res.status(500).json({ message: 'Failed to cleanup sessions' });
  }
});

// Admin endpoint to view sessions for a given user id
router.get('/admin/sessions/:userId', verifyToken, async (req, res) => {
  try {
    const role = req.user.role || '';
    if (role !== 'admin' && role !== 'superadmin') return res.status(403).json({ message: 'Admin access required' });
    const sessions = await Session.find({ user: req.params.userId }).select('-refreshTokenHash -token');
    return res.status(200).json({ sessions });
  } catch (err) {
    console.error('Admin sessions error', err);
    return res.status(500).json({ message: 'Failed to fetch sessions' });
  }
});

router.get('/mfa/status', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user?.id).select('+mfaBackupCodes +mfaPendingSecret');
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    return sendSuccess(res, 200, 'MFA status retrieved', mfaStatusPayload(user));
  } catch (error) {
    console.error('MFA status error:', error);
    return sendError(res, 500, 'Failed to get MFA status');
  }
});

router.post('/mfa/setup', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user?.id).select('+mfaPendingSecret +mfaSecret +mfaBackupCodes');
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    const secret = speakeasy.generateSecret({
      name: `MicroJobs (${user.email})`,
      issuer: 'MicroJobs',
      length: 20,
    });

    user.mfaMethod = MFA_METHOD;
    user.mfaPendingSecret = secret.base32;
    await user.save();

    return sendSuccess(res, 200, 'MFA setup created', {
      method: MFA_METHOD,
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    return sendError(res, 500, 'Failed to initialize MFA setup');
  }
});

router.post('/mfa/enable', verifyToken, async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) {
      return sendError(res, 400, 'Verification code is required');
    }

    const user = await User.findById(req.user?.id).select('+mfaPendingSecret +mfaSecret +mfaBackupCodes');
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    if (!user.mfaPendingSecret) {
      return sendError(res, 400, 'No MFA setup found. Start setup first.');
    }
    if (!verifyTotpCode(user.mfaPendingSecret, code)) {
      return sendError(res, 400, 'Invalid verification code');
    }

    const backupCodes = generateBackupCodes();
    user.mfaEnabled = true;
    user.mfaMethod = MFA_METHOD;
    user.mfaSecret = user.mfaPendingSecret;
    user.mfaPendingSecret = null;
    user.mfaBackupCodes = await hashBackupCodes(backupCodes);
    await user.save();

    return sendSuccess(res, 200, 'MFA enabled successfully', {
      ...mfaStatusPayload(user),
      backupCodes,
    });
  } catch (error) {
    console.error('MFA enable error:', error);
    return sendError(res, 500, 'Failed to enable MFA');
  }
});

router.post('/mfa/disable', verifyToken, async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) {
      return sendError(res, 400, 'Verification code is required');
    }

    const user = await User.findById(req.user?.id).select('+mfaPendingSecret +mfaSecret +mfaBackupCodes');
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    if (!user.mfaEnabled) {
      return sendError(res, 400, 'MFA is not enabled');
    }

    const verification = await verifyMfaCodeForUser(user, code, true);
    if (!verification.valid) {
      return sendError(res, 401, 'Invalid MFA code');
    }

    user.mfaEnabled = false;
    user.mfaMethod = null;
    user.mfaSecret = null;
    user.mfaPendingSecret = null;
    user.mfaBackupCodes = [];
    await user.save();

    return sendSuccess(res, 200, 'MFA disabled successfully', mfaStatusPayload(user));
  } catch (error) {
    console.error('MFA disable error:', error);
    return sendError(res, 500, 'Failed to disable MFA');
  }
});

router.post('/mfa/backup-codes/regenerate', verifyToken, async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) {
      return sendError(res, 400, 'Verification code is required');
    }

    const user = await User.findById(req.user?.id).select('+mfaSecret +mfaBackupCodes +mfaPendingSecret');
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    if (!user.mfaEnabled) {
      return sendError(res, 400, 'MFA is not enabled');
    }

    const verification = await verifyMfaCodeForUser(user, code, true);
    if (!verification.valid) {
      return sendError(res, 401, 'Invalid MFA code');
    }

    const backupCodes = generateBackupCodes();
    user.mfaBackupCodes = await hashBackupCodes(backupCodes);
    await user.save();

    return sendSuccess(res, 200, 'Backup codes regenerated', {
      ...mfaStatusPayload(user),
      backupCodes,
    });
  } catch (error) {
    console.error('MFA backup regeneration error:', error);
    return sendError(res, 500, 'Failed to regenerate backup codes');
  }
});

// Logout
router.post('/logout', verifyToken, async (req, res) => {
  // mark current session as ended
  const sessionId = req.user?.sessionId || req.cookies?.sessionId || req.body?.sessionId;
  if (sessionId) {
    try {
      const s = await Session.findById(sessionId);
      if (s && s.user.toString() === String(req.user?.id)) {
        s.endedAt = new Date();
        s.active = false;
        await s.save();
        disconnectSession(sessionId);
      }
    } catch (err) {
      console.warn('Failed to update session on logout', err);
    }
  }

  // clear cookies related to auth
  res.clearCookie('refreshToken', { ...cookieSecurityOptions, httpOnly: true });
  res.clearCookie('sessionId', { ...cookieSecurityOptions, httpOnly: true });
  res.clearCookie('csrfToken', { ...cookieSecurityOptions, httpOnly: false });
  res.clearCookie('token', { ...cookieSecurityOptions, httpOnly: true });
  res.status(200).json({ message: 'Logout successful' });
});

// Get user profile (requires authentication)
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user?.id).select(
      'firstName lastName email phoneNumber role status deletedAt redactedAt city country province barangay addressType address facebook profilePhotoName jobPosition companyName startDate endDate logoName resumeFileName resumeUrl avatarUrl about linkedin website totalExperience projectsCompleted jobsApplied successRate skills workExperience employerBalance workerBalance hideHiredCandidates verification'
    );
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    // Derive statistics for the response without making profile reads depend on a document save.
    const [jobsApplied, jobsCompleted] = await Promise.all([
      JobApplication.countDocuments({ applicant: req.user?.id }),
      JobApplication.countDocuments({ applicant: req.user?.id, status: 'Hired' }),
    ]);
    const successRate = jobsApplied > 0
      ? `${Math.round((jobsCompleted / jobsApplied) * 100)}%`
      : '0%';

    const profile = user.toObject();
    profile.jobsApplied = jobsApplied;
    profile.projectsCompleted = jobsCompleted;
    profile.successRate = successRate;

    if (
      user.jobsApplied !== jobsApplied ||
      user.projectsCompleted !== jobsCompleted ||
      user.successRate !== successRate
    ) {
      void User.updateOne(
        { _id: user._id },
        { $set: { jobsApplied, projectsCompleted: jobsCompleted, successRate } }
      ).catch((statsError) => {
        console.warn('Failed to cache profile statistics:', statsError?.message || statsError);
      });
    }

    return sendSuccess(res, 200, 'Profile retrieved', profile);
  } catch (error) {
    console.error('Get profile error:', error);
    return sendError(res, 500, 'Server error');
  }
};

const MAX_PROFILE_SKILLS = 50;
const MAX_WORK_EXPERIENCES = 25;
const MAX_SKILL_NAME_LENGTH = 80;
const MAX_SKILL_DESCRIPTION_LENGTH = 500;

const sendProfileMutationError = (res, error, fallbackMessage) => {
  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return sendError(res, 400, error?.message || 'Invalid profile data');
  }
  if (error?.name === 'VersionError') {
    return sendError(res, 409, 'Your profile changed in another request. Refresh and try again.');
  }
  return sendError(res, 500, fallbackMessage);
};

const normalizeSkillDescription = (value = '') => String(value || '').trim();

const parseExperienceDate = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}(?:-\d{2}(?:T.*)?)?$/.test(raw)) return null;
  const normalized = /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01T00:00:00.000Z` : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const normalizeExperience = (payload = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'Work experience must be a JSON object' };
  }
  for (const requiredField of ['title', 'company', 'startDate']) {
    if (typeof payload[requiredField] !== 'string' && !(requiredField === 'startDate' && payload[requiredField] instanceof Date)) {
      return { error: `${requiredField} must be a string` };
    }
  }
  for (const optionalField of ['location', 'description']) {
    if (payload[optionalField] !== undefined && payload[optionalField] !== null && typeof payload[optionalField] !== 'string') {
      return { error: `${optionalField} must be a string` };
    }
  }
  if (![true, false, 'true', 'false'].includes(payload.current)) {
    return { error: 'current must be a boolean' };
  }
  if (
    payload.endDate !== undefined &&
    payload.endDate !== null &&
    typeof payload.endDate !== 'string' &&
    !(payload.endDate instanceof Date)
  ) {
    return { error: 'endDate must be a string' };
  }
  const title = String(payload.title || '').trim();
  const company = String(payload.company || '').trim();
  const location = String(payload.location || '').trim();
  const description = String(payload.description || '').trim();
  const startDate = parseExperienceDate(payload.startDate);
  const current = payload.current === true || payload.current === 'true';
  const endDate = current ? null : parseExperienceDate(payload.endDate);

  if (!title) return { error: 'Job title is required' };
  if (!company) return { error: 'Company or client name is required' };
  if (title.length > 100) return { error: 'Job title must be 100 characters or fewer' };
  if (company.length > 120) return { error: 'Company or client name must be 120 characters or fewer' };
  if (location.length > 120) return { error: 'Location must be 120 characters or fewer' };
  if (description.length > 1000) return { error: 'Description must be 1000 characters or fewer' };
  if (!startDate) return { error: 'A valid start date is required' };
  if (!current && !endDate) return { error: 'End date is required unless this is your current role' };
  if (endDate && endDate < startDate) return { error: 'End date cannot be before start date' };
  const endOfToday = new Date();
  endOfToday.setUTCHours(23, 59, 59, 999);
  if (startDate > endOfToday) return { error: 'Start date cannot be in the future' };
  if (endDate && endDate > endOfToday) return { error: 'End date cannot be in the future' };

  return {
    value: { title, company, location, description, startDate, endDate, current },
  };
};

const addSkill = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { name, description, experience } = req.body || {};

    if (typeof name !== 'string' || !name.trim()) {
      return sendError(res, 400, 'Skill name is required');
    }
    const rawDescription = description ?? experience ?? '';
    if (typeof rawDescription !== 'string') {
      return sendError(res, 400, 'Skill description must be a string');
    }
    const skillName = name.trim();
    const skillDescription = normalizeSkillDescription(rawDescription);
    if (skillName.length > MAX_SKILL_NAME_LENGTH) {
      return sendError(res, 400, `Skill name must be ${MAX_SKILL_NAME_LENGTH} characters or fewer`);
    }
    if (skillDescription.length > MAX_SKILL_DESCRIPTION_LENGTH) {
      return sendError(res, 400, `Skill description must be ${MAX_SKILL_DESCRIPTION_LENGTH} characters or fewer`);
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    const existingSkill = user.skills?.find((s) => s.name.toLowerCase() === skillName.toLowerCase());
    if (existingSkill) {
      existingSkill.description = skillDescription;
      await user.save();
      return sendSuccess(res, 200, 'Skill description updated successfully', { skills: user.skills });
    }

    const newSkill = {
      name: skillName,
      description: skillDescription,
      endorsements: 0,
      createdAt: new Date(),
    };

    if (!user.skills) {
      user.skills = [];
    }
    if (user.skills.length >= MAX_PROFILE_SKILLS) {
      return sendError(res, 400, `You can add up to ${MAX_PROFILE_SKILLS} skills`);
    }
    user.skills.push(newSkill);
    await user.save();

    return sendSuccess(res, 201, 'Skill added successfully', { skills: user.skills });
  } catch (error) {
    console.error('Add skill error:', error);
    return sendProfileMutationError(res, error, 'Failed to add skill');
  }
};

const deleteSkill = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { skillId } = req.params;

    if (!mongoose.isValidObjectId(skillId)) {
      return sendError(res, 400, 'Invalid skill ID');
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    const skillIndex = user.skills?.findIndex((s) => s._id?.toString() === skillId);
    if (skillIndex === undefined || skillIndex === -1) {
      return sendError(res, 404, 'Skill not found');
    }

    user.skills.splice(skillIndex, 1);
    await user.save();

    return sendSuccess(res, 200, 'Skill deleted successfully', { skills: user.skills });
  } catch (error) {
    console.error('Delete skill error:', error);
    return sendProfileMutationError(res, error, 'Failed to delete skill');
  }
};

const updateSkillDescription = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { skillId } = req.params;
    const { description, experience } = req.body || {};

    if (!mongoose.isValidObjectId(skillId)) {
      return sendError(res, 400, 'Invalid skill ID');
    }
    const rawDescription = description ?? experience ?? '';
    if (typeof rawDescription !== 'string') {
      return sendError(res, 400, 'Skill description must be a string');
    }
    const normalizedDescription = normalizeSkillDescription(rawDescription);
    if (normalizedDescription.length > MAX_SKILL_DESCRIPTION_LENGTH) {
      return sendError(res, 400, `Skill description must be ${MAX_SKILL_DESCRIPTION_LENGTH} characters or fewer`);
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    const skill = user.skills?.find((s) => s._id?.toString() === skillId);
    if (!skill) {
      return sendError(res, 404, 'Skill not found');
    }

    skill.description = normalizedDescription;
    await user.save();

    return sendSuccess(res, 200, 'Skill description updated successfully', { skills: user.skills });
  } catch (error) {
    console.error('Update skill description error:', error);
    return sendProfileMutationError(res, error, 'Failed to update skill description');
  }
};

const addWorkExperience = async (req, res) => {
  try {
    const normalized = normalizeExperience(req.body);
    if (normalized.error) return sendError(res, 400, normalized.error);

    const user = await User.findById(req.user?.id);
    if (!user) return sendError(res, 404, 'User not found');

    user.workExperience = user.workExperience || [];
    if (user.workExperience.length >= MAX_WORK_EXPERIENCES) {
      return sendError(res, 400, `You can add up to ${MAX_WORK_EXPERIENCES} work experience entries`);
    }
    const duplicate = user.workExperience.some((item) =>
      item.title.toLowerCase() === normalized.value.title.toLowerCase() &&
      item.company.toLowerCase() === normalized.value.company.toLowerCase() &&
      item.startDate?.getTime() === normalized.value.startDate.getTime()
    );
    if (duplicate) {
      return sendError(res, 409, 'This work experience is already on your profile');
    }
    user.workExperience.push(normalized.value);
    await user.save();

    return sendSuccess(res, 201, 'Work experience added successfully', {
      workExperience: user.workExperience,
    });
  } catch (error) {
    console.error('Add work experience error:', error);
    return sendProfileMutationError(res, error, 'Failed to add work experience');
  }
};

const updateWorkExperience = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.experienceId)) {
      return sendError(res, 400, 'Invalid work experience ID');
    }
    const user = await User.findById(req.user?.id);
    if (!user) return sendError(res, 404, 'User not found');

    const experience = user.workExperience?.id(req.params.experienceId);
    if (!experience) return sendError(res, 404, 'Work experience not found');

    const normalized = normalizeExperience({ ...experience.toObject(), ...req.body });
    if (normalized.error) return sendError(res, 400, normalized.error);

    Object.assign(experience, normalized.value);
    await user.save();

    return sendSuccess(res, 200, 'Work experience updated successfully', {
      workExperience: user.workExperience,
    });
  } catch (error) {
    console.error('Update work experience error:', error);
    return sendProfileMutationError(res, error, 'Failed to update work experience');
  }
};

const deleteWorkExperience = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.experienceId)) {
      return sendError(res, 400, 'Invalid work experience ID');
    }
    const user = await User.findById(req.user?.id);
    if (!user) return sendError(res, 404, 'User not found');

    const experience = user.workExperience?.id(req.params.experienceId);
    if (!experience) return sendError(res, 404, 'Work experience not found');

    experience.deleteOne();
    await user.save();

    return sendSuccess(res, 200, 'Work experience deleted successfully', {
      workExperience: user.workExperience,
    });
  } catch (error) {
    console.error('Delete work experience error:', error);
    return sendProfileMutationError(res, error, 'Failed to delete work experience');
  }
};

// Resume upload handler
const uploadResume = async (req, res) => {
  let persisted = false;
  try {
    if (!req.file) {
      return sendError(res, 400, 'No file uploaded');
    }
    if (!hasValidResumeFileSignature(req.file)) {
      removeUploadFile(req.file.filename);
      return sendError(res, 400, 'Resume content does not match its PDF, DOC, or DOCX file type.');
    }

    const userId = req.user?.id;
    const user = await User.findById(userId);
    if (!user) {
      removeUploadFile(req.file.filename);
      return sendError(res, 404, 'User not found');
    }

    const previousResumeFileName = user.resumeFileName;

    // Update user with new resume info
    user.resumeFileName = req.file.filename;
    user.resumeUrl = `/uploads/${req.file.filename}`;
    await user.save();
    persisted = true;
    if (previousResumeFileName && previousResumeFileName !== req.file.filename) {
      removeUploadFile(previousResumeFileName);
    }

    return sendSuccess(res, 200, 'Resume uploaded successfully', {
      resumeUrl: user.resumeUrl,
      resumeFileName: user.resumeFileName,
    });
  } catch (error) {
    if (!persisted && req.file?.filename) removeUploadFile(req.file.filename);
    console.error('Resume upload error:', error);
    return sendError(res, 500, 'Failed to upload resume');
  }
};

// Resume delete handler
const deleteResume = async (req, res) => {
  try {
    const userId = req.user?.id;
    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    if (!user.resumeFileName) {
      return sendError(res, 400, 'No resume found');
    }

    const previousResumeFileName = user.resumeFileName;

    // Update user
    user.resumeFileName = null;
    user.resumeUrl = null;
    await user.save();
    removeUploadFile(previousResumeFileName);

    return sendSuccess(res, 200, 'Resume deleted successfully', {
      resumeUrl: null,
      resumeFileName: null,
    });
  } catch (error) {
    console.error('Resume delete error:', error);
    return sendError(res, 500, 'Failed to delete resume');
  }
};

// Avatar upload handler
const uploadAvatar = async (req, res) => {
  let persisted = false;
  try {
    if (!req.file) {
      return sendError(res, 400, 'No file uploaded');
    }
    if (!hasValidAvatarFileSignature(req.file)) {
      removeUploadFile(req.file.filename);
      return sendError(res, 400, 'Image content does not match its JPG, PNG, GIF, or WEBP file type.');
    }

    const userId = req.user?.id;
    const user = await User.findById(userId);
    if (!user) {
      removeUploadFile(req.file.filename);
      return sendError(res, 404, 'User not found');
    }

    const previousAvatarUrl = user.avatarUrl;

    // Update user with new avatar
    user.avatarUrl = `/uploads/${req.file.filename}`;
    await user.save();
    persisted = true;
    if (previousAvatarUrl && previousAvatarUrl !== user.avatarUrl) removeUploadFile(previousAvatarUrl);

    return sendSuccess(res, 200, 'Avatar uploaded successfully', {
      avatarUrl: user.avatarUrl,
    });
  } catch (error) {
    if (!persisted && req.file?.filename) removeUploadFile(req.file.filename);
    console.error('Avatar upload error:', error);
    return sendError(res, 500, 'Failed to upload avatar');
  }
};

// Avatar delete handler
const deleteAvatar = async (req, res) => {
  try {
    const userId = req.user?.id;
    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    if (!user.avatarUrl) {
      return sendError(res, 400, 'No avatar found');
    }

    const previousAvatarUrl = user.avatarUrl;

    // Update user
    user.avatarUrl = null;
    await user.save();
    removeUploadFile(previousAvatarUrl);

    return sendSuccess(res, 200, 'Avatar deleted successfully', {
      avatarUrl: null,
    });
  } catch (error) {
    console.error('Avatar delete error:', error);
    return sendError(res, 500, 'Failed to delete avatar');
  }
};

router.get(['/profile', '/me'], verifyToken, getProfile);
router.get('/profiles/:userId', verifyToken, getPublicProfile);
router.patch(['/profile', '/me'], verifyToken, updateMe);
router.post('/me/delete', verifyToken, requestSelfDelete);
router.post('/profile/avatar', verifyToken, uploadAvatarFile, uploadAvatar);
router.delete('/profile/avatar', verifyToken, deleteAvatar);
router.post('/profile/resume', verifyToken, uploadResumeFile, uploadResume);
router.delete('/profile/resume', verifyToken, deleteResume);
router.get('/files/:fileName/access-link', verifyToken, (req, res) => {
  const { fileName } = req.params;
  if (!isSafeUploadFileName(fileName)) {
    return sendError(res, 400, 'Invalid file name');
  }

  const downloadToken = jwt.sign(
    {
      userId: req.user.id,
      role: req.user.role,
      sessionId: req.user.sessionId,
      purpose: 'upload-download',
      fileName,
    },
    getJwtSecret(),
    { expiresIn: '2m' }
  );
  return sendSuccess(res, 200, 'Temporary file link created', {
    url: `/uploads/${encodeURIComponent(fileName)}?downloadToken=${encodeURIComponent(downloadToken)}`,
  });
});
router.post('/profile/skills', verifyToken, addSkill);
router.delete('/profile/skills/:skillId', verifyToken, deleteSkill);
router.patch('/profile/skills/:skillId', verifyToken, updateSkillDescription);
router.post('/profile/experience', verifyToken, addWorkExperience);
router.patch('/profile/experience/:experienceId', verifyToken, updateWorkExperience);
router.delete('/profile/experience/:experienceId', verifyToken, deleteWorkExperience);

// Verification endpoints
router.get('/verification/status', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('verification email phoneNumber status');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const steps = [
      {
        id: 'email',
        title: 'Email address',
        description: 'Confirm the email you use to sign in and receive alerts.',
        status: user.verification?.emailVerified ? 'complete' : 'pending',
      },
      {
        id: 'phone',
        title: 'Phone number',
        description: 'Add a verified phone for account recovery and security checks.',
        status: user.verification?.phoneVerified ? 'complete' : user.phoneNumber ? 'in-review' : 'pending',
      },
      {
        id: 'identity',
        title: 'Government ID',
        description: user.verification?.identityDocument?.status === 'rejected'
          ? `Rejected: ${user.verification?.identityDocument?.rejectionReason || 'Please upload a clearer valid ID.'}`
          : 'Upload a valid ID to prove your identity.',
        status: user.verification?.identityDocument?.status || 'pending',
      },
      {
        id: 'address',
        title: 'Proof of address',
        description: user.verification?.addressDocument?.status === 'rejected'
          ? `Rejected: ${user.verification?.addressDocument?.rejectionReason || 'Please upload a valid recent document.'}`
          : 'Provide a recent utility bill or bank statement.',
        status: user.verification?.addressDocument?.status || 'pending',
      },
    ];

    const completedSteps = steps.filter((step) => step.status === 'complete').length;
    const completionPercent = Math.round((completedSteps / steps.length) * 100);

    return res.status(200).json({
      steps,
      completedSteps,
      completionPercent,
    });
  } catch (err) {
    console.error('Get verification status error', err);
    return res.status(500).json({ message: 'Failed to get verification status' });
  }
});

router.post('/verification/phone', verifyToken, verificationPhoneSendLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('phoneNumber verification.phoneVerified');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.phoneNumber) {
      return res.status(400).json({ message: 'Please add a phone number in your profile first' });
    }

    if (user.verification?.phoneVerified) {
      return res.status(200).json({ message: 'Phone already verified.', verified: true });
    }

    const otpResult = await sendPhoneVerificationOtp({
      userId: String(user._id),
      phoneNumber: user.phoneNumber,
    });

    return res.status(200).json(otpResult);
  } catch (err) {
    if (err instanceof PhoneOtpError) {
      const retryAfterSec = err?.metadata?.retryAfterSec;
      if (retryAfterSec) {
        res.setHeader('Retry-After', String(retryAfterSec));
      }
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
    console.error('Phone verification error', err);
    return res.status(500).json({ message: 'Failed to start phone verification' });
  }
});

router.post('/verification/phone/confirm', verifyToken, verificationPhoneConfirmLimiter, async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) {
      return res.status(400).json({ message: 'Verification code is required.' });
    }

    const user = await User.findById(req.user.id).select('phoneNumber verification.phoneVerified');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.phoneNumber) {
      return res.status(400).json({ message: 'Please add a phone number in your profile first' });
    }

    if (user.verification?.phoneVerified) {
      return res.status(200).json({ message: 'Phone already verified.', verified: true });
    }

    verifyPhoneVerificationOtp({
      userId: String(user._id),
      phoneNumber: user.phoneNumber,
      code,
    });

    user.verification = user.verification || {};
    user.verification.phoneVerified = true;
    await user.save();

    return res.status(200).json({ message: 'Phone verification completed', verified: true });
  } catch (err) {
    if (err instanceof PhoneOtpError) {
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
    console.error('Phone verification confirm error', err);
    return res.status(500).json({ message: 'Failed to verify phone' });
  }
});

router.post('/verification/documents/identity', verifyToken, uploadVerificationFile, async (req, res) => {
  let persisted = false;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No document file provided' });
    }
    if (!hasValidVerificationFileSignature(req.file)) {
      removeUploadFile(req.file.filename);
      return res.status(400).json({ message: 'The uploaded file content does not match its document type.' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      removeUploadFile(req.file.filename);
      return res.status(404).json({ message: 'User not found' });
    }

    const documentUrl = `/uploads/${req.file.filename}`;
    const previousDocumentUrl = user.verification?.identityDocument?.documentUrl;
    user.verification = user.verification || {};
    user.verification.identityVerified = false;
    user.verification.identityDocument = {
      status: 'in-review',
      documentUrl,
      uploadedAt: new Date(),
    };
    await user.save();
    persisted = true;
    if (previousDocumentUrl && previousDocumentUrl !== documentUrl) removeUploadFile(previousDocumentUrl);

    return res.status(200).json({
      message: 'Identity document uploaded successfully',
      documentUrl,
      status: 'in-review',
    });
  } catch (err) {
    if (!persisted && req.file?.filename) removeUploadFile(req.file.filename);
    console.error('Identity document upload error', err);
    return res.status(500).json({ message: 'Failed to upload identity document' });
  }
});

router.post('/verification/documents/address', verifyToken, uploadVerificationFile, async (req, res) => {
  let persisted = false;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No document file provided' });
    }
    if (!hasValidVerificationFileSignature(req.file)) {
      removeUploadFile(req.file.filename);
      return res.status(400).json({ message: 'The uploaded file content does not match its document type.' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      removeUploadFile(req.file.filename);
      return res.status(404).json({ message: 'User not found' });
    }

    const documentUrl = `/uploads/${req.file.filename}`;
    const previousDocumentUrl = user.verification?.addressDocument?.documentUrl;
    user.verification = user.verification || {};
    user.verification.addressVerified = false;
    user.verification.addressDocument = {
      status: 'in-review',
      documentUrl,
      uploadedAt: new Date(),
    };
    await user.save();
    persisted = true;
    if (previousDocumentUrl && previousDocumentUrl !== documentUrl) removeUploadFile(previousDocumentUrl);

    return res.status(200).json({
      message: 'Address document uploaded successfully',
      documentUrl,
      status: 'in-review',
    });
  } catch (err) {
    if (!persisted && req.file?.filename) removeUploadFile(req.file.filename);
    console.error('Address document upload error', err);
    return res.status(500).json({ message: 'Failed to upload address document' });
  }
});

export default router;
