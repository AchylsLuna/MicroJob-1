import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import csrfProtection from '../middleware/csrf.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import verifyToken from '../middleware/auth.js';
import { sendOtp, verifyOtp, updateMe } from '../controllers/UserController.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../lib/passwordPolicy.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';
import { getJwtSecret } from '../lib/jwtSecret.js';

const router = express.Router();
const jwtSecret = getJwtSecret();

const createAccessToken = (user, sessionId) =>
  jwt.sign(
    { userId: user._id, role: user.role || 'user', sessionId },
    jwtSecret,
    { expiresIn: '15m' }
  );

const createSessionWithTokens = async (req, user) => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await Session.create({
    user: user._id,
    userAgent: req.get('User-Agent') || '',
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
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
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt,
    });
  }

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
  });
  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
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

// Register a new user (supports both email/username and phone-based registration)
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, phoneNumber, firstName, lastName, role } = req.body;

    // Validate role
    const validRoles = ['hire', 'work', 'both', 'admin', 'superadmin'];
    const userRole = role && validRoles.includes(role) ? role : 'work';
    console.log('Register - User role being set to:', userRole);

    // Flexible validation - support both email-based and phone-based registration
    if (!password) {
      return sendError(res, 400, 'Password is required');
    }
    if (!isStrongPassword(password)) {
      return sendError(res, 400, PASSWORD_POLICY_MESSAGE);
    }

    // Phone-based registration (primary)
    if (phoneNumber && firstName && lastName) {
      if (!/^\d{10,15}$/.test(phoneNumber)) {
        return sendError(res, 400, 'Phone number must be 10-15 digits');
      }

      const existingUser = await User.findOne({ phoneNumber });
      if (existingUser) {
        return sendError(res, 409, 'Phone number is already registered');
      }

      const user = new User({
        phoneNumber,
        firstName,
        lastName,
        email: email?.toLowerCase() || null,
        role: userRole,
        status: 'pending',
      });
      await user.setPassword(password);
      await user.save();

      const userPayload = {
        id: user._id,
        phoneNumber: user.phoneNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      };
      return sendSuccess(
        res,
        201,
        'User registered successfully',
        { user: userPayload },
        { user: userPayload }
      );
    }

    // Email/username-based registration (fallback)
    if (!username || !email) {
      return sendError(res, 400, 'Username, email, or phone number with firstName and lastName are required');
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return sendError(res, 409, 'User already exists');
    }

    // Split username into firstName and lastName
    const nameParts = username.trim().split(' ');
    const userFirstName = nameParts[0] || username;
    const userLastName = nameParts.slice(1).join(' ') || nameParts[0];

    const user = new User({
      firstName: userFirstName,
      lastName: userLastName,
      email: email.toLowerCase(),
      role: userRole,
      status: 'pending',
    });
    await user.setPassword(password);
    await user.save();

    const userPayload = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    };
    return sendSuccess(
      res,
      201,
      'User registered successfully',
      { user: userPayload },
      { user: userPayload }
    );
  } catch (error) {
    if (error instanceof Error && error.message === PASSWORD_POLICY_MESSAGE) {
      return sendError(res, 400, PASSWORD_POLICY_MESSAGE);
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

    if (phoneNumber) {
      includePhone = true;
      invalidMessage = 'Invalid phone number or password';
      user = await User.findOne({ phoneNumber });
    } else {
      if (!emailOrUsername) {
        return sendError(res, 400, 'Email/username and password are required');
      }
      user = await User.findOne({
        $or: [
          { email: emailOrUsername.toLowerCase() },
          { username: emailOrUsername },
        ],
      });
    }

    if (!user || !(await user.validatePassword(password))) {
      return sendError(res, 401, invalidMessage);
    }

    if (user.status && user.status !== 'active') {
      return sendError(res, 401, 'Account is disabled. Contact an admin.');
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
      { token: authSession.accessToken, user: userPayload },
      { token: authSession.accessToken, user: userPayload }
    );
  } catch (error) {
    console.error('Login error:', error);
    return sendError(res, 500, 'Server error during login');
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
    const sessions = await Session.find({ user: req.user.userId }).select('-refreshTokenHash -token');
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
    if (s.user.toString() !== req.user.userId) return res.status(403).json({ message: 'Not authorized' });
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
    await Session.updateMany({ user: req.user.userId, active: true }, { active: false, endedAt: new Date() });
    // clear cookies
    res.clearCookie('refreshToken');
    res.clearCookie('sessionId');
    res.clearCookie('csrfToken');
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

// Logout
router.post('/logout', verifyToken, async (req, res) => {
  // mark session as ended if sessionId cookie or body present
  const sessionId = req.cookies?.sessionId || req.body?.sessionId;
  if (sessionId) {
    try {
      const s = await Session.findById(sessionId);
      if (s) {
        s.endedAt = new Date();
        s.active = false;
        await s.save();
      }
    } catch (err) {
      console.warn('Failed to update session on logout', err);
    }
  }

  // clear cookies related to auth
  res.clearCookie('sessionId', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  res.clearCookie('token', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  res.status(200).json({ message: 'Logout successful' });
});

// Get user profile (requires authentication)
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const user = await User.findById(userId).select('-passwordHashed');
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    return sendSuccess(res, 200, 'Profile retrieved', user, { user });
  } catch (error) {
    console.error('Get profile error:', error);
    return sendError(res, 500, 'Server error');
  }
});

router.patch('/profile', verifyToken, updateMe);

export default router;
