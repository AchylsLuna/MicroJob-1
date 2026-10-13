import express from 'express';
import { sendPaymentReminders } from '../controllers/PaymentReviewReminderController.js';

const router = express.Router();

router.get('/payment-review-reminders', sendPaymentReminders);

export default router;
