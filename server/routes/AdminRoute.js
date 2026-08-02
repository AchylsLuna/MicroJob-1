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
  getAdminVerifications,
  updateAdminVerification,
} from '../controllers/AdminController.js';
import { listAdminPayoutRequests, updateAdminPayoutRequest } from '../controllers/PaymentController.js';
import {
  listAdminSupportTickets,
  updateAdminSupportTicket,
  getSupportTicketById,
  replyToSupportTicket,
} from '../controllers/SupportController.js';

const router = Router();

router.use(auth);
router.use(requireAdmin);

router.get('/stats', getAdminStats);
router.get('/users', getAdminUsers);
router.get('/jobs', getAdminJobs);
router.get('/categories', getAdminCategories);
router.get('/wallets', getAdminWalletStats);
router.get('/recent-payouts', getAdminRecentPayouts);
router.get('/transactions', getAdminTransactions);
router.get('/verifications', getAdminVerifications);
router.patch('/verifications/:userId/:documentType', updateAdminVerification);
router.get('/payout-requests', listAdminPayoutRequests);
router.patch('/payout-requests/:payoutRequestId', updateAdminPayoutRequest);
router.get('/support/tickets', listAdminSupportTickets);
router.get('/support/tickets/:ticketId', getSupportTicketById);
router.patch('/support/tickets/:ticketId', updateAdminSupportTicket);
router.post('/support/tickets/:ticketId/replies', replyToSupportTicket);

export default router;
