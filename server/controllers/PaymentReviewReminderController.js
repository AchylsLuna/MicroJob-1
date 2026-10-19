import crypto from 'node:crypto';
import { sendDuePaymentReminders } from '../services/paymentReviewReminderService.js';
import { checkPendingDailyPayments } from '../services/dailyPayments.js';
import { deliverOutbox } from '../services/notificationOutbox.js';

const isAuthorizedCronRequest = (req) => {
  const secret = String(process.env.CRON_SECRET || '');
  const authorization = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''));
  if (!secret || !authorization) return false;

  const expectedBuffer = Buffer.from(secret);
  const providedBuffer = Buffer.from(authorization[1]);
  return expectedBuffer.length === providedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
};

export async function sendPaymentReminders(req, res) {
  if (!process.env.CRON_SECRET) {
    return res.status(503).json({ message: 'Payment reminder scheduler is not configured.' });
  }
  if (!isAuthorizedCronRequest(req)) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  try {
    const result = await sendDuePaymentReminders();
    return res.json({ message: 'Payment reminders processed.', ...result });
  } catch (error) {
    console.error('Failed to send payment reminders:', error);
    return res.status(500).json({ message: 'Payment reminders could not be processed.' });
  }
}

export const sendPaymentReviewReminders = sendPaymentReminders;

export async function sendDailyPaymentReminders(req, res) {
  if (!process.env.CRON_SECRET) return res.status(503).json({ message: 'Payment reminder scheduler is not configured.' });
  if (!isAuthorizedCronRequest(req)) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    const result = await checkPendingDailyPayments();
    await deliverOutbox(100);
    return res.json(result);
  } catch { return res.status(500).json({ message: 'Daily payment reminders could not be processed.' }); }
}
