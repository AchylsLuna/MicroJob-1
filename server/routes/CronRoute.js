import express from 'express';
import { sendPaymentReviewReminders } from '../controllers/PaymentReviewReminderController.js';

const router = express.Router();

router.get('/payment-review-reminders', sendPaymentReviewReminders);

export default router;
