import jwt from 'jsonwebtoken';
import Session from '../models/Session.js';
import User from '../models/User.js';
import { getJwtSecret } from '../lib/jwtSecret.js';

export default async function optionalAuth(req, res, next) {
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : req.cookies?.token;

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const userId = decoded?.userId || decoded?.id || decoded?._id;
    if (!userId) return next();

    if (decoded.sessionId) {
      const session = await Session.findById(decoded.sessionId).select('user active expiresAt');
      if (
        !session ||
        !session.active ||
        String(session.user) !== String(userId) ||
        (session.expiresAt && session.expiresAt.getTime() < Date.now())
      ) {
        return res.status(401).json({ message: 'Session invalid or expired.' });
      }
    }

    // Role and staffRole are read from the database rather than the token, and
    // applied after the spread, so this middleware cannot hand a route a stale
    // or forged privilege claim -- the same rule verifyToken follows.
    const account = await User.findById(userId).select('role staffRole status');
    if (!account || account.status !== 'active') {
      return res.status(401).json({ message: 'Account is not active.' });
    }

    req.user = {
      ...decoded,
      id: userId,
      userId,
      role: account.role,
      staffRole: account.staffRole ?? null,
    };
  } catch {
    // Anonymous access remains public, but supplied invalid credentials must trigger
    // the normal client refresh/logout path rather than silently losing role context.
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }

  return next();
}
