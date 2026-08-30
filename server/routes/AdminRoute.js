import { Router } from 'express';
import auth from '../middleware/auth.js';
import requireAdmin from '../middleware/admin.js';
import { requireAdminPermission } from '../middleware/adminPermission.js';
import {
  getAdminStats,
  getAdminUserList,
  getAdminJobs,
  getAdminCategories,
  getAdminWalletStats,
  getAdminRecentPayouts,
  getAdminAuditLogs,
  getAdminTransactions,
  getAdminVerifications,
  updateAdminVerification,
} from '../controllers/AdminController.js';
import { listAdminPayoutRequests, updateAdminPayoutRequest } from '../controllers/PaymentController.js';
import {
  listStaffAccounts,
  createStaffAccount,
  updateStaffAccountRole,
  toggleStaffAccountStatus,
} from '../controllers/StaffController.js';
import {
  listModerationReports,
  enforceModerationReport,
  dismissModerationReport,
} from '../controllers/ModerationController.js';
import {
  listFinancialDisputes,
  investigateFinancialDispute,
  resolveFinancialDispute,
  rejectFinancialDispute,
} from '../controllers/FinancialDisputeController.js';
import {
  listAdminSupportTickets,
  updateAdminSupportTicket,
  getSupportTicketById,
  replyToSupportTicket,
} from '../controllers/SupportController.js';

const router = Router();

router.use(auth);
router.use(requireAdmin);

router.get('/stats', requireAdminPermission('admin.dashboard'), getAdminStats);
router.get('/users', requireAdminPermission('users.view'), getAdminUserList);
router.get('/jobs', requireAdminPermission('jobs.view'), getAdminJobs);
router.get('/categories', requireAdminPermission('admin.dashboard'), getAdminCategories);
router.get('/wallets', requireAdminPermission('finance.transactions.view'), getAdminWalletStats);
router.get('/recent-payouts', requireAdminPermission('finance.payouts.review'), getAdminRecentPayouts);
router.get('/audit-logs', requireAdminPermission('audit.view'), getAdminAuditLogs);
router.get('/transactions', requireAdminPermission('finance.transactions.view'), getAdminTransactions);
router.get('/verifications', requireAdminPermission('verification.review'), getAdminVerifications);
router.patch('/verifications/:userId/:documentType', requireAdminPermission('verification.review'), updateAdminVerification);
router.get('/payout-requests', requireAdminPermission('finance.payouts.review'), listAdminPayoutRequests);
router.patch('/payout-requests/:payoutRequestId', requireAdminPermission('finance.payouts.review'), updateAdminPayoutRequest);
router.get('/support/tickets', requireAdminPermission('support.tickets.handle'), listAdminSupportTickets);
router.get('/support/tickets/:ticketId', requireAdminPermission('support.tickets.handle'), getSupportTicketById);
router.patch('/support/tickets/:ticketId', requireAdminPermission('support.tickets.handle'), updateAdminSupportTicket);
router.post('/support/tickets/:ticketId/replies', requireAdminPermission('support.tickets.handle'), replyToSupportTicket);

router.get('/staff', requireAdminPermission('staff.view'), listStaffAccounts);
router.post('/staff', requireAdminPermission('staff.create'), createStaffAccount);
router.patch('/staff/:staffId/role', requireAdminPermission('staff.assignRole'), updateStaffAccountRole);
router.patch('/staff/:staffId/status', requireAdminPermission('staff.toggleStatus'), toggleStaffAccountStatus);

router.get('/moderation/reports', requireAdminPermission('moderation.review'), listModerationReports);
router.patch('/moderation/reports/:reportId/enforce', requireAdminPermission('moderation.enforce'), enforceModerationReport);
router.patch('/moderation/reports/:reportId/dismiss', requireAdminPermission('moderation.enforce'), dismissModerationReport);

router.get('/finance/disputes', requireAdminPermission('finance.disputes.handle'), listFinancialDisputes);
router.patch('/finance/disputes/:disputeId/investigate', requireAdminPermission('finance.disputes.handle'), investigateFinancialDispute);
router.patch('/finance/disputes/:disputeId/resolve', requireAdminPermission('finance.disputes.handle'), resolveFinancialDispute);
router.patch('/finance/disputes/:disputeId/reject', requireAdminPermission('finance.disputes.handle'), rejectFinancialDispute);

export default router;
