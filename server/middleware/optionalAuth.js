import jwt from 'jsonwebtoken';
import Session from '../models/Session.js';
import { getJwtSecret } from '../lib/jwtSecret.js';

export default async function optionalAuth(req, _res, next) {
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
        return next();
      }
    }

    req.user = { ...decoded, id: userId, userId };
  } catch {
    // Optional authentication never turns an otherwise public request into a 401.
  }

  return next();
}
