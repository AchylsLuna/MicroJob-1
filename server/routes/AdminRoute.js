import { Router } from 'express';
import auth from '../middleware/auth.js';
import requireAdmin, { requirePermission } from '../middleware/admin.js';
import adminAuditLog from '../middleware/adminAuditLog.js';
import {
  getAdminStats,
  getAdminUserList,
  getAdminJobs,
  getAdminCategories,
  getAdminWalletStats,
  getAdminRecentPayouts,
  getAdminTransactions,
  getAdminVerifications,
  updateAdminVerification,
  getAdminAuditLogs,
} from '../controllers/AdminController.js';
import { listAdminPayoutRequests, updateAdminPayoutRequest } from '../controllers/PaymentController.js';
import {
  listAdminSupportTickets,
  updateAdminSupportTicket,
  getSupportTicketById,
  replyToSupportTicket,
} from '../controllers/SupportController.js';
import { getAdminStaffList, createAdminStaff, updateAdminStaff } from '../controllers/AdminStaffController.js';
import { listAdminModerationReports, updateAdminModerationReport } from '../controllers/AdminModerationController.js';
import { listAdminFinancialDisputes, updateAdminFinancialDispute } from '../controllers/AdminFinanceDisputeController.js';

const router = Router();

router.use(auth);
router.use(requireAdmin);
// Auto-logs every mutating request below, regardless of staff sub-role or
// whether the controller calls monitor.audit() itself — see
// docs/frontend-only-scope.md §7 and middleware/adminAuditLog.js.
router.use(adminAuditLog);

router.get('/stats', getAdminStats);
router.get('/users', requirePermission('users.view'), getAdminUserList);
router.get('/jobs', requirePermission('jobs.view'), getAdminJobs);
router.get('/categories', getAdminCategories);
router.get('/wallets', requirePermission('finance.transactions.view'), getAdminWalletStats);
router.get('/recent-payouts', requirePermission('finance.payouts.review'), getAdminRecentPayouts);
router.get('/transactions', requirePermission('finance.transactions.view'), getAdminTransactions);
router.get('/verifications', requirePermission('verification.review'), getAdminVerifications);
router.patch('/verifications/:userId/:documentType', requirePermission('verification.review'), updateAdminVerification);
router.get('/payout-requests', requirePermission('finance.payouts.review'), listAdminPayoutRequests);
router.patch('/payout-requests/:payoutRequestId', requirePermission('finance.payouts.review'), updateAdminPayoutRequest);
router.get('/support/tickets', requirePermission('support.tickets.handle'), listAdminSupportTickets);
router.get('/support/tickets/:ticketId', requirePermission('support.tickets.handle'), getSupportTicketById);
router.patch('/support/tickets/:ticketId', requirePermission('support.tickets.handle'), updateAdminSupportTicket);
router.post('/support/tickets/:ticketId/replies', requirePermission('support.tickets.handle'), replyToSupportTicket);

router.get('/audit-logs', requirePermission('audit.view'), getAdminAuditLogs);

router.get('/staff', requirePermission('staff.view'), getAdminStaffList);
router.post('/staff', requirePermission('staff.create'), createAdminStaff);
router.patch('/staff/:userId', requirePermission('staff.assignRole'), updateAdminStaff);

router.get('/moderation/reports', requirePermission('moderation.review'), listAdminModerationReports);
router.patch('/moderation/reports/:reportId', requirePermission('moderation.enforce'), updateAdminModerationReport);

router.get('/finance/disputes', requirePermission('finance.disputes.handle'), listAdminFinancialDisputes);
router.patch('/finance/disputes/:disputeId', requirePermission('finance.disputes.handle'), updateAdminFinancialDispute);

export default router;
