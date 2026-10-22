import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';
import { getJwtSecret } from '../lib/jwtSecret.js';
import {
  isValidName,
  isValidPhone,
  NAME_VALIDATION_MESSAGE,
  FULL_NAME_REQUIRED_MESSAGE,
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
  isNativeAuthRequest,
  isBearerAuthRequest,
} from '../lib/authSession.js';
import {
  createMfaChallengeToken,
  createLoginMethodSelectionToken,
  LOGIN_METHOD_SELECTION_PURPOSE,
  issueLoginOtpChallenge,
  getTestLoginOtpCode,
  LOGIN_OTP_PURPOSE,
  MFA_LOGIN_PURPOSE,
  MFA_METHOD,
  verifyMfaCodeForUser,
} from '../lib/mfaHelpers.js';
import { getOtpChallenge, getTestOtpCode, verifyOtpChallenge } from '../lib/otpChallenges.js';
import {
  issueTrustedDevice,
  consumeTrustedDevice,
  consumeTrustedDeviceByToken,
  setTrustedDeviceCookie,
  getTrustedDeviceTokenFromRequest,
} from '../lib/trustedDevice.js';
import { isAdminRole } from '../lib/auth.js';
import { hasVerifiedSecondaryEmail, matchesStaffLoginChallenge } from '../lib/staffSecurity.js';
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
    if (!normalizedPhone) {
      return sendError(res, 400, 'Phone number is required');
    }
    if (!isValidPhone(normalizedPhone)) {
      return sendError(res, 400, PHONE_VALIDATION_MESSAGE);
    }

    let userFirstName = providedFirstName;
    let userLastName = providedLastName;
    if (!userFirstName || !userLastName) {
      if (!displayUsername) {
        return sendError(res, 400, 'Username or full name is required');
      }
      const nameParts = displayUsername.split(' ').filter(Boolean);
      // A single word is not a complete name -- silently mirroring it into both
      // first and last name would create a "John John" record instead of
      // rejecting the input, so require at least two parts here.
      if (nameParts.length < 2) {
        return sendError(res, 400, FULL_NAME_REQUIRED_MESSAGE);
      }
      userFirstName = nameParts[0];
      userLastName = nameParts.slice(1).join(' ');
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
        return sendError(res, 409, 'This email address already exists.', { code: 'EMAIL_ALREADY_EXISTS' });
      }
      if (normalizedPhone && existingUser.phoneNumber === normalizedPhone) {
        return sendError(res, 409, 'This phone number already exists.', { code: 'PHONE_NUMBER_ALREADY_EXISTS' });
      }
      return sendError(res, 409, 'This username is already taken.', { code: 'USERNAME_ALREADY_EXISTS' });
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
        return sendError(res, 409, 'This email address already exists.', { code: 'EMAIL_ALREADY_EXISTS' });
      }
      if (duplicateField === 'phoneNumber') {
        return sendError(res, 409, 'This phone number already exists.', { code: 'PHONE_NUMBER_ALREADY_EXISTS' });
      }
      if (duplicateField === 'username') {
        return sendError(res, 409, 'This username is already taken.', { code: 'USERNAME_ALREADY_EXISTS' });
      }
      return sendError(res, 409, 'An account with these details already exists.', { code: 'ACCOUNT_ALREADY_EXISTS' });
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
    const { emailOrUsername, password, phoneNumber } = req.body;
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
      user = await User.findOne({ phoneNumber: normalizedPhone }).select('+passwordHashed +failedLoginAttempts +loginLockCount +lockUntil +secondaryEmail +secondaryEmailVerifiedAt');
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
      }).select('+passwordHashed +failedLoginAttempts +loginLockCount +lockUntil +secondaryEmail +secondaryEmailVerifiedAt');
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
      await bcrypt.compare(password, ENUMERATION_TIMING_HASH);
      return sendError(res, 401, invalidMessage);
    }

    if (!(await user.validatePassword(password))) {
      await user.registerFailedLogin();
      return sendError(res, 401, invalidMessage);
    }
    const staff = isAdminRole(user.role);
    if ((staff && (includePhone || normalizeEmail(emailOrUsername) !== user.email)) || (req.body?.staffOnly && !staff)) {
      return sendError(res, 401, invalidMessage);
    }

    await user.clearLoginLock();

    if (user.status === 'pending') {
      return sendError(res, 401, 'Please verify your email before signing in.');
    }
    if (user.status === 'disabled') {
      return sendError(res, 401, 'Account is disabled. Contact an admin.');
    }
    if (user.status === 'banned') {
      return sendError(res, 401, 'Account is banned. Contact support.');
    }
    if (user.status === 'deleted') {
      return sendError(res, 401, 'Account has been deleted.');
    }

    // Staff sign in with their primary email; a verified secondary mailbox
    // enables mandatory OTP. The server derives this from persisted fields.
    const passwordOnlyAdminLogin = staff && !hasVerifiedSecondaryEmail(user);

    if (user.mfaEnabled && !staff) {
      const selectionToken = createLoginMethodSelectionToken(String(user._id), includePhone);
      return sendSuccess(res, 200, 'Choose a verification method', {
        methodSelectionRequired: true,
        selectionToken,
        methods: ['mfa', 'gmail_otp'],
      });
    }

    // The email OTP challenge is mandatory for marketplace accounts. A trusted device (see
    // lib/trustedDevice.js) is the only thing that skips it, and that decision
    // rests entirely on a token the server itself issued after a prior OTP
    // verification -- never on anything the client claims. Privileged staff
    // accounts with a verified secondary email must present OTP every sign-in.
    //
    // This used to be gated on `req.body.requireOtp`, with a comment asserting
    // the skip was decided server-side. It was not: the flag came straight off
    // the request body, so omitting it skipped the second factor altogether and
    // anyone holding only a password logged in directly. Nothing but the
    // client's own good manners was enforcing 2FA.
    const deviceToken = getTrustedDeviceTokenFromRequest(req);
    const trustedDevice = staff
      ? null
      : await consumeTrustedDevice({ token: deviceToken, userId: user._id });

    if (!passwordOnlyAdminLogin && !trustedDevice) {
      const loginOtp = await issueLoginOtpChallenge(user, includePhone);
      return sendSuccess(res, 200, 'OTP verification required', {
        otpRequired: true,
        otpToken: loginOtp.otpToken,
        ...(staff ? { deliveryEmail: user.secondaryEmail, staffLogin: true } : {}),
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

    if (trustedDevice) {
      setTrustedDeviceCookie(res, trustedDevice.token, trustedDevice.expiresAt);
    }

    const userPayload = buildLoginPayload(user, includePhone);
    return sendSuccess(res, 200, 'Login successful', {
      ...buildAuthTokensPayload(req, authSession),
      // Native and cross-site bearer browsers cannot depend on cookies, so
      // rotated device trust travels in the body alongside the session tokens.
      ...(trustedDevice && (isNativeAuthRequest(req) || isBearerAuthRequest(req))
        ? { trustedDeviceToken: trustedDevice.token, trustedDeviceExpiresAt: trustedDevice.expiresAt }
        : {}),
      user: userPayload,
    });
  } catch (error) {
    console.error('Login error:', error);
    return sendError(res, 500, 'Server error during login');
  }
};

const loginTrustedDevice = async (req, res) => {
  try {
    const trustedDevice = await consumeTrustedDeviceByToken(getTrustedDeviceTokenFromRequest(req));
    if (!trustedDevice) return sendError(res, 401, 'Trusted device expired. Please sign in again.');

    const user = await User.findById(trustedDevice.device.user);
    if (!user || user.status !== 'active') {
      return sendError(res, 401, 'This trusted device is no longer valid.');
    }
    if (isAdminRole(user.role)) return sendError(res, 401, 'Staff must sign in with their primary email and password.');
    if (user.mfaEnabled && !isAdminRole(user.role)) {
      return sendError(res, 401, 'Sign in with your password to complete two-factor authentication.');
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
    setTrustedDeviceCookie(res, trustedDevice.token, trustedDevice.expiresAt);
    return sendSuccess(res, 200, 'Trusted device login successful', {
      ...buildAuthTokensPayload(req, authSession),
      ...(isNativeAuthRequest(req) || isBearerAuthRequest(req)
        ? { trustedDeviceToken: trustedDevice.token, trustedDeviceExpiresAt: trustedDevice.expiresAt }
        : {}),
      user: buildLoginPayload(user, false),
    });
  } catch (error) {
    console.error('Trusted device login error:', error);
    return sendError(res, 500, 'Unable to sign in with this trusted device.');
  }
};

const selectLoginMethod = async (req, res) => {
  try {
    const { selectionToken, method } = req.body || {};
    if (!selectionToken || !['mfa', 'gmail_otp'].includes(method)) {
      return sendError(res, 400, 'A valid verification method is required.');
    }
    let decoded;
    try {
      decoded = jwt.verify(String(selectionToken), getJwtSecret());
    } catch {
      return sendError(res, 401, 'Login verification selection expired. Please sign in again.');
    }
    if (decoded?.purpose !== LOGIN_METHOD_SELECTION_PURPOSE || !decoded?.userId) {
      return sendError(res, 401, 'Invalid login verification selection.');
    }
    const user = await User.findById(decoded.userId).select('+mfaSecret +mfaBackupCodes');
    if (user && isAdminRole(user.role)) return sendError(res, 401, 'Staff must sign in with their primary email and password.');
    if (!user || !user.mfaEnabled) return sendError(res, 401, 'Two-factor authentication is not enabled.');
    if (user.status !== 'active') return sendError(res, 401, 'This account cannot sign in.');

    if (method === 'mfa') {
      const mfaToken = createMfaChallengeToken(String(user._id), Boolean(decoded.includePhone));
      return sendSuccess(res, 200, 'MFA verification required', {
        mfaRequired: true, mfaToken, method: user.mfaMethod || MFA_METHOD,
      });
    }

    const loginOtp = await issueLoginOtpChallenge(user, Boolean(decoded.includePhone));
    return sendSuccess(res, 200, 'OTP verification required', {
      otpRequired: true, otpToken: loginOtp.otpToken, email: user.email,
    });
  } catch (error) {
    console.error('Login method selection error:', error);
    return sendError(res, 500, 'Unable to start login verification.');
  }
};

const googleLogin = async (req, res) => {
  try {
    const credential = String(req.body?.credential || '').trim();
    if (!credential) {
      return sendError(res, 400, 'Google credential is required.');
    }

    const clientIds = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
    ].map((value) => String(value || '').trim()).filter(Boolean);
    if (clientIds.length === 0) {
      console.error('Google login is not configured: GOOGLE_CLIENT_ID is missing.');
      return sendError(res, 503, 'Google sign-in is not configured.');
    }

    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientIds });
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
    if (user && isAdminRole(user.role)) return sendError(res, 401, 'Staff must sign in with their primary email and password.');

    if (user?.status === 'disabled') {
      return sendError(res, 401, 'Account is disabled. Contact an admin.');
    }
    if (user?.status === 'banned') {
      return sendError(res, 401, 'Account is banned. Contact support.');
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
    if (user && isAdminRole(user.role)) return sendError(res, 401, 'Staff must sign in with their primary email and password.');
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
    if (user.status === 'banned') {
      return sendError(res, 401, 'Account is banned. Contact support.');
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
    const user = await User.findById(challenge.user).select('+secondaryEmail +secondaryEmailVerifiedAt');
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }
    if (!matchesStaffLoginChallenge(user, challenge)) {
      return sendError(res, 401, 'Account security details changed. Please sign in again.');
    }
    if (user.status === 'pending') {
      return sendError(res, 401, 'Please verify your email before signing in.');
    }
    if (user.status === 'disabled') {
      return sendError(res, 401, 'Account is disabled. Contact an admin.');
    }
    if (user.status === 'banned') {
      return sendError(res, 401, 'Account is banned. Contact support.');
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

    let trustedDevice = null;
    if (req.body?.rememberDevice && !isAdminRole(user.role)) {
      trustedDevice = await issueTrustedDevice(user, {
        ip: req.ip || req.headers['x-forwarded-for'] || '',
        label: req.get('User-Agent') || '',
      });
      setTrustedDeviceCookie(res, trustedDevice.token, trustedDevice.expiresAt);
    }

    const payload = buildLoginPayload(user, includePhone);
    return sendSuccess(res, 200, 'Login successful', {
      ...buildAuthTokensPayload(req, authSession),
      ...(trustedDevice && (isNativeAuthRequest(req) || isBearerAuthRequest(req))
        ? { trustedDeviceToken: trustedDevice.token, trustedDeviceExpiresAt: trustedDevice.expiresAt }
        : {}),
      user: payload,
    });
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
    const user = await User.findById(challenge.user).select('+secondaryEmail +secondaryEmailVerifiedAt');
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }
    if (user.status !== 'active' || !matchesStaffLoginChallenge(user, challenge)) {
      return sendError(res, 401, 'Account security details changed. Please sign in again.');
    }

    const renewed = await issueLoginOtpChallenge(user, Boolean(challenge.metadata?.includePhone));
    return sendSuccess(res, 200, 'OTP resent', {
      otpRequired: true,
      otpToken: renewed.otpToken,
      ...(isAdminRole(user.role) ? { deliveryEmail: user.secondaryEmail, staffLogin: true } : {}),
    });
  } catch (e) {
    console.error('Login OTP resend error:', e);
    return sendError(res, 500, 'Server error');
  }
};

