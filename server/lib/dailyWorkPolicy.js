import { httpError } from './lifecyclePolicy.js';

export const WORK_TIME_ZONE = 'Asia/Manila';
export const DAILY_REVIEW_INTERVAL_MS = 12 * 60 * 60 * 1000;

export const manilaDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: WORK_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now);

export function normalizeWorkDates(value, { today = manilaDate() } = {}) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 366) throw httpError(400, 'Select between 2 and 366 work dates for long-term work.');
  const dates = value.map((date) => {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))
      || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
      || date < today) throw httpError(400, 'Work dates must be valid calendar dates today or later in Asia/Manila.');
    return date;
  });
  if (new Set(dates).size !== dates.length) throw httpError(400, 'Work dates must be unique.');
  return dates.sort();
}

export const isDailyJob = (job) => job?.paymentMode === 'daily';
export const workdayCount = (job) => isDailyJob(job) ? job.workDates.length : 1;
export const baseWorkerPay = (job) => Number((Number(job.salary) * workdayCount(job)).toFixed(2));

export function requireDailySubmission(application, workDate, now = new Date()) {
  if (typeof workDate !== 'string' || workDate > manilaDate(now)) throw httpError(400, 'Choose a scheduled work date that is not in the future (Asia/Manila).');
  const day = application.dailyPayments.find((item) => item.workDate === workDate);
  if (!day) throw httpError(400, 'Choose one of your scheduled work dates.');
  if (day.paidAt) throw httpError(409, 'This work date has already been paid.');
  return day;
}
