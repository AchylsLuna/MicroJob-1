import crypto from 'crypto';
import TrustedDevice from '../models/TrustedDevice.js';
import { cookieSecurityOptions } from './authSession.js';

export const TRUSTED_DEVICE_COOKIE = 'trustedDevice';
export const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const hashDeviceToken = (token) =>
  crypto.createHash('sha256').update(String(token || '')).digest('hex');

export const issueTrustedDevice = async (user, { ip = '', label = '' } = {}) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TRUSTED_DEVICE_TTL_MS);
  const token = crypto.randomBytes(32).toString('hex');
  const device = await TrustedDevice.create({
    user: user._id,
    tokenHash: hashDeviceToken(token),
    label,
    ip,
    createdAt: now,
    lastUsedAt: now,
    expiresAt,
  });
  return { device, token, expiresAt };
};

// Validates a trusted-device token for `userId` and rotates it in the same
// update: the matched record gets a freshly generated token and a renewed
// 30-day expiry, so a stolen cookie value stops working the next time the
// legitimate device checks in, without the user having to re-verify.
export const consumeTrustedDevice = async ({ token, userId }) => {
  if (!token || !userId) return null;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TRUSTED_DEVICE_TTL_MS);
  const nextToken = crypto.randomBytes(32).toString('hex');

  const device = await TrustedDevice.findOneAndUpdate(
    { user: userId, tokenHash: hashDeviceToken(token), expiresAt: { $gt: now } },
    { $set: { tokenHash: hashDeviceToken(nextToken), lastUsedAt: now, expiresAt } },
    { returnDocument: 'after' },
  );
  if (!device) return null;
  return { device, token: nextToken, expiresAt };
};

export const setTrustedDeviceCookie = (res, token, expiresAt) => {
  res.cookie(TRUSTED_DEVICE_COOKIE, token, {
    httpOnly: true,
    ...cookieSecurityOptions,
    expires: expiresAt,
  });
};

export const clearTrustedDeviceCookie = (res) => {
  res.clearCookie(TRUSTED_DEVICE_COOKIE, { ...cookieSecurityOptions, httpOnly: true });
};

export const getTrustedDeviceTokenFromRequest = (req) =>
  req.cookies?.[TRUSTED_DEVICE_COOKIE] || req.body?.trustedDeviceToken || null;

export const clearTrustedDevicesForUser = (userId) => TrustedDevice.deleteMany({ user: userId });

export const listTrustedDevicesForUser = (userId) =>
  TrustedDevice.find({ user: userId, expiresAt: { $gt: new Date() } })
    .sort({ lastUsedAt: -1 })
    .select('-tokenHash');
