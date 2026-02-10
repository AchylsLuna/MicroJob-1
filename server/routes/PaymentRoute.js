import express from 'express';
import { createTopUp, xenditWebhook } from '../controllers/PaymentController.js';
import authenticateToken from '../middleware/auth.js';

const router = express.Router();
router.post('/topup', authenticateToken, createTopUp);
router.post('/webhook/xendit', xenditWebhook);
router.get('/balance', authenticateToken);

export default router;