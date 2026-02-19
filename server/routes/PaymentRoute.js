// routes/PaymentRoute.js
import express from 'express';
import { createTopUpSession, handleWebhook } from '../controllers/PaymentController.js';
import verifyToken from '../middleware/auth.js';

const router = express.Router();

// The user must be logged in (verifyToken) to top up
router.post('/topup', verifyToken, createTopUpSession);

router.post('/webhook', handleWebhook);

export default router;