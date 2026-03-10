// routes/PaymentRoute.js
import express from 'express';
import {
  createTopUpSession,
  handleWebhook,
  getUserTransactions,
  getAllTransactions,
  confirmTopUp,
  simulateWebhook,
} from '../controllers/PaymentController.js';
import verifyToken from '../middleware/auth.js';
import requireAdmin from '../middleware/admin.js';

const router = express.Router();

// The user must be logged in (verifyToken) to top up
router.post('/topup', verifyToken, createTopUpSession);
router.get('/transactions', verifyToken, getUserTransactions);

router.post('/topup/confirm', verifyToken, confirmTopUp);

// Dev-only webhook simulator for local testing
router.post('/dev/webhook-sim', verifyToken, requireAdmin, simulateWebhook);

// Admin audit endpoint: recent transactions
router.get('/audit', verifyToken, getAllTransactions);

router.post('/webhook', handleWebhook);

export default router;
