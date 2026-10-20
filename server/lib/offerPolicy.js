import { HOUR, httpError } from './lifecyclePolicy.js';

export function offerDeadline(job, now = new Date()) {
  const setting = (name, fallback, allowZero = false) => {
    const value = process.env[name] === undefined || process.env[name] === '' ? fallback : Number(process.env[name]);
    if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0) || value > 8760) throw httpError(503, 'Offer response timing is incorrectly configured. Contact support.');
    return value;
  };
  const responseHours = setting('OFFER_RESPONSE_HOURS', 48);
  const reminderHours = setting('OFFER_REMINDER_BEFORE_HOURS', 24, true);
  const expiresAt = new Date(Math.min(now.getTime() + responseHours * HOUR, new Date(job.deadline).getTime()));
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) throw httpError(409, 'This posting has no remaining offer response window.');
  const lead = Math.min(reminderHours * HOUR, (expiresAt.getTime() - now.getTime()) / 2);
  return { expiresAt, responseReminderAt: reminderHours ? new Date(expiresAt.getTime() - lead) : null };
}

export const isOfferExpired = (offer, now = new Date()) => offer?.status === 'pending' && Boolean(offer.expiresAt) && new Date(offer.expiresAt).getTime() <= now.getTime();
