export const ROLE_PERMISSIONS = {
  admin_team: new Set([
    'admin.dashboard', 'staff.view', 'staff.create', 'staff.assignRole', 'staff.toggleStatus',
    'audit.view', 'users.view', 'users.suspend', 'jobs.view', 'analytics.view', 'analytics.export',
    'support.tickets.handle',
  ]),
  moderator: new Set([
    'users.view', 'users.suspend', 'users.ban', 'verification.review', 'moderation.review',
    'moderation.enforce', 'jobs.view',
  ]),
  finance_team: new Set([
    'finance.transactions.view', 'finance.reconciliation.view', 'finance.flag', 'finance.payouts.review',
    'finance.disputes.handle', 'finance.logs.view', 'analytics.view', 'analytics.export',
  ]),
  analytics_team: new Set(['analytics.view', 'analytics.export']),
  support_staff: new Set(['users.view', 'users.resetPassword', 'users.unlock', 'jobs.view', 'support.tickets.handle', 'support.escalate']),
};

export const requireAdminPermission = (permission) => (req, res, next) => {
  if (req.user?.role === 'superadmin' || (req.user?.role === 'admin' && !req.user?.staffRole)) {
    return next();
  }

  const rolePermissions = ROLE_PERMISSIONS[String(req.user?.staffRole || '').toLowerCase()];
  if (rolePermissions?.has(permission)) return next();
  return res.status(403).json({ message: 'You do not have permission to perform this admin action.' });
};

export default requireAdminPermission;