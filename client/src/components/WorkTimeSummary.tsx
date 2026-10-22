import { useTranslation } from 'react-i18next';
import { formatWorkTime, getHourlyPay, getWorkMinutes } from '../lib/workTime';
import { formatCurrency } from '../lib/formatters';

export function WorkTimeSummary({ start, end, rate }: { start?: string | null; end?: string | null; rate?: unknown }) {
  const { t } = useTranslation('common');
  const minutes = getWorkMinutes(start, end);
  if (!minutes || !start || !end) return null;
  const hourly = getHourlyPay(rate, minutes);
  return <div className="space-y-1 text-sm text-slate-700">
    <p>{formatWorkTime(start)}–{formatWorkTime(end)}{end < start ? ` ${t('workTime.nextDay')}` : ''} · {t('workTime.duration', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })}</p>
    {hourly !== null && <p className="font-semibold">{t('workTime.hourly', { amount: formatCurrency(hourly, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}</p>}
  </div>;
}
