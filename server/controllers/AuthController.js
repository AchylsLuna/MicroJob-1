import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';
import { getJwtSecret } from '../lib/jwtSecret.js';
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
import {
  buildLoginPayload,
  buildAuthTokensPayload,
  createSessionWithTokens,
  setSessionCookies,
  normalizeUsername,
  normalizeDisplayName,
} from '../lib/authSession.js';
import {
  createMfaChallengeToken,
  issueLoginOtpChallenge,
  LOGIN_OTP_PURPOSE,
  MFA_LOGIN_PURPOSE,
  MFA_METHOD,
  verifyMfaCodeForUser,
} from '../lib/mfaHelpers.js';
import { getOtpChallenge, verifyOtpChallenge } from '../lib/otpChallenges.js';
import { SELF_SERVICE_ROLES } from './SessionController.js';

const googleClient = new OAuth2Client();

const registerUser = async (req, res) => {
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
    return sendSuccess(res, 201, 'User registered successfully', { user: userPayload });
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
      const validationMessage = firstValidation?.message || 'Please check your inputs and try again.';
      return sendError(res, 400, `Invalid input: ${validationMessage}`);
    }
    console.error('Register error:', error);
    return sendError(res, 500, 'Server error during registration');
  }
};

// A real bcrypt hash (of a value nothing can log in with) compared against
// when no account matches, purely to keep the failure path's timing constant.
const ENUMERATION_TIMING_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

const loginUser = async (req, res) => {
  try {
    const { emailOrUsername, password, phoneNumber, requireOtp } = req.body;
    if (!password) {
      return sendError(res, 400, 'Password is required');
    }

    let user;
    let includePhone = false;
    const normalizedPhone = normalizePhone(phoneNumber || '');

    if (normalizedPhone) {
      if (!isValidPhone(normalizedPhone)) {
        return sendError(res, 400, PHONE_VALIDATION_MESSAGE);
      }
      includePhone = true;
      user = await User.findOne({ phoneNumber: normalizedPhone }).select('+passwordHashed +failedLoginAttempts +loginLockCount +lockUntil');
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
      }).select('+passwordHashed +failedLoginAttempts +loginLockCount +lockUntil');
    }

    // One generic message for both "no such account" and "wrong password".
    // Distinct messages let an unauthenticated caller confirm which emails and
    // phone numbers are registered (OWASP ASVS 3.2.2) — the same reason
    // requestPasswordResetOtp returns PASSWORD_RESET_GENERIC_MESSAGE.
    const invalidMessage = includePhone
      ? 'The phone number or password is incorrect. Please try again.'
      : 'The email, username, or password is incorrect. Please try again.';

    if (!user) {
      // Spend the same bcrypt work as the wrong-password path, so a missing
      // account cannot be identified by how quickly the request comes back.
      await bcrypt.compare(password, ENUMERATION_TIMING_HASH);
      return sendError(res, 401, invalidMessage);
    }
    // Checked after the account lookup but before bcrypt, so a locked account
    // costs an attacker the same round trip as any other rejection. The reply
    // is deliberately `invalidMessage` rather than a "your account is locked"
    // string: a distinct message would confirm the account exists, undoing the
    // enumeration defense the timing hash above exists to provide. The lock
    // lifts on its own (see lib/loginLockout.js), so a genuine user who
    // mistyped their password gets back in by waiting rather than by asking
    // support.
    if (user.isLoginLocked()) {
      return sendError(res, 401, invalidMessage);
    }

    if (!(await user.validatePassword(password))) {
      await user.registerFailedLogin();
      return sendError(res, 401, invalidMessage);
    }

    await user.clearLoginLock();

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
      return sendSuccess(res, 200, 'OTP verification required', {
        otpRequired: true,
        otpToken: loginOtp.otpToken,
      });
    }

    if (user.mfaEnabled) {
      const mfaToken = createMfaChallengeToken(String(user._id), includePhone);
      return sendSuccess(res, 200, 'MFA verification required', {
        mfaRequired: true,
        mfaToken,
        method: user.mfaMethod || MFA_METHOD,
      });
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

    const userPayload = buildLoginPayload(user, includePhone);
    return sendSuccess(res, 200, 'Login successful', { ...buildAuthTokensPayload(req, authSession), user: userPayload });
  } catch (error) {
    console.error('Login error:', error);
    return sendError(res, 500, 'Server error during login');
  }
};

