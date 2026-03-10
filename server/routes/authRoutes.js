import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import csrfProtection from '../middleware/csrf.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import JobApplication from '../models/JobApplication.js';
import verifyToken from '../middleware/auth.js';
import {
  sendOtp,
  verifyOtp,
  updateMe,
  getPublicProfile,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  requestPasswordChangeOtp,
  changePasswordWithOtp,
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
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../lib/passwordPolicy.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';
import { getJwtSecret } from '../lib/jwtSecret.js';

const router = express.Router();

// Setup multer for file uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uploadsDir = join(__dirname, '..', 'uploads');

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
    const ext = file.originalname.split('.').pop();
    cb(null, `resume_${userId}_${timestamp}.${ext}`);
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
    const ext = file.originalname.split('.').pop();
    cb(null, `avatar_${userId}_${timestamp}.${ext}`);
  },
});

// Multer for resume uploads (PDF, DOC, DOCX)
const multerResume = multer({
  storage: resumeStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (allowed.includes(ext)) {
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
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, GIF, and WEBP images are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const SELF_SERVICE_ROLES = new Set(['hire', 'work', 'both']);
const cookieSecurityOptions = {
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
};

const normalizeUsername = (value = '') => String(value).trim().replace(/\s+/g, ' ').toLowerCase();
const normalizeDisplayName = (value = '') => String(value).trim().replace(/\s+/g, ' ');
const MFA_LOGIN_PURPOSE = 'mfa-login';
const MFA_METHOD = 'authenticator';
const MFA_CHALLENGE_TTL = '5m';
const MFA_BACKUP_CODES_COUNT = 8;

const createAccessToken = (user, sessionId) =>
  jwt.sign(
    { userId: user._id, role: user.role || 'user', sessionId },
    getJwtSecret(),
    { expiresIn: '15m' }
  );

const createSessionWithTokens = async (req, user) => {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '');
  const requestIp = forwardedFor.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const userAgent = req.get('User-Agent') || '';
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  session.token = accessToken;
  session.refreshTokenHash = refreshHash;
  await session.save();

  return {
    accessToken,
    refreshToken,
    expiresAt,
    sessionId: session._id.toString(),
    session,
  };
};

const setSessionCookies = (res, { refreshToken, sessionId, expiresAt, csrfToken }) => {
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
    linkedin: user.linkedin,
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

// Register a new user (supports both email/username and phone-based registration)
router.post('/register', async (req, res) => {
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

router.post('/otp/send', sendOtp);
router.post('/otp/verify', verifyOtp);
router.post('/password-reset/request', requestPasswordResetOtp);
router.post('/password-reset/confirm', resetPasswordWithOtp);
router.post('/password-change/request', verifyToken, requestPasswordChangeOtp);
router.post('/password-change/confirm', verifyToken, changePasswordWithOtp);

// Login an existing user (supports email/username and phone)
// Apply a login rate limiter to mitigate brute-force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 6, // limit each IP to 6 login requests per windowMs
  message: { message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { emailOrUsername, password, phoneNumber } = req.body;
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
      user = await User.findOne({ phoneNumber: normalizedPhone });
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
      });
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
    } catch (error) {
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
    session.token = newAccess;
    session.refreshTokenHash = newHash;
    // extend session expiry by 7 days from now
    session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await session.save();

    // set cookies
    setSessionCookies(res, {
      refreshToken: newRefresh,
      sessionId: session._id.toString(),
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
    return res.status(200).json({ message: 'Session revoked' });
  } catch (err) {
    console.error('Revoke session error', err);
    return res.status(500).json({ message: 'Failed to revoke session' });
  }
});

// Revoke all sessions for current user (sign out everywhere)
router.delete('/sessions', verifyToken, async (req, res) => {
  try {
    // Delete all sessions except the current one
    await Session.deleteMany({ 
      user: req.user.id, 
      _id: { $ne: req.user.sessionId } 
    });
    
    // Also delete current session to log out
    if (req.user.sessionId) {
      await Session.findByIdAndDelete(req.user.sessionId);
    }
    
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
      'firstName lastName email phoneNumber role city country province address facebook profilePhotoName jobPosition companyName startDate endDate logoName resumeFileName resumeUrl avatarUrl about linkedin totalExperience projectsCompleted jobsApplied successRate skills employerBalance workerBalance'
    );
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    // Auto-calculate job statistics from JobApplication collection
    const jobsApplied = await JobApplication.countDocuments({ applicant: req.user?.id });
    const jobsCompleted = await JobApplication.countDocuments({ 
      applicant: req.user?.id, 
      status: 'Hired' 
    });
    const successRate = jobsApplied > 0 
      ? `${Math.round((jobsCompleted / jobsApplied) * 100)}%` 
      : '0%';

    // Update user with calculated stats
    user.jobsApplied = jobsApplied;
    user.projectsCompleted = jobsCompleted;
    user.successRate = successRate;
    
    // Save the updated stats to database
    await user.save();

    return sendSuccess(res, 200, 'Profile retrieved', user);
  } catch (error) {
    console.error('Get profile error:', error);
    return sendError(res, 500, 'Server error');
  }
};

const addSkill = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { name, level } = req.body || {};

    if (!name || !name.trim()) {
      return sendError(res, 400, 'Skill name is required');
    }

    const validLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
    const skillLevel = level && validLevels.includes(level) ? level : 'Intermediate';

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    // Check if skill already exists
    const existingSkill = user.skills?.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (existingSkill) {
      return sendError(res, 400, 'Skill already exists');
    }

    const newSkill = {
      name: name.trim(),
      level: skillLevel,
      endorsements: 0,
      createdAt: new Date(),
    };

    if (!user.skills) {
      user.skills = [];
    }
    user.skills.push(newSkill);
    await user.save();

    return sendSuccess(res, 201, 'Skill added successfully', { data: { skills: user.skills } });
  } catch (error) {
    console.error('Add skill error:', error);
    return sendError(res, 500, 'Failed to add skill');
  }
};

const deleteSkill = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { skillId } = req.params;

    if (!skillId) {
      return sendError(res, 400, 'Skill ID is required');
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

    return sendSuccess(res, 200, 'Skill deleted successfully', { data: { skills: user.skills } });
  } catch (error) {
    console.error('Delete skill error:', error);
    return sendError(res, 500, 'Failed to delete skill');
  }
};

