// Simple double-submit CSRF protection middleware for refresh endpoint
export default function csrfProtection(req, res, next) {
  try {
    const cookieToken = req.cookies?.csrfToken;
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
