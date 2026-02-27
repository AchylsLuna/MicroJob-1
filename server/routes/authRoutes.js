import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import csrfProtection from '../middleware/csrf.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import verifyToken from '../middleware/auth.js';
import { sendOtp, verifyOtp, updateMe } from '../controllers/UserController.js';
import {
  isValidPhone,
  normalizeEmail,
  normalizePhone,
  PHONE_VALIDATION_MESSAGE,
} from '../lib/authValidation.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../lib/passwordPolicy.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';
import { getJwtSecret } from '../lib/jwtSecret.js';

const router = express.Router();
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
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await Session.create({
    user: user._id,
    userAgent: req.get('User-Agent') || '',
    ip: requestIp,
    active: true,
    expiresAt,
  });

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

const buildLoginPayload = (user, includePhone = false) => ({
  id: user._id,
  ...(includePhone ? { phoneNumber: user.phoneNumber } : {}),
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role || 'work',
});

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
    const sessions = await Session.find({ user: req.user.id }).select('-refreshTokenHash -token');
    return res.status(200).json({ sessions });
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
    s.active = false;
    s.endedAt = new Date();
    await s.save();
    return res.status(200).json({ message: 'Session revoked' });
  } catch (err) {
    console.error('Revoke session error', err);
    return res.status(500).json({ message: 'Failed to revoke session' });
  }
});

// Revoke all sessions for current user (sign out everywhere)
router.delete('/sessions', verifyToken, async (req, res) => {
  try {
    await Session.updateMany({ user: req.user.id, active: true }, { active: false, endedAt: new Date() });
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
      '-passwordHashed -mfaSecret -mfaPendingSecret -mfaBackupCodes'
    );
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    return sendSuccess(res, 200, 'Profile retrieved', user);
  } catch (error) {
    console.error('Get profile error:', error);
    return sendError(res, 500, 'Server error');
  }
};

router.get(['/profile', '/me'], verifyToken, getProfile);
router.patch(['/profile', '/me'], verifyToken, updateMe);

export default router;
