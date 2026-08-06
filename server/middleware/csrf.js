// Simple double-submit CSRF protection middleware for refresh endpoint
export default function csrfProtection(req, res, next) {
  try {
    const cookieName = process.env.CSRF_COOKIE_NAME || 'csrfToken';
    const cookieToken = req.cookies?.[cookieName];
    const headerToken = req.get('x-csrf-token');
    if (!cookieToken || !headerToken) {
      return res.status(403).json({ message: 'CSRF token missing' });
    }
    if (cookieToken !== headerToken) {
      return res.status(403).json({ message: 'Invalid CSRF token' });
    }
    next();
  } catch (err) {
    console.warn('CSRF check failed', err);
    return res.status(403).json({ message: 'CSRF validation error' });
  }
}

export function csrfForCookieSession(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.headers.authorization?.startsWith('Bearer ')) return next();
  if (!req.cookies?.token && !req.cookies?.refreshToken) return next();
  return csrfProtection(req, res, next);
}