const updateSkillLevel = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { skillId } = req.params;
    const { level } = req.body || {};

    if (!skillId) {
      return sendError(res, 400, 'Skill ID is required');
    }

    const validLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
    if (!level || !validLevels.includes(level)) {
      return sendError(res, 400, 'Invalid proficiency level');
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    const skill = user.skills?.find((s) => s._id?.toString() === skillId);
    if (!skill) {
      return sendError(res, 404, 'Skill not found');
    }

    skill.level = level;
    await user.save();

    return sendSuccess(res, 200, 'Skill level updated successfully', { skills: user.skills });
  } catch (error) {
    console.error('Update skill level error:', error);
    return sendError(res, 500, 'Failed to update skill level');
  }
};

// Resume upload handler
const uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'No file uploaded');
    }

    const userId = req.user?.id;
    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    // Delete old resume file if exists
    if (user.resumeFileName) {
      const oldFile = join(uploadsDir, user.resumeFileName);
      if (fs.existsSync(oldFile)) {
        fs.unlinkSync(oldFile);
      }
    }

    // Update user with new resume info
    user.resumeFileName = req.file.filename;
    user.resumeUrl = `/uploads/${req.file.filename}`;
    await user.save();

    return sendSuccess(res, 200, 'Resume uploaded successfully', {
      data: {
        resumeUrl: user.resumeUrl,
        resumeFileName: user.resumeFileName,
      },
    });
  } catch (error) {
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

    // Delete resume file
    const filePath = join(uploadsDir, user.resumeFileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Update user
    user.resumeFileName = null;
    user.resumeUrl = null;
    await user.save();

    return sendSuccess(res, 200, 'Resume deleted successfully', {
      data: {
        resumeUrl: null,
        resumeFileName: null,
      },
    });
  } catch (error) {
    console.error('Resume delete error:', error);
    return sendError(res, 500, 'Failed to delete resume');
  }
};

