import User from "../models/User.js";
import Job from "../models/Job.js";
import JobApplication from "../models/JobApplication.js";
import Transaction from "../models/Transaction.js";
import AuditLog from "../models/AuditLog.js";
import Category from "../models/Category.js";

/**
 * ADMIN DASHBOARD STATS
 */
export async function getAdminStats(req, res) {
  try {
    const [
      totalUsers,
      activeUsers,
      totalJobs,
      availableJobs,
      completedJobs,
      totalTransactions,
      totalRevenue,
      totalCategories,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'active' }),
      Job.countDocuments(),
      Job.countDocuments({ status: 'Available' }),
      Job.countDocuments({ status: 'Completed' }),
      Transaction.countDocuments(),
      Transaction.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]).then((result) => (result[0]?.total || 0)),
      Category.countDocuments(),
    ]);

    res.status(200).json({
      totalUsers,
      activeUsers,
      totalJobs,
      availableJobs,
      completedJobs,
      totalTransactions,
      totalRevenue,
      totalCategories,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ message: 'Failed to fetch admin stats', error: error.message });
  }
}

/**
 * USER LIST - for admin management
 */
export async function getAdminUsers(req, res) {
  try {
    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json(users);
  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
}

/**
 * JOB LIST - for admin monitoring
 */
export async function getAdminJobs(req, res) {
  try {
    const jobs = await Job.find({})
      .populate('category', 'name')
      .populate('jobPoster', '_id firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    // Add applicants count
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

/**
 * CATEGORIES - for filtering
 */
export async function getAdminCategories(req, res) {
  try {
    const categories = await Category.find({}).lean();
    res.status(200).json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
  }
}

/**
 * WALLET STATS - for e-wallet monitoring
 */
export async function getAdminWalletStats(req, res) {
  try {
    const users = await User.find({})
      .select('_id firstName lastName email workerBalance employerBalance')
      .lean();

    const walletData = users.map((user) => ({
      userId: user._id,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      email: user.email,
      workerBalance: user.workerBalance || 0,
      employerBalance: user.employerBalance || 0,
    }));

    const totalEscrow = await Transaction.aggregate([
      { $match: { type: 'ESCROW' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).then((result) => result[0]?.total || 0);

    res.status(200).json({
      wallets: walletData,
      totalEscrow,
    });
  } catch (error) {
    console.error('Get wallet stats error:', error);
    res.status(500).json({ message: 'Failed to fetch wallet stats', error: error.message });
  }
}

/**
 * RECENT PAYOUTS - for dashboard display
 */
export async function getAdminRecentPayouts(req, res) {
  try {
    const payouts = await Job.find({ status: 'Completed' })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.status(200).json(payouts);
  } catch (error) {
    console.error('Get recent payouts error:', error);
    res.status(500).json({ message: 'Failed to fetch recent payouts', error: error.message });
  }
}

/**
 * TRANSACTIONS - for e-wallet monitoring
 */
export async function getAdminTransactions(req, res) {
  try {
    const transactions = await Transaction.find({})
      .populate('sender', '_id firstName lastName email')
      .populate('receiver', '_id firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(transactions);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'Failed to fetch transactions', error: error.message });
  }
}
