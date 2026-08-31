import User from '../models/User.js';
import {
  EMAIL_VALIDATION_MESSAGE,
  NAME_VALIDATION_MESSAGE,
  isValidEmail,
  isValidName,
  normalizeEmail,
  normalizeName,
} from '../lib/authValidation.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../lib/passwordPolicy.js';
import { getAdminUserCreationError, getAdminUserMutationError } from '../lib/adminUserPolicy.js';
import { resolveStaffRole, STAFF_ROLES } from '../lib/adminPermissions.js';

const STAFF_SELECT = '_id firstName lastName email role staffRole status updatedAt';
const EDITABLE_STATUSES = new Set(['active', 'disabled']);

const getActorId = (req) => String(req.user?.id || req.user?.userId || '');

/** GET /admin/staff — every admin/superadmin account, with its staff sub-role. */
export async function getAdminStaffList(req, res) {
  try {
    const staff = await User.find({ role: { $in: ['admin', 'superadmin'] } })
      .select(STAFF_SELECT)
      .sort({ updatedAt: -1 })
      .lean();
    return res.status(200).json(
      staff.map((user) => ({
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        staffRole: user.role === 'superadmin' ? 'superadmin' : user.staffRole,
        status: user.status,
        lastActiveAt: user.updatedAt,
      })),
    );
  } catch (error) {
    console.error('Get admin staff error:', error);
    return res.status(500).json({ message: 'Failed to fetch staff accounts.' });
  }
}

/** POST /admin/staff — create a staff account with a required sub-role. */
export async function createAdminStaff(req, res) {
  try {
    const allowedKeys = new Set(['firstName', 'lastName', 'email', 'password', 'staffRole']);
    const suppliedKeys = Object.keys(req.body || {});
    if (!suppliedKeys.length || suppliedKeys.some((key) => !allowedKeys.has(key))) {
      return res.status(400).json({ message: 'First name, last name, email, temporary password, and staff role are required.' });
    }

    const firstName = normalizeName(req.body.firstName);
    const lastName = normalizeName(req.body.lastName);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const staffRole = String(req.body.staffRole || '');

    if (!isValidName(firstName) || !isValidName(lastName)) {
      return res.status(400).json({ message: NAME_VALIDATION_MESSAGE });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: EMAIL_VALIDATION_MESSAGE });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
    }
    if (!STAFF_ROLES.includes(staffRole)) {
      return res.status(400).json({ message: `Staff role must be one of: ${STAFF_ROLES.join(', ')}.` });
    }

    const forbidden = getAdminUserCreationError({
      actorRole: req.user?.role,
      actorStaffRole: resolveStaffRole(req.user),
      newRole: 'admin',
      newStaffRole: staffRole,
    });
    if (forbidden) return res.status(forbidden.status).json({ message: forbidden.message });

    if (await User.exists({ email })) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    const user = new User({
      firstName,
      lastName,
      email,
      role: 'admin',
      staffRole,
      status: 'active',
      passwordChangeRequired: true,
      verification: { emailVerified: true },
    });
    await user.setPassword(password);
    await user.save();

    return res.status(201).json({
      message: 'Staff account created. The user must change the temporary password at first sign-in.',
      staff: await User.findById(user._id).select(STAFF_SELECT),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }
    console.error('Create admin staff error:', error);
    return res.status(500).json({ message: 'Failed to create staff account.' });
  }
}

/** PATCH /admin/staff/:userId — reassign a staff sub-role and/or toggle status. */
export async function updateAdminStaff(req, res) {
  try {
    const target = await User.findOne({ _id: req.params.userId, role: { $in: ['admin', 'superadmin'] } });
    if (!target) return res.status(404).json({ message: 'Staff account not found.' });

    const allowedKeys = new Set(['staffRole', 'status']);
    const suppliedKeys = Object.keys(req.body || {});
    if (!suppliedKeys.length || suppliedKeys.some((key) => !allowedKeys.has(key))) {
      return res.status(400).json({ message: 'Only staffRole and status may be edited.' });
    }

    const nextStaffRole = req.body.staffRole === undefined ? target.staffRole : String(req.body.staffRole);
    const nextStatus = req.body.status === undefined ? target.status : String(req.body.status).toLowerCase();
    if (req.body.staffRole !== undefined && !STAFF_ROLES.includes(nextStaffRole)) {
      return res.status(400).json({ message: `Staff role must be one of: ${STAFF_ROLES.join(', ')}.` });
    }
    if (req.body.status !== undefined && !EDITABLE_STATUSES.has(nextStatus)) {
      return res.status(400).json({ message: 'Status must be active or disabled.' });
    }

    const activeSuperadminCount =
      target.role === 'superadmin' ? await User.countDocuments({ role: 'superadmin', status: 'active' }) : 0;

    const forbidden = getAdminUserMutationError({
      actorRole: req.user?.role,
      actorStaffRole: resolveStaffRole(req.user),
      actorId: getActorId(req),
      targetId: String(target._id),
      targetRole: target.role,
      targetStaffRole: target.staffRole,
      nextRole: target.role,
      nextStaffRole,
      nextStatus,
      activeSuperadminCount,
    });
    if (forbidden) return res.status(forbidden.status).json({ message: forbidden.message });

    if (req.body.staffRole !== undefined) target.staffRole = nextStaffRole;
    if (req.body.status !== undefined) target.status = nextStatus;
    await target.save();

    return res.status(200).json({ message: 'Staff account updated.', staff: await User.findById(target._id).select(STAFF_SELECT) });
  } catch (error) {
    console.error('Update admin staff error:', error);
    return res.status(500).json({ message: 'Failed to update staff account.' });
  }
}