// Avatar upload handler
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'No file uploaded');
    }

    const userId = req.user?.id;
    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    // Delete old avatar file if exists
    if (user.avatarUrl) {
      const oldFileName = user.avatarUrl.split('/').pop();
      const oldFile = join(uploadsDir, oldFileName);
      if (fs.existsSync(oldFile)) {
        fs.unlinkSync(oldFile);
      }
    }

    // Update user with new avatar
    user.avatarUrl = `/uploads/${req.file.filename}`;
    await user.save();

    return sendSuccess(res, 200, 'Avatar uploaded successfully', {
      data: {
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
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

    // Delete avatar file
    const fileName = user.avatarUrl.split('/').pop();
    const filePath = join(uploadsDir, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Update user
    user.avatarUrl = null;
    await user.save();

    return sendSuccess(res, 200, 'Avatar deleted successfully', {
      data: {
        avatarUrl: null,
      },
    });
  } catch (error) {
    console.error('Avatar delete error:', error);
    return sendError(res, 500, 'Failed to delete avatar');
  }
};

router.get(['/profile', '/me'], verifyToken, getProfile);
router.get('/profiles/:userId', verifyToken, getPublicProfile);
router.patch(['/profile', '/me'], verifyToken, updateMe);
router.post('/profile/avatar', verifyToken, multerAvatar.single('avatar'), uploadAvatar);
router.delete('/profile/avatar', verifyToken, deleteAvatar);
router.post('/profile/resume', verifyToken, multerResume.single('resume'), uploadResume);
router.delete('/profile/resume', verifyToken, deleteResume);
router.post('/profile/skills', verifyToken, addSkill);
router.delete('/profile/skills/:skillId', verifyToken, deleteSkill);
router.patch('/profile/skills/:skillId', verifyToken, updateSkillLevel);

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
        status: user.status === 'active' ? 'complete' : user.status === 'pending' ? 'pending' : 'pending',
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
        description: 'Upload a valid ID to prove your identity.',
        status: user.verification?.identityDocument?.status || 'pending',
      },
      {
        id: 'address',
        title: 'Proof of address',
        description: 'Provide a recent utility bill or bank statement.',
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

router.post('/verification/phone', verifyToken, async (req, res) => {
  try {
    // This would typically send an OTP to the phone number
    // For now, we'll just mark it as verified
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.phoneNumber) {
      return res.status(400).json({ message: 'Please add a phone number in your profile first' });
    }

    user.verification = user.verification || {};
    user.verification.phoneVerified = true;
    await user.save();

    return res.status(200).json({ message: 'Phone verification completed', verified: true });
  } catch (err) {
    console.error('Phone verification error', err);
    return res.status(500).json({ message: 'Failed to verify phone' });
  }
});

router.post('/verification/documents/identity', verifyToken, multerAvatar.single('document'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!req.file) {
      return res.status(400).json({ message: 'No document file provided' });
    }

    const documentUrl = `/uploads/${req.file.filename}`;
    user.verification = user.verification || {};
    user.verification.identityDocument = {
      status: 'in-review',
      documentUrl,
      uploadedAt: new Date(),
    };
    await user.save();

    return res.status(200).json({
      message: 'Identity document uploaded successfully',
      documentUrl,
      status: 'in-review',
    });
  } catch (err) {
    console.error('Identity document upload error', err);
    return res.status(500).json({ message: 'Failed to upload identity document' });
  }
});

router.post('/verification/documents/address', verifyToken, multerAvatar.single('document'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!req.file) {
      return res.status(400).json({ message: 'No document file provided' });
    }

    const documentUrl = `/uploads/${req.file.filename}`;
    user.verification = user.verification || {};
    user.verification.addressDocument = {
      status: 'in-review',
      documentUrl,
      uploadedAt: new Date(),
    };
    await user.save();

    return res.status(200).json({
      message: 'Address document uploaded successfully',
      documentUrl,
      status: 'in-review',
    });
  } catch (err) {
    console.error('Address document upload error', err);
    return res.status(500).json({ message: 'Failed to upload address document' });
  }
});

export default router;