// Test-only escape hatch for the isolated e2e harness: the login OTP is
// deliberately never returned in the /login or /login/otp/* API responses
// (see mfaHelpers.issueLoginOtpChallenge), and the e2e sandbox has no real
// mailbox to read it from. This is a no-op 404 outside NODE_ENV === 'test',
// so it never exists as a usable path in development or production.
const debugLoginOtp = async (req, res) => {
  if (process.env.NODE_ENV !== 'test') {
    return sendError(res, 404, 'Not found');
  }
  const email = String(req.query?.email || '').toLowerCase().trim();
  const code = getTestLoginOtpCode(email);
  if (!code) {
    return sendError(res, 404, 'No login OTP has been issued for this address.');
  }
  return sendSuccess(res, 200, 'ok', { code });
};

// Test-only escape hatch for the signup / email-verification OTP, same shape
// and same hard NODE_ENV === 'test' gate as debugLoginOtp above. That code used
// to come back in the /auth/otp/send response body on any non-production
// deploy, which made it an account-takeover primitive; the harness now reads it
// here instead. A no-op 404 outside NODE_ENV === 'test'.
const debugSignupOtp = async (req, res) => {
  if (process.env.NODE_ENV !== 'test') {
    return sendError(res, 404, 'Not found');
  }
  const email = String(req.query?.email || '').toLowerCase().trim();
  const code = getTestOtpCode('email-verification', email);
  if (!code) {
    return sendError(res, 404, 'No signup OTP has been issued for this address.');
  }
  return sendSuccess(res, 200, 'ok', { code });
};

