import User from '../models/User.js';
import monitor from '../lib/monitor.js';

const VALID_STAFF_ROLES = new Set(['admin_team', 'moderator', 'finance_team', 'analytics_team', 'support_staff']);
const VALID_STATUSES = new Set(['active', 'disabled']);

const normalizeStaffRole = (value) => {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase().replace(/\s+/g, '_');
  return VALID_STAFF_ROLES.has(normalized) ? normalized : null;
};

const getActorName = (user) => {
  if (!user) return 'System';
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return name || user.email || 'System';
};

export async function listStaffAccounts(req, res) {
  try {
    const accounts = await User.find({
      role: { $in: ['admin', 'superadmin'] },
      staffRole: { $in: Array.from(VALID_STAFF_ROLES) },
    })
      .select('_id firstName lastName email staffRole status createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    const shaped = accounts.map((account) => ({
      _id: String(account._id),
      id: String(account._id),
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
      staffRole: account.staffRole,
      status: account.status === 'disabled' ? 'disabled' : 'active',
      lastActiveAt: account.updatedAt || account.createdAt,
    }));

    return res.status(200).json(shaped);
  } catch (error) {
    console.error('List staff accounts error:', error);
    return res.status(500).json({ message: 'Failed to load staff accounts.' });
  }
}

export async function createStaffAccount(req, res) {
  try {
    const { firstName, lastName, email, staffRole, password } = req.body || {};
    if (!firstName || !lastName || !email || !staffRole) {
      return res.status(400).json({ message: 'firstName, lastName, email, and staffRole are required.' });
    }

    const normalizedRole = normalizeStaffRole(staffRole);
    if (!normalizedRole) {
      return res.status(400).json({ message: 'Invalid staff role.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ message: 'A staff account with that email already exists.' });
    }

    const finalPassword = String(password || 'TempPass123!');
    const user = new User({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: cleanEmail,
      role: 'admin',
      staffRole: normalizedRole,
      status: 'active',
      passwordHashed: '',
      verification: { emailVerified: true, phoneVerified: false, identityVerified: false, addressVerified: false },
    });

    await user.setPassword(finalPassword);
    await user.save();

    await monitor.audit({
      actor: req.user?.id || null,
      action: 'staff_account_created',
      ip: req.ip || null,
      userAgent: req.get?.('user-agent') || null,
      status: 'success',
      meta: {
        staffId: String(user._id),
        staffRole: normalizedRole,
        targetEmail: cleanEmail,
      },
    });

    return res.status(201).json({
      message: 'Staff account created.',
      staff: {
        _id: String(user._id),
        id: String(user._id),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        staffRole: user.staffRole,
        status: user.status,
        lastActiveAt: user.updatedAt || user.createdAt,
      },
    });
  } catch (error) {
    console.error('Create staff account error:', error);
    return res.status(500).json({ message: 'Failed to create staff account.' });
  }
}

export async function updateStaffAccountRole(req, res) {
  try {
    const { staffId } = req.params;
    const { staffRole } = req.body || {};
    const normalizedRole = normalizeStaffRole(staffRole);
    if (!normalizedRole) {
      return res.status(400).json({ message: 'Invalid staff role.' });
    }

    const user = await User.findById(staffId);
    if (!user) {
      return res.status(404).json({ message: 'Staff account not found.' });
    }

    const previousRole = user.staffRole;
    user.staffRole = normalizedRole;
    user.role = 'admin';
    await user.save();

    await monitor.audit({
      actor: req.user?.id || null,
      action: 'staff_role_changed',
      ip: req.ip || null,
      userAgent: req.get?.('user-agent') || null,
      status: 'success',
      meta: {
        staffId: String(user._id),
        previousRole,
        nextRole: normalizedRole,
      },
    });

    return res.status(200).json({
      message: 'Staff role updated.',
      staff: {
        _id: String(user._id),
        id: String(user._id),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        staffRole: user.staffRole,
        status: user.status === 'disabled' ? 'disabled' : 'active',
      },
    });
  } catch (error) {
    console.error('Update staff account role error:', error);
    return res.status(500).json({ message: 'Failed to update staff role.' });
  }
}

export async function toggleStaffAccountStatus(req, res) {
  try {
    const { staffId } = req.params;
    const { status } = req.body || {};
    const nextStatus = String(status || '').toLowerCase();
    if (!VALID_STATUSES.has(nextStatus)) {
      return res.status(400).json({ message: 'Status must be active or disabled.' });
    }

    const user = await User.findById(staffId);
    if (!user) {
      return res.status(404).json({ message: 'Staff account not found.' });
    }

    const previousStatus = user.status;
    user.status = nextStatus;
    await user.save();

    await monitor.audit({
      actor: req.user?.id || null,
      action: 'staff_status_changed',
      ip: req.ip || null,
      userAgent: req.get?.('user-agent') || null,
      status: 'success',
      meta: {
        staffId: String(user._id),
        previousStatus,
        nextStatus,
      },
    });

    return res.status(200).json({
      message: `Staff account ${nextStatus === 'disabled' ? 'disabled' : 'enabled'}.`,
      staff: {
        _id: String(user._id),
        id: String(user._id),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        staffRole: user.staffRole,
        status: user.status === 'disabled' ? 'disabled' : 'active',
      },
    });
  } catch (error) {
    console.error('Toggle staff account status error:', error);
    return res.status(500).json({ message: 'Failed to update staff account status.' });
  }
}

export default {
  listStaffAccounts,
  createStaffAccount,
  updateStaffAccountRole,
  toggleStaffAccountStatus,
};
