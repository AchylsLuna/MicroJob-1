import express from 'express';
import {
  createTopUpSession,
  handleWebhook,
  getUserTransactions,
  getAllTransactions,
  confirmTopUp,
  simulateWebhook,
  createPayoutRequest,
  listMyPayoutRequests,
  cancelPayoutRequest,
} from '../controllers/PaymentController.js';
import verifyToken from '../middleware/auth.js';
import requireAdmin from '../middleware/admin.js';

const router = express.Router();

router.post('/topup', verifyToken, createTopUpSession);
router.get('/transactions', verifyToken, getUserTransactions);
router.post('/topup/confirm', verifyToken, confirmTopUp);
router.get('/payout-requests', verifyToken, listMyPayoutRequests);
router.post('/payout-requests', verifyToken, createPayoutRequest);
router.post('/payout-requests/:payoutRequestId/cancel', verifyToken, cancelPayoutRequest);
router.post('/dev/webhook-sim', verifyToken, requireAdmin, simulateWebhook);
router.get('/audit', verifyToken, getAllTransactions);
router.post('/webhook', handleWebhook);

export default router;
