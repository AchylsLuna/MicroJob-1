import User from '../models/User.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';
import { hasPermission, resolveStaffRole } from '../lib/adminPermissions.js';
import { isStaffRole, STAFF_ROLE_LIST } from '../lib/staffProfileVisibility.js';

const PAGE_SIZE = 20;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function getMessageRecipients(req, res) {
  if (!hasPermission(resolveStaffRole(req.user), 'messages.recipients.view')) {
    return sendError(res, 403, 'Only admin staff can browse message recipients.');
  }
  try {
    const audience = String(req.query?.audience || 'all');
    if (!['all', 'admins', 'users'].includes(audience)) {
      return sendError(res, 400, 'Choose a valid recipient group.');
    }
    const filter = { _id: { $ne: req.user.id }, status: 'active' };
    if (audience === 'admins') filter.role = { $in: STAFF_ROLE_LIST };
    if (audience === 'users') filter.role = { $nin: STAFF_ROLE_LIST };
    const terms = String(req.query?.search || '').trim().slice(0, 100).split(/\s+/).filter(Boolean).slice(0, 5);
    if (terms.length) {
      filter.$and = terms.map((term) => {
        const regex = new RegExp(escapeRegex(term), 'i');
        return { $or: ['firstName', 'lastName', 'email', 'username', 'companyName'].map((field) => ({ [field]: regex })) };
      });
    }
    const total = await User.countDocuments(filter);
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const requestedPage = Number.parseInt(String(req.query?.page || 1), 10);
    const page = Math.min(pageCount, Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1));
    const users = await User.find(filter)
      .select('_id firstName lastName email role staffRole companyName')
      .sort({ firstName: 1, lastName: 1, _id: 1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean();
    const recipients = users.map((user) => ({
      id: String(user._id),
      name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.companyName || user.email,
      email: user.email,
      role: user.staffRole || user.role,
      isStaff: isStaffRole(user.role),
    }));
    return sendSuccess(res, 200, 'Message recipients retrieved', { recipients, total, page, pageCount, pageSize: PAGE_SIZE });
  } catch (error) {
    console.error('Message recipient directory failed:', error?.name || 'unknown_error');
    return sendError(res, 500, 'Unable to load message recipients.');
  }
}
