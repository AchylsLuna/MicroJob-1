import User from '../models/User.js';
import Job from '../models/Job.js';
import { availableJobFilter } from '../lib/lifecyclePolicy.js';
import JobApplication from '../models/JobApplication.js';
import Transaction from '../models/Transaction.js';
import Category from '../models/Category.js';
import PayoutRequest from '../models/PayoutRequest.js';
import SupportTicket from '../models/SupportTicket.js';
import AuditLog from '../models/AuditLog.js';
import Session from '../models/Session.js';
import { requestPasswordResetOtp } from './UserController.js';
import { hasPermission, resolveStaffRole } from '../lib/adminPermissions.js';
import {
  CATEGORY_PUBLIC_FIELDS,
  serializeCategories,
  withPublicCategories,
} from '../lib/categoryPresentation.js';

export async function getAdminStats(req, res) {
  try {
    const [
      totalUsers,
      activeUsers,
      pendingUsers,
      disabledUsers,
      deletedUsers,
      totalJobs,
      availableJobs,
      completedJobs,
      totalTransactions,
      completedPayoutVolume,
      totalCategories,
      pendingPayouts,
      openSupportTickets,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'pending' }),
      User.countDocuments({ status: 'disabled' }),
      User.countDocuments({ status: 'deleted' }),
      Job.countDocuments(),
      Job.countDocuments(availableJobFilter()),
      Job.countDocuments({ status: 'Completed' }),
      Transaction.countDocuments(),
      Transaction.aggregate([
        { $match: { type: 'PAYOUT', status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]).then((result) => result[0]?.total || 0),
      Category.countDocuments(),
      PayoutRequest.countDocuments({ status: { $in: ['requested', 'approved'] } }),
      SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress', 'waiting_user'] } }),
    ]);

    res.status(200).json({
      totalUsers,
      activeUsers,
      pendingUsers,
      disabledUsers,
      deletedUsers,
      totalJobs,
      availableJobs,
      completedJobs,
      totalTransactions,
      completedPayoutVolume,
      totalCategories,
      pendingPayouts,
      openSupportTickets,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ message: 'Failed to fetch admin stats', error: error.message });
  }
}

/**
 * Privacy-limited dataset for Analytics and Reports. Analytics staff need real
 * platform trends without inheriting the much broader users.view, jobs.view,
 * or finance.transactions.view permissions. Personal names, emails, wallet
 * destinations, counterparties, and document data are intentionally omitted.
 */
