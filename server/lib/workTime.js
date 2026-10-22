const timeMinutes = (value) => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
  ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : null;

export function getWorkMinutes(start, end) {
  const from = timeMinutes(start); const to = timeMinutes(end);
  if (from === null || to === null || from === to) return null;
  return (to - from + 1440) % 1440;
}

export function getHourlyPay(dailyPay, minutes) {
  const cents = Math.round(Number(dailyPay) * 100);
  if (!minutes || !Number.isSafeInteger(cents * 60) || cents <= 0) return null;
  // Integer cents avoid rounding up a fractional hourly cent.
  return Math.floor(cents * 60 / minutes) / 100;
}

export function normalizeWorkTimes(start, end) {
  if (!getWorkMinutes(start, end)) throw Object.assign(new Error('Choose different valid start and end work times (HH:mm).'), { status: 400 });
  return { workStartTime: start, workEndTime: end };
}

export function workTimeSummary(job) {
  if (job.paymentMode !== 'daily') return {};
  const workMinutes = getWorkMinutes(job.workStartTime, job.workEndTime);
  return workMinutes ? { workMinutes, workHours: workMinutes / 60, hourlyPay: getHourlyPay(job.salary, workMinutes) } : {};
}
