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
      totalRevenue,
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
      Transaction.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]).then((result) => result[0]?.total || 0),
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
      totalRevenue,
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
      { $match: { type: 'ESCROW' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).then((result) => result[0]?.total || 0);

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
      .populate('jobReference', '_id title status')
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
