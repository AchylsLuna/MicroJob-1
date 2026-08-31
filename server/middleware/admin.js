import { resolveStaffRole, hasPermission } from '../lib/adminPermissions.js';

const requireAdmin = (req, res, next) => {
  const role = req.user?.role;
  if (role === 'superadmin' || role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Admin access required.' });
};

/**
 * Fine-grained gate on top of `requireAdmin`: a user with `role: 'admin'`
 * must also hold the given permission via their `staffRole` (see
 * lib/adminPermissions.js). `superadmin` always passes.
 */
export function requirePermission(permission) {
  return (req, res, next) => {
    const staffRole = resolveStaffRole(req.user);
    if (hasPermission(staffRole, permission)) {
      return next();
    }
    return res.status(403).json({ message: 'You do not have permission to perform this action.' });
  };
}

/**
 * Platform-owner gate for routes that have no matching entry in the permission
 * matrix — platform configuration rather than day-to-day staff work. Kept
 * explicit rather than relying on `requirePermission` with an unlisted
 * permission string, so the intent is readable at the call site.
 */
export function requireSuperadmin(req, res, next) {
  if (resolveStaffRole(req.user) === 'superadmin') return next();
  return res.status(403).json({ message: 'Only a superadmin can perform this action.' });
}

export default requireAdmin;
