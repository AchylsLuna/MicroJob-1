import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Session from '../models/Session.js';
import { getJwtSecret } from './jwtSecret.js';

export const cookieSecurityOptions = {
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const normalizeUsername = (value = '') => String(value).trim().replace(/\s+/g, ' ').toLowerCase();
export const normalizeDisplayName = (value = '') => String(value).trim().replace(/\s+/g, ' ');

export const createAccessToken = (user, sessionId) =>
  jwt.sign(
    { userId: user._id, role: user.role || 'user', sessionId },
    getJwtSecret(),
    { expiresIn: '15m' }
  );

export const createSessionWithTokens = async (req, user) => {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '');
  const requestIp = forwardedFor.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const userAgent = req.get('User-Agent') || '';
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  let session = await Session.findOne({
    user: user._id,
    userAgent,
    ip: requestIp,
    active: true,
  });

  if (session) {
    session.expiresAt = expiresAt;
    session.createdAt = new Date();
  } else {
    const inactiveSessions = await Session.find({
      user: user._id,
      active: false,
    }).sort({ endedAt: -1 }).skip(10);

    if (inactiveSessions.length > 0) {
      const idsToDelete = inactiveSessions.map((entry) => entry._id);
      await Session.deleteMany({ _id: { $in: idsToDelete } });
    }

    session = await Session.create({
      user: user._id,
      userAgent,
      ip: requestIp,
      active: true,
      expiresAt,
    });
  }

  const accessToken = createAccessToken(user, session._id.toString());
  const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  session.token = accessToken;
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

export const setSessionCookies = (
  res,
  { refreshToken, sessionId, accessToken, accessTokenExpiresAt, expiresAt, csrfToken }
) => {
  const sessionExpiry = expiresAt;
  const accessTokenExpiry = accessTokenExpiresAt || expiresAt;

  if (csrfToken) {
    res.cookie('csrfToken', csrfToken, {
      httpOnly: false,
      ...cookieSecurityOptions,
      expires: sessionExpiry,
    });
  }

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    ...cookieSecurityOptions,
    expires: sessionExpiry,
  });
  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    ...cookieSecurityOptions,
    expires: sessionExpiry,
  });

  if (accessToken) {
    res.cookie('token', accessToken, {
      httpOnly: true,
      ...cookieSecurityOptions,
      expires: accessTokenExpiry,
    });
  }
};

export const buildLoginPayload = (user, includePhone = false) => {
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
    role,
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
