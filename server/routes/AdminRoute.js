import { Router } from 'express';
import auth from '../middleware/auth.js';
import requireAdmin from '../middleware/admin.js';
import {
  getAdminStats,
  getAdminUsers,
  getAdminJobs,
  getAdminCategories,
  getAdminWalletStats,
  getAdminRecentPayouts,
  getAdminTransactions,
} from '../controllers/AdminController.js';

const router = Router();

// Protect all admin routes with auth and admin middleware
router.use(auth);
router.use(requireAdmin);

/**
 * ADMIN ENDPOINTS
 */
router.get('/stats', getAdminStats);
router.get('/users', getAdminUsers);
router.get('/jobs', getAdminJobs);
router.get('/categories', getAdminCategories);
router.get('/wallets', getAdminWalletStats);
router.get('/recent-payouts', getAdminRecentPayouts);
router.get('/transactions', getAdminTransactions);

export default router;
