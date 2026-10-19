import express from 'express';
import { sendPaymentReminders, sendDailyPaymentReminders } from '../controllers/PaymentReviewReminderController.js';

const router = express.Router();

router.get('/payment-review-reminders', sendPaymentReminders);
router.get('/daily-payment-reminders', sendDailyPaymentReminders);

export default router;
