import crypto from 'crypto';
import jwt from 'jsonwebtoken';
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

const loginUser = async (req, res) => {
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
      return sendSuccess(res, 200, 'OTP verification required', {
        otpRequired: true,
        otpToken: loginOtp.otpToken,
        ...(loginOtp.code && process.env.NODE_ENV !== 'production' ? { code: loginOtp.code } : {}),
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
      ...(renewed.code && process.env.NODE_ENV !== 'production' ? { code: renewed.code } : {}),
    });
  } catch (e) {
    console.error('Login OTP resend error:', e);
    return sendError(res, 500, 'Server error');
  }
};

export {
  registerUser,
  loginUser,
  loginMfa,
  loginOtpVerify,
  loginOtpResend,
};
export default {
  registerUser,
  loginUser,
  loginMfa,
  loginOtpVerify,
  loginOtpResend,
};
