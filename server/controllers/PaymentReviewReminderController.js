import crypto from 'node:crypto';
import { sendDuePaymentReviewReminders } from '../services/paymentReviewReminderService.js';

const isAuthorizedCronRequest = (req) => {
  const secret = String(process.env.CRON_SECRET || '');
  const authorization = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''));
  if (!secret || !authorization) return false;

  const expectedBuffer = Buffer.from(secret);
  const providedBuffer = Buffer.from(authorization[1]);
  return expectedBuffer.length === providedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
};

export async function sendPaymentReviewReminders(req, res) {
  if (!process.env.CRON_SECRET) {
    return res.status(503).json({ message: 'Payment reminder scheduler is not configured.' });
  }
  if (!isAuthorizedCronRequest(req)) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  try {
    const result = await sendDuePaymentReviewReminders();
    return res.json({ message: 'Payment review reminders processed.', ...result });
  } catch (error) {
    console.error('Failed to send payment review reminders:', error);
    return res.status(500).json({ message: 'Payment review reminders could not be processed.' });
  }
}
