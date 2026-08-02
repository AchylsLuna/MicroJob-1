import jwt from 'jsonwebtoken';
import Session from '../models/Session.js';
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

    req.user = { ...decoded, id: userId, userId };
  } catch {
    // Anonymous access remains public, but supplied invalid credentials must trigger
    // the normal client refresh/logout path rather than silently losing role context.
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }

  return next();
}
