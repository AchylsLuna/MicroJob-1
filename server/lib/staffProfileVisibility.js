// Admin/Support accounts are platform staff, not marketplace participants.
// They must never expose a browsable public profile to workers or employers,
// even when a support conversation puts their user id in front of the client.

const STAFF_ROLES = new Set(['admin', 'superadmin']);

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const normalizeId = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return value.toHexString();
    if (typeof value._id !== 'undefined' && value._id !== value) return normalizeId(value._id);
  }
  return String(value).trim();
};

export function isStaffRole(role) {
  return STAFF_ROLES.has(normalizeRole(role));
}

export function isSameUser(left, right) {
  const a = normalizeId(left);
  const b = normalizeId(right);
  return Boolean(a) && a === b;
}

/**
 * Decides whether a requester may read a public profile.
 *
 * Staff profiles are hidden from every non-staff requester. A 404 is used
 * instead of 403 so the response is indistinguishable from a missing user and
 * cannot be used to enumerate or confirm admin accounts.
 *
 * @returns {{status: number, message: string}|null} null when access is allowed.
 */
export function getPublicProfileAccessError({
  targetRole,
  requesterRole,
  targetId,
  requesterId,
} = {}) {
  if (!isStaffRole(targetRole)) return null;
  // Staff may inspect staff profiles (admin tooling).
  if (isStaffRole(requesterRole)) return null;
  // A staff member always keeps access to their own record.
  if (isSameUser(targetId, requesterId)) return null;
  return { status: 404, message: 'Profile not found.' };
}

/**
 * Whether the client should render a profile affordance for a conversation
 * partner. Used to keep Admin/Support chats free of profile entry points.
 */
export function canViewProfileOf({ targetRole, requesterRole, targetId, requesterId } = {}) {
  return getPublicProfileAccessError({ targetRole, requesterRole, targetId, requesterId }) === null;
}

export const STAFF_ROLE_LIST = Object.freeze([...STAFF_ROLES]);