export async function getAdminAnalyticsData(req, res) {
  try {
    const [users, jobs, transactions, stats] = await Promise.all([
      User.find({}).select('_id role status createdAt').sort({ createdAt: -1 }).lean(),
      Job.find({})
        .select('_id title status salary createdAt category applicants hiredCount viewCount')
        .populate('category', 'name')
        .sort({ createdAt: -1 })
        .lean(),
      Transaction.find({})
        .select('_id amount type status balanceTarget createdAt')
        .sort({ createdAt: -1 })
        .lean(),
      Promise.all([
        User.countDocuments(),
        User.countDocuments({ status: 'active' }),
        User.countDocuments({ status: 'pending' }),
        User.countDocuments({ status: 'disabled' }),
        User.countDocuments({ status: 'deleted' }),
        Job.countDocuments(),
        Job.countDocuments(availableJobFilter()),
        Job.countDocuments({ status: 'Completed' }),
        Job.distinct('applicants').then((applicantIds) => applicantIds.length),
        Transaction.countDocuments(),
        Transaction.aggregate([
          { $match: { type: 'PAYOUT', status: 'COMPLETED' } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]).then((result) => result[0]?.total || 0),
        Category.countDocuments(),
        PayoutRequest.countDocuments({ status: { $in: ['requested', 'approved'] } }),
        SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress', 'waiting_user'] } }),
      ]),
    ]);

    const [
      totalUsers,
      activeUsers,
      pendingUsers,
      disabledUsers,
      deletedUsers,
      totalJobs,
      availableJobs,
      completedJobs,
      uniqueApplicants,
      totalTransactions,
      completedPayoutVolume,
      totalCategories,
      pendingPayouts,
      openSupportTickets,
    ] = stats;

    return res.status(200).json({
      stats: {
        totalUsers,
        activeUsers,
        pendingUsers,
        disabledUsers,
        deletedUsers,
        totalJobs,
        availableJobs,
        completedJobs,
        uniqueApplicants,
        totalTransactions,
        completedPayoutVolume,
        totalCategories,
        pendingPayouts,
        openSupportTickets,
      },
      users: users.map((user) => ({ ...user, firstName: '', lastName: '', email: '' })),
      jobs: withPublicCategories(jobs.map((job) => ({
        ...job,
        applicantsCount: Array.isArray(job.applicants) ? job.applicants.length : 0,
        applicants: [],
        jobPoster: null,
      }))),
      transactions: transactions.map((transaction) => ({
        ...transaction,
        sender: null,
        receiver: null,
        reference: '',
      })),
    });
  } catch (error) {
    console.error('Admin analytics data error:', error);
    return res.status(500).json({ message: 'Failed to fetch analytics data.' });
  }
}

export async function getAdminUserList(req, res) {
  try {
    const staffRole = resolveStaffRole(req.user);
    const mayViewStaffAccounts = hasPermission(staffRole, 'users.staff.view');
    const accountFilter = mayViewStaffAccounts
      ? { role: { $ne: 'superadmin' } }
      : { role: { $in: ['work', 'hire', 'both'] } };
    const users = await User.find(accountFilter)
      .select('-passwordHashed -mfaSecret -mfaPendingSecret -mfaBackupCodes +lockUntil +secondaryEmail +secondaryEmailVerifiedAt')
      .sort({ createdAt: -1 })
      .lean();
    const mayReviewVerification = hasPermission(staffRole, 'verification.review');
    res.status(200).json(users.map(({ lockUntil, secondaryEmail, secondaryEmailVerifiedAt, ...user }) => {
      if (!mayReviewVerification && user.verification) {
        for (const documentKey of ['identityDocument', 'addressDocument']) {
          if (user.verification[documentKey]) delete user.verification[documentKey].documentUrl;
        }
      }
      return {
        ...user,
        ...(user.role === 'admin' ? { otpEnabled: Boolean(secondaryEmail && secondaryEmailVerifiedAt) } : {}),
        loginLocked: Boolean(lockUntil && new Date(lockUntil).getTime() > Date.now()),
      };
    }));
  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
}

const isMarketplaceAccount = (user) => ['work', 'hire', 'both'].includes(String(user?.role || ''));

export async function updateAdminUserSuspiciousFlag(req, res) {
  try {
    const flagged = req.body?.flagged !== false;
    const reason = String(req.body?.reason || '').trim();
    if (flagged && !reason) {
      return res.status(400).json({ message: 'A reason is required when flagging a user as suspicious.' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!isMarketplaceAccount(user)) {
      return res.status(403).json({ message: 'Only worker and employer accounts can be flagged as suspicious.' });
    }

    user.suspiciousFlagged = flagged;
    user.suspiciousFlagReason = flagged ? reason : null;
    user.suspiciousFlaggedAt = flagged ? new Date() : null;
    user.suspiciousFlaggedBy = flagged ? (req.user?.id || req.user?.userId || null) : null;
    await user.save();

    return res.status(200).json({
      message: flagged ? 'User flagged as suspicious.' : 'Suspicious flag cleared.',
      user: {
        _id: user._id,
        suspiciousFlagged: user.suspiciousFlagged,
        suspiciousFlagReason: user.suspiciousFlagReason,
        suspiciousFlaggedAt: user.suspiciousFlaggedAt,
        suspiciousFlaggedBy: user.suspiciousFlaggedBy,
      },
    });
  } catch (error) {
    console.error('Update suspicious user flag error:', error);
    return res.status(500).json({ message: 'Failed to update the suspicious-user flag.' });
  }
}

export async function banAdminUser(req, res) {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ message: 'A ban reason is required.' });

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!isMarketplaceAccount(user)) {
      return res.status(403).json({ message: 'Staff accounts cannot be banned from User Management.' });
    }
    if (String(user._id) === String(req.user?.id || req.user?.userId || '')) {
      return res.status(403).json({ message: 'You cannot ban your own account.' });
    }

    user.status = 'banned';
    user.bannedAt = new Date();
    user.bannedBy = req.user?.id || req.user?.userId || null;
    user.banReason = reason;
    await user.save();
    await Session.updateMany(
      { user: user._id, active: true },
      { $set: { active: false, endedAt: new Date() } },
    );

    return res.status(200).json({
      message: 'User banned.',
      user: {
        _id: user._id,
        status: user.status,
        bannedAt: user.bannedAt,
        bannedBy: user.bannedBy,
        banReason: user.banReason,
      },
    });
  } catch (error) {
    console.error('Ban admin user error:', error);
    return res.status(500).json({ message: 'Failed to ban user.' });
  }
}

