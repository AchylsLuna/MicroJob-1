import { Router } from 'express';
import { exportLifecycleReport } from '../controllers/LifecycleReportController.js';
import { reconcile } from '../controllers/WithdrawalController.js';
import auth from '../middleware/auth.js';
import requireAdmin, { requireAnyPermission, requirePermission } from '../middleware/admin.js';
import adminAuditLog from '../middleware/adminAuditLog.js';
import { getGovernmentIdVerifications, revokeGovernmentIdVerification } from '../controllers/AdminGovernmentIdController.js';
import {
  getAdminStats,
  getAdminAnalyticsData,
  getAdminUserList,
  getAdminJobs,
  getAdminCategories,
  getAdminWalletStats,
  getAdminRecentPayouts,
  getAdminTransactions,
  getAdminVerifications,
  updateAdminVerification,
  getAdminAuditLogs,
  banAdminUser,
  unlockAdminUser,
  requestAdminUserPasswordReset,
  updateAdminUserSuspiciousFlag,
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
import {
  getDisputeContext,
  approveFinancialDisputeSettlement,
  assignFinancialDisputeSupport,
  completeFinancialDisputeInvestigation,
  listAdminFinancialDisputes,
  proposeFinancialDisputeSettlement,
  requestFinancialDisputeEvidence,
  updateAdminFinancialDispute,
} from '../controllers/AdminFinanceDisputeController.js';

const router = Router();

router.use(auth);
router.use(requireAdmin);
// Auto-logs every mutating request below, regardless of staff sub-role or
// whether the controller calls monitor.audit() itself — see
// docs/frontend-only-scope.md §7 and middleware/adminAuditLog.js.
router.use(adminAuditLog);

// /stats mixes user, job, category, and financial aggregates
// (completedPayoutVolume, totalTransactions, pendingPayouts) into one
// summary, so it is gated like the other cross-cutting view: analytics.view.
router.get('/reports/:type', requirePermission('analytics.export'), exportLifecycleReport);
router.get('/stats', requirePermission('analytics.view'), getAdminStats);
router.get('/analytics-data', requirePermission('analytics.view'), getAdminAnalyticsData);
router.get('/users', requirePermission('users.view'), getAdminUserList);
router.patch('/users/:userId/suspicious-flag', requirePermission('users.flag'), updateAdminUserSuspiciousFlag);
router.post('/users/:userId/password-reset', requirePermission('users.resetPassword'), requestAdminUserPasswordReset);
router.patch('/users/:userId/unlock', requirePermission('users.unlock'), unlockAdminUser);
router.patch('/users/:userId/ban', requirePermission('users.ban'), banAdminUser);
router.get('/jobs', requirePermission('jobs.view'), getAdminJobs);
// Category taxonomy is job metadata, so it shares jobs.view.
router.get('/categories', requirePermission('jobs.view'), getAdminCategories);
router.get('/wallets', requirePermission('finance.transactions.view'), getAdminWalletStats);
router.get('/recent-payouts', requirePermission('finance.payouts.review'), getAdminRecentPayouts);
router.get('/transactions', requirePermission('finance.transactions.view'), getAdminTransactions);
router.get('/verifications', requirePermission('verification.review'), getAdminVerifications);
router.get('/government-id-verifications', requirePermission('verification.review'), getGovernmentIdVerifications);
router.patch('/government-id-verifications/:verificationId/revoke', requirePermission('verification.review'), revokeGovernmentIdVerification);
router.patch('/verifications/:userId/:documentType', requirePermission('verification.review'), updateAdminVerification);
router.post('/payout-requests/:id/reconcile', requirePermission('finance.payouts.review'), reconcile);
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

router.get('/finance/disputes/:disputeId/context', requirePermission('finance.disputes.view'), getDisputeContext);
router.get('/finance/disputes', requirePermission('finance.disputes.view'), listAdminFinancialDisputes);
router.patch('/finance/disputes/:disputeId', requireAnyPermission('finance.disputes.investigate', 'finance.disputes.review'), updateAdminFinancialDispute);
router.post('/finance/disputes/:disputeId/assign-support', requirePermission('finance.disputes.investigate'), assignFinancialDisputeSupport);
router.post('/finance/disputes/:disputeId/evidence-request', requirePermission('finance.disputes.investigate'), requestFinancialDisputeEvidence);
router.post('/finance/disputes/:disputeId/investigation-report', requirePermission('finance.disputes.investigate'), completeFinancialDisputeInvestigation);
router.post('/finance/disputes/:disputeId/settlement', requirePermission('finance.disputes.review'), proposeFinancialDisputeSettlement);
router.post('/finance/disputes/:disputeId/settlement/approve', requirePermission('finance.disputes.approve'), approveFinancialDisputeSettlement);

export default router;
