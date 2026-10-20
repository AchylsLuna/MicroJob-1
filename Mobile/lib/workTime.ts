const timeMinutes = (value?: string | null): number | null => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
  ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : null;

export function getWorkMinutes(start?: string | null, end?: string | null): number | null {
  const from = timeMinutes(start); const to = timeMinutes(end);
  if (from === null || to === null || from === to) return null;
  return (to - from + 1440) % 1440;
}

export function getHourlyPay(dailyPay: unknown, minutes: number | null): number | null {
  const cents = Math.round(Number(dailyPay) * 100);
  if (!minutes || !Number.isSafeInteger(cents * 60) || cents <= 0) return null;
  return Math.floor(cents * 60 / minutes) / 100;
}

export function formatWorkTime(time: string): string {
  const minutes = timeMinutes(time);
  if (minutes === null) return '';
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}${minutes % 60 ? `:${String(minutes % 60).padStart(2, '0')}` : ''}${hour < 12 ? 'am' : 'pm'}`;
}