export async function unlockAdminUser(req, res) {
  try {
    const user = await User.findById(req.params.userId).select('+failedLoginAttempts +loginLockCount +lockUntil');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!isMarketplaceAccount(user)) {
      return res.status(403).json({ message: 'Staff accounts cannot be unlocked from User Management.' });
    }

    await user.clearLoginLock();
    return res.status(200).json({ message: 'Account login lock cleared.', userId: user._id, loginLocked: false });
  } catch (error) {
    console.error('Unlock admin user error:', error);
    return res.status(500).json({ message: 'Failed to unlock account.' });
  }
}

export async function requestAdminUserPasswordReset(req, res) {
  try {
    const user = await User.findById(req.params.userId).select('email role status');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!isMarketplaceAccount(user) || user.status === 'deleted') {
      return res.status(403).json({ message: 'Password reset is unavailable for this account.' });
    }

    // A purpose-built request object rather than `Object.create(req)`.
    //
    // Prototype-chaining the caller's request carried the *staff member's* own
    // `Origin`/`Referer` headers into getFrontendResetUrl, so a support agent
    // could trigger a genuine reset email for any marketplace user with the
    // link pointing at a host of their choosing (this endpoint is gated only on
    // `users.resetPassword`, which support_staff holds). The headers are now
    // dropped deliberately, which makes the reset URL fall back to configured
    // origins only -- see lib/runtimeConfig.originFromRequest.
    const resetRequest = {
      body: { email: user.email },
      headers: {},
      ip: req.ip,
      get: () => undefined,
    };
    return requestPasswordResetOtp(resetRequest, res);
  } catch (error) {
    console.error('Admin password reset request error:', error);
    return res.status(500).json({ message: 'Failed to send password reset email.' });
  }
}

