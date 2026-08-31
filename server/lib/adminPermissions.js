/**
 * Server-side mirror of client/src/lib/adminPermissions.ts.
 *
 * The client's copy is UI enforcement only (hides links/pages). This copy is
 * the real security boundary — every admin route must gate on `requirePermission`
 * (see server/middleware/adminPermission.js) rather than trust the client to
 * hide the button. Keep the two matrices in sync by hand; there is no shared
 * package between client/ and server/ in this repo.
 */

export const STAFF_ROLES = [
  'admin_team',
  'moderator',
  'finance_team',
  'analytics_team',
  'support_staff',
];

export const ROLE_PERMISSIONS = {
  superadmin: [],

  admin_team: [
    'staff.view',
    'staff.create',
    'staff.assignRole',
    'staff.toggleStatus',
    'audit.view',
    'users.view',
    'users.suspend',
    'jobs.view',
    'analytics.view',
    'analytics.export',
    'support.tickets.handle',
  ],

  moderator: [
    'users.view',
    'users.suspend',
    'users.ban',
    'verification.review',
    'moderation.review',
    'moderation.enforce',
    'jobs.view',
  ],

  finance_team: [
    'finance.transactions.view',
    'finance.reconciliation.view',
    'finance.flag',
    'finance.payouts.review',
    'finance.disputes.handle',
    'finance.logs.view',
    'analytics.view',
    'analytics.export',
  ],

  analytics_team: ['analytics.view', 'analytics.export'],

  support_staff: [
    'users.view',
    'users.resetPassword',
    'users.unlock',
    'jobs.view',
    'support.tickets.handle',
    'support.escalate',
  ],
};

/** Tolerant of however a role is spelled — mirrors normalizeStaffRole on the client. */
export function normalizeStaffRole(raw) {
  const value = String(raw || '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  switch (value) {
    case 'superadmin':
    case 'super_admin':
      return 'superadmin';
    case 'admin':
    case 'admin_team':
      return 'admin_team';
    case 'moderator':
    case 'moderation':
      return 'moderator';
    case 'finance':
    case 'finance_team':
      return 'finance_team';
    case 'analytics':
    case 'analytics_team':
      return 'analytics_team';
    case 'support':
    case 'support_staff':
      return 'support_staff';
    default:
      return null;
  }
}

/**
 * Resolves the effective staff role for a request's user. `superadmin` is
 * carried by `user.role`; every other staff role is carried by `user.staffRole`
 * and only meaningful when `user.role === 'admin'`.
 *
 * Admin accounts created before `staffRole` existed have no sub-role stored.
 * They fall back to `admin_team` so they are not locked out of the admin panel
 * on deploy — a reduction in privilege versus the unrestricted access every
 * `role: 'admin'` account had previously, not an expansion. Assign explicit
 * sub-roles via Staff Management to narrow them further.
 */
export function resolveStaffRole(user) {
  if (!user) return null;
  if (user.role === 'superadmin') return 'superadmin';
  if (user.role === 'admin') return normalizeStaffRole(user.staffRole) ?? 'admin_team';
  return null;
}

/** True when the role may perform the permission. `superadmin` may always. */
export function hasPermission(role, permission) {
  if (!role) return false;
  if (role === 'superadmin') return true;
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

export default {
  STAFF_ROLES,
  ROLE_PERMISSIONS,
  normalizeStaffRole,
  resolveStaffRole,
  hasPermission,
};
