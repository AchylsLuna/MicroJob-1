import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import csrfProtection from '../middleware/csrf.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import verifyToken from '../middleware/auth.js';

const router = express.Router();

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
      return res.status(400).json({ message: 'Password is required' });
    }

    // Phone-based registration (primary)
    if (phoneNumber && firstName && lastName) {
      if (!/^\d{10,15}$/.test(phoneNumber)) {
        return res.status(400).json({ message: 'Phone number must be 10-15 digits' });
      }

      const existingUser = await User.findOne({ phoneNumber });
      if (existingUser) {
        return res.status(409).json({ message: 'Phone number is already registered' });
      }

      const user = await User.create({
        phoneNumber,
        firstName,
        lastName,
        password,
        email: email?.toLowerCase() || null,
        role: userRole,
        status: 'pending',
      });

      return res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user._id,
          phoneNumber: user.phoneNumber,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        },
      });
    }

    // Email/username-based registration (fallback)
    if (!username || !email) {
      return res.status(400).json({ message: 'Username, email, or phone number with firstName and lastName are required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Split username into firstName and lastName
    const nameParts = username.trim().split(' ');
    const userFirstName = nameParts[0] || username;
    const userLastName = nameParts.slice(1).join(' ') || nameParts[0];

    const user = await User.create({
      firstName: userFirstName,
      lastName: userLastName,
      email: email.toLowerCase(),
      password,
      role: userRole,
      status: 'pending',
    });

    return res.status(201).json({
      message: 'User registered successfully',
      user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Server error during registration' });
  }
});

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

    // Phone-based login
    if (phoneNumber) {
      if (!password) {
        return res.status(400).json({ message: 'Password is required' });
      }

      const user = await User.findOne({ phoneNumber });

      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ message: 'Invalid phone number or password' });
      }

      if (user.status && user.status !== 'active') {
        return res.status(401).json({ message: 'Account is disabled. Contact an admin.' });
      }

      // create session first
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const session = await Session.create({
        user: user._id,
        userAgent: req.get('User-Agent') || '',
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
        active: true,
        expiresAt,
      });

      // short-lived access token (15 minutes) that includes sessionId
      const accessToken = jwt.sign(
        { userId: user._id, role: user.role || 'user', sessionId: session._id.toString() },
        process.env.JWT_SECRET || 'dev-secret',
        { expiresIn: '15m' }
      );

      // create a refresh token (random) and store its hash in DB
      const refreshToken = crypto.randomBytes(64).toString('hex');
      const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      session.token = accessToken;
      session.refreshTokenHash = refreshHash;
      await session.save();

      // set cookies
      // `csrfToken` is intentionally NOT httpOnly so client JS can read it and include in `x-csrf-token` header
      const csrfToken = crypto.randomBytes(24).toString('hex');
      res.cookie('csrfToken', csrfToken, { httpOnly: false, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', expires: expiresAt });
      res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', expires: expiresAt });
      res.cookie('sessionId', session._id.toString(), { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', expires: expiresAt });

      return res.status(200).json({
        message: 'Login successful',
        token: accessToken,
        user: {
          id: user._id,
          phoneNumber: user.phoneNumber,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role || 'work',
        },
      });
    }

    // Email/username-based login
    if (!emailOrUsername || !password) {
      return res.status(400).json({ message: 'Email/username and password are required' });
    }

    const user = await User.findOne({
      $or: [
        { email: emailOrUsername.toLowerCase() },
        { username: emailOrUsername },
      ],
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.status && user.status !== 'active') {
      return res.status(401).json({ message: 'Account is disabled. Contact an admin.' });
    }

    // create session first
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const session = await Session.create({
      user: user._id,
      userAgent: req.get('User-Agent') || '',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
      active: true,
      expiresAt,
    });

    // short-lived access token (15 minutes) that includes sessionId
    const accessToken = jwt.sign(
      { userId: user._id, role: user.role || 'user', sessionId: session._id.toString() },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '15m' }
    );

    // create a refresh token (random) and store its hash in DB
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    session.token = accessToken;
    session.refreshTokenHash = refreshHash;
    await session.save();

    // set cookies
    const csrfToken = crypto.randomBytes(24).toString('hex');
    res.cookie('csrfToken', csrfToken, { httpOnly: false, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', expires: expiresAt });
    res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', expires: expiresAt });
    res.cookie('sessionId', session._id.toString(), { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', expires: expiresAt });

    return res.status(200).json({
      message: 'Login successful',
      token: accessToken,
      user: { 
        id: user._id, 
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role || 'work',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error during login' });
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
    const newAccess = jwt.sign({ userId: user._id, role: user.role || 'user', sessionId: session._id.toString() }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '15m' });

    // rotate refresh token
    const newRefresh = crypto.randomBytes(64).toString('hex');
    const newHash = crypto.createHash('sha256').update(newRefresh).digest('hex');
    session.token = newAccess;
    session.refreshTokenHash = newHash;
    // extend session expiry by 7 days from now
    session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await session.save();

    // set cookies
    res.cookie('refreshToken', newRefresh, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', expires: session.expiresAt });
    res.cookie('sessionId', session._id.toString(), { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', expires: session.expiresAt });

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
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