// Test-only escape hatch, same shape and same hard gate as debugLoginOtp
// above. Funding an employer wallet normally requires a real PayMongo
// checkout round trip, which the isolated e2e sandbox cannot perform -- so
// without this the entire offer -> hire -> submit -> settle path is
// unreachable from an automated test, which is exactly the part of the
// product most worth covering. Credits the balance directly and records the
// matching TOP_UP row so the wallet history stays coherent.
// A no-op 404 outside NODE_ENV === 'test'.
const debugCreditWallet = async (req, res) => {
  if (process.env.NODE_ENV !== 'test') {
    return sendError(res, 404, 'Not found');
  }
  const email = String(req.body?.email || '').toLowerCase().trim();
  const amount = Number(req.body?.amount);
  if (!email || !Number.isFinite(amount) || amount <= 0) {
    return sendError(res, 400, 'email and a positive amount are required.');
  }
  const user = await User.findOne({ email });
  if (!user) {
    return sendError(res, 404, 'No account exists for this address.');
  }
  user.employerBalance = (user.employerBalance || 0) + amount;
  await user.save();
  await Transaction.create({
    sender: null,
    receiver: user._id,
    amount,
    type: 'TOP_UP',
    status: 'COMPLETED',
    balanceTarget: 'EMPLOYER',
    label: 'Test harness wallet credit',
    actor: user._id,
  });
  return sendSuccess(res, 200, 'ok', { employerBalance: user.employerBalance });
};

export {
  registerUser,
  loginUser,
  loginTrustedDevice,
  selectLoginMethod,
  googleLogin,
  loginMfa,
  loginOtpVerify,
  loginOtpResend,
  debugLoginOtp,
  debugSignupOtp,
  debugCreditWallet,
};
export default {
  registerUser,
  loginUser,
  selectLoginMethod,
  googleLogin,
  loginMfa,
  loginOtpVerify,
  loginOtpResend,
  debugLoginOtp,
  debugCreditWallet,
};