export async function getAdminVerifications(req, res) {
  try {
    const requestedStatus = String(req.query?.status || 'in-review').toLowerCase();
    const allowedStatuses = new Set(['pending', 'in-review', 'complete', 'rejected', 'all']);
    if (!allowedStatuses.has(requestedStatus)) {
      return res.status(400).json({ message: 'Invalid verification status.' });
    }

    const query = requestedStatus === 'all'
      ? {
          $or: [
            { 'verification.identityDocument.documentUrl': { $exists: true, $ne: '' } },
            { 'verification.addressDocument.documentUrl': { $exists: true, $ne: '' } },
          ],
        }
      : {
          $or: [
            { 'verification.identityDocument.status': requestedStatus },
            { 'verification.addressDocument.status': requestedStatus },
          ],
        };

    const users = await User.find(query)
      .select('_id firstName lastName email status verification createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .lean();
    return res.status(200).json(users);
  } catch (error) {
    console.error('Get admin verifications error:', error);
    return res.status(500).json({ message: 'Failed to fetch verification requests.' });
  }
}

export async function updateAdminVerification(req, res) {
  try {
    const { userId, documentType } = req.params;
    const status = String(req.body?.status || '').toLowerCase();
    const rejectionReason = String(req.body?.rejectionReason || '').trim();

    if (!['identity', 'address'].includes(documentType)) {
      return res.status(400).json({ message: 'Document type must be identity or address.' });
    }
    if (!['complete', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Review status must be complete or rejected.' });
    }
    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({ message: 'A rejection reason is required.' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const documentKey = `${documentType}Document`;
    const verifiedKey = `${documentType}Verified`;
    const verificationDocument = user.verification?.[documentKey];
    if (!verificationDocument?.documentUrl) {
      return res.status(400).json({ message: 'No uploaded document is available for review.' });
    }

    user.verification = user.verification || {};
    verificationDocument.status = status;
    verificationDocument.reviewedAt = new Date();
    verificationDocument.reviewedBy = req.user.id;
    verificationDocument.rejectionReason = status === 'rejected' ? rejectionReason : undefined;
    user.verification[verifiedKey] = status === 'complete';
    await user.save();

    return res.status(200).json({
      message: `Verification document ${status === 'complete' ? 'approved' : 'rejected'}.`,
      userId: user._id,
      documentType,
      status,
      verified: user.verification[verifiedKey],
    });
  } catch (error) {
    console.error('Update admin verification error:', error);
    return res.status(500).json({ message: 'Failed to update verification request.' });
  }
}

export async function getAdminJobs(req, res) {
  try {
    const jobs = await Job.find({})
      .populate('category', 'name')
      .populate('jobPoster', '_id firstName lastName email companyName status')
      .sort({ createdAt: -1 })
      .lean();

    const jobsWithCounts = await Promise.all(
      jobs.map(async (job) => {
        const applicantsCount = await JobApplication.countDocuments({ job: job._id });
        return { ...job, applicants: job.applicants || [], applicantsCount };
      })
    );

    res.status(200).json(withPublicCategories(jobsWithCounts));
  } catch (error) {
    console.error('Get admin jobs error:', error);
    res.status(500).json({ message: 'Failed to fetch jobs', error: error.message });
  }
}

export async function getAdminCategories(req, res) {
  try {
    const categories = await Category.find({}, CATEGORY_PUBLIC_FIELDS).lean();
    res.status(200).json(serializeCategories(categories));
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
  }
}

export async function getAdminWalletStats(req, res) {
  try {
    const [users, payoutSummary] = await Promise.all([
      User.find({})
        .select('_id firstName lastName email workerBalance employerBalance status deletedAt redactedAt')
        .lean(),
      PayoutRequest.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            total: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    const walletData = users.map((user) => ({
      userId: user._id,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      email: user.email,
      status: user.status,
      deletedAt: user.deletedAt || null,
      redactedAt: user.redactedAt || null,
      workerBalance: user.workerBalance || 0,
      employerBalance: user.employerBalance || 0,
    }));

    const summaryMap = payoutSummary.reduce((acc, item) => {
      acc[item._id] = item;
      return acc;
    }, {});

    const completedCount = (summaryMap.paid?.count || 0);
    const pendingCount = (summaryMap.requested?.count || 0) + (summaryMap.approved?.count || 0);
    const completedTotal = summaryMap.paid?.total || 0;
    const pendingTotal = (summaryMap.requested?.total || 0) + (summaryMap.approved?.total || 0);
    const averageCompleted = completedCount ? completedTotal / completedCount : 0;
    const totalEscrow = await Transaction.aggregate([
      {
        $match: {
          jobReference: { $ne: null },
          status: 'COMPLETED',
          type: { $in: ['ESCROW', 'PAYOUT', 'REFUND'] },
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: [{ $eq: ['$type', 'ESCROW'] }, '$amount', { $multiply: ['$amount', -1] }],
            },
          },
        },
      },
    ]).then((result) => Math.max(0, result[0]?.total || 0));

    res.status(200).json({
      wallets: walletData,
      totalEscrow,
      completedCount,
      pendingCount,
      completedTotal,
      pendingTotal,
      averageCompleted,
    });
  } catch (error) {
    console.error('Get wallet stats error:', error);
    res.status(500).json({ message: 'Failed to fetch wallet stats', error: error.message });
  }
}

export async function getAdminRecentPayouts(req, res) {
  try {
    const payouts = await PayoutRequest.find({ status: 'paid' })
      .populate('user', 'firstName lastName email')
      .populate('reviewer', 'firstName lastName email')
      .populate('transaction')
      .sort({ paidAt: -1, updatedAt: -1 })
      .limit(5)
      .lean();

    res.status(200).json(payouts);
  } catch (error) {
    console.error('Get recent payouts error:', error);
    res.status(500).json({ message: 'Failed to fetch recent payouts', error: error.message });
  }
}

/** GET /admin/audit-logs — recent admin-role activity, most recent first. */
export async function getAdminAuditLogs(req, res) {
  try {
    const limit = Math.min(Math.max(Number(req.query?.limit) || 200, 1), 500);
    const logs = await AuditLog.find({})
      .populate('actor', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json(
      logs.map((log) => ({
        id: log._id,
        actor: log.actor
          ? `${log.actor.firstName || ''} ${log.actor.lastName || ''}`.trim() || log.actor.email
          : 'System',
        action: log.action,
        target: log.target || '—',
        category: log.category === 'error' ? 'error' : 'system',
        reason: log.reason || undefined,
        at: log.createdAt,
      })),
    );
  } catch (error) {
    console.error('Get admin audit logs error:', error);
    return res.status(500).json({ message: 'Failed to fetch audit logs.' });
  }
}

export async function getAdminTransactions(req, res) {
  try {
    const transactions = await Transaction.find({})
      .populate('sender', '_id firstName lastName email role status')
      .populate('receiver', '_id firstName lastName email role status')
      .populate({ path: 'jobReference', select: '_id title status jobPoster', populate: { path: 'jobPoster', select: '_id firstName lastName email' } })
      .populate('payoutRequest', '_id status amount destinationSnapshot reviewedAt paidAt')
      .populate('linkedTransaction', '_id type status amount createdAt reference')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(transactions);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'Failed to fetch transactions', error: error.message });
  }
}