const googleLogin = async (req, res) => {
  try {
    const credential = String(req.body?.credential || '').trim();
    if (!credential) {
      return sendError(res, 400, 'Google credential is required.');
    }

    const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
    if (!clientId) {
      console.error('Google login is not configured: GOOGLE_CLIENT_ID is missing.');
      return sendError(res, 503, 'Google sign-in is not configured.');
    }

    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
    } catch {
      return sendError(res, 401, 'Google sign-in could not be verified. Please try again.');
    }

    const payload = ticket.getPayload();
    const googleId = String(payload?.sub || '').trim();
    const email = normalizeEmail(payload?.email);
    if (!googleId || !email || payload?.email_verified !== true) {
      return sendError(res, 401, 'Google sign-in returned an unverified account.');
    }

    const requestedRole = SELF_SERVICE_ROLES.has(req.body?.role) ? req.body.role : 'both';
    let user = await User.findOne({ $or: [{ googleId }, { email }] }).select('+googleId');

    if (user?.status === 'disabled') {
      return sendError(res, 401, 'Account is disabled. Contact an admin.');
    }
    if (user?.status === 'deleted') {
      return sendError(res, 401, 'Account has been deleted.');
    }

    if (!user) {
      const displayName = normalizeDisplayName(payload.name || '');
      const nameParts = displayName.split(' ').filter(Boolean);
      const firstName = normalizeName(payload.given_name || nameParts[0] || 'Google');
      const lastName = normalizeName(payload.family_name || nameParts.slice(1).join(' ') || 'User');
      user = new User({
        firstName,
        lastName,
        email,
        googleId,
        authProvider: 'google',
        role: requestedRole,
        status: 'active',
        verification: { emailVerified: true },
      });
      await user.setPassword(crypto.randomBytes(32).toString('hex'));
      await user.save();
    } else {
      if (!user.googleId) user.googleId = googleId;
      if (user.authProvider !== 'google') user.authProvider = 'google';
      user.verification = {
        ...(user.verification?.toObject?.() || user.verification || {}),
        emailVerified: true,
      };
      if (user.status === 'pending') {
        user.status = 'active';
      }
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

    return sendSuccess(res, 200, 'Google login successful', {
      ...buildAuthTokensPayload(req, authSession),
      user: buildLoginPayload(user),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return sendError(res, 409, 'This Google account is already linked to another account.');
    }
    console.error('Google login error:', error);
    return sendError(res, 500, 'Server error during Google sign-in.');
  }
};

const loginMfa = async (req, res) => {
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
    return sendSuccess(res, 200, 'Login successful', { ...buildAuthTokensPayload(req, authSession), user: userPayload });
  } catch (error) {
    console.error('Login MFA error:', error);
    return sendError(res, 500, 'Server error during MFA verification');
  }
};

const loginOtpVerify = async (req, res) => {
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

    const verification = await verifyOtpChallenge({
      purpose: 'login',
      challengeId: decoded.challengeId,
      code,
      consume: true,
    });
    if (!verification.ok) {
      const status = verification.reason === 'attempts' ? 429 : 401;
      return sendError(res, status, verification.reason === 'attempts'
        ? 'Too many OTP attempts. Please login again.'
        : 'Invalid or expired OTP code.');
    }
    const challenge = verification.challenge;
    if (String(challenge.user || '') !== String(decoded.userId)) {
      return sendError(res, 401, 'Invalid OTP challenge token.');
    }
    const user = await User.findById(challenge.user);
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

    const includePhone = Boolean(challenge.metadata?.includePhone);
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
    return sendSuccess(res, 200, 'Login successful', { ...buildAuthTokensPayload(req, authSession), user: payload });
  } catch (e) {
    console.error('Login OTP verify error:', e);
    return sendError(res, 500, 'Server error');
  }
};

const loginOtpResend = async (req, res) => {
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

    const challenge = await getOtpChallenge({ purpose: 'login', challengeId: decoded.challengeId });
    if (!challenge) {
      return sendError(res, 401, 'OTP challenge not found or expired.');
    }

    if (String(challenge.user || '') !== String(decoded.userId)) {
      return sendError(res, 401, 'Invalid OTP challenge token.');
    }
    const user = await User.findById(challenge.user);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    const renewed = await issueLoginOtpChallenge(user, Boolean(challenge.metadata?.includePhone));
    return sendSuccess(res, 200, 'OTP resent', {
      otpRequired: true,
      otpToken: renewed.otpToken,
    });
  } catch (e) {
    console.error('Login OTP resend error:', e);
    return sendError(res, 500, 'Server error');
  }
};

export {
  registerUser,
  loginUser,
  googleLogin,
  loginMfa,
  loginOtpVerify,
  loginOtpResend,
};
export default {
  registerUser,
  loginUser,
  googleLogin,
  loginMfa,
  loginOtpVerify,
  loginOtpResend,
};
