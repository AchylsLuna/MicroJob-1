import User from '../models/User.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import Transaction from '../models/Transaction.js';
import Category from '../models/Category.js';
import PayoutRequest from '../models/PayoutRequest.js';
import SupportTicket from '../models/SupportTicket.js';

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
      Job.countDocuments({ status: 'Available' }),
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

export async function getAdminUsers(req, res) {
  try {
    const users = await User.find({})
      .select('-passwordHashed -mfaSecret -mfaPendingSecret -mfaBackupCodes')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json(users);
  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
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

    res.status(200).json(jobsWithCounts);
  } catch (error) {
    console.error('Get admin jobs error:', error);
    res.status(500).json({ message: 'Failed to fetch jobs', error: error.message });
  }
}

export async function getAdminCategories(req, res) {
  try {
    const categories = await Category.find({}).lean();
    res.status(200).json(categories);
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
