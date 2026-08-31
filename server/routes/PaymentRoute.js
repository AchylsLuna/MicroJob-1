import express from 'express';
import {
  createTopUpSession,
  handleWebhook,
  getUserTransactions,
  emailTransactionReceipt,
  getMobileWallet,
  getAllTransactions,
  confirmTopUp,
  simulateWebhook,
  createPayoutRequest,
  listMyPayoutRequests,
  cancelPayoutRequest,
} from '../controllers/PaymentController.js';
import {
  addPaymentMethod,
  listPaymentMethods,
  removePaymentMethod,
  setDefaultPaymentMethod,
} from '../controllers/PaymentMethodController.js';
import { createQrSettlementRequest, resolveQrSettlementRequest, settleQrSettlementRequest, cancelQrSettlementRequest, listQrSettlementRequests, getQrSettlementRequest, getQrSettlementImage } from '../controllers/QrSettlementController.js';
import { qrSettlementLimiter } from '../lib/rateLimiters.js';
import verifyToken from '../middleware/auth.js';
import requireAdmin, { requireSuperadmin } from '../middleware/admin.js';

const router = express.Router();

router.post('/topup', verifyToken, createTopUpSession);
  router.get('/transactions', verifyToken, getUserTransactions);
router.post('/transactions/:transactionId/receipt/email', verifyToken, emailTransactionReceipt);
router.get('/wallet', verifyToken, getMobileWallet);
router.post('/qr-requests', verifyToken, qrSettlementLimiter, createQrSettlementRequest);
router.get('/qr-requests', verifyToken, listQrSettlementRequests);
router.post('/qr-requests/resolve', verifyToken, qrSettlementLimiter, resolveQrSettlementRequest);
router.get('/qr-requests/:requestId', verifyToken, getQrSettlementRequest);
router.get('/qr-requests/:requestId/image', verifyToken, getQrSettlementImage);
router.post('/qr-requests/:requestId/settle', verifyToken, qrSettlementLimiter, settleQrSettlementRequest);
router.post('/qr-requests/:requestId/cancel', verifyToken, qrSettlementLimiter, cancelQrSettlementRequest);
router.post('/topup/confirm', verifyToken, confirmTopUp);
router.get('/methods', verifyToken, listPaymentMethods);
router.post('/methods', verifyToken, addPaymentMethod);
router.patch('/methods/:paymentMethodId/default', verifyToken, setDefaultPaymentMethod);
router.delete('/methods/:paymentMethodId', verifyToken, removePaymentMethod);
router.get('/payout-requests', verifyToken, listMyPayoutRequests);
router.post('/payout-requests', verifyToken, createPayoutRequest);
router.post('/payout-requests/:payoutRequestId/cancel', verifyToken, cancelPayoutRequest);
router.post('/dev/webhook-sim', verifyToken, requireAdmin, requireSuperadmin, simulateWebhook);
router.get('/audit', verifyToken, getAllTransactions);
router.post('/webhook', handleWebhook);

export default router;
