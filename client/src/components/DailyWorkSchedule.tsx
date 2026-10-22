import { useTranslation } from 'react-i18next';
import { WorkTimeSummary } from './WorkTimeSummary';

export function DailyWorkSchedule({ dates, rate, payments, start, end }: { dates: string[]; rate: number; start?: string | null; end?: string | null; payments?: { workDate: string; paidAt?: string; submittedAt?: string }[] }) {
  const { t } = useTranslation('common');
  return <section className="space-y-2 rounded-xl border border-brand-200 bg-brand-50 p-4">
    <h3 className="font-semibold text-slate-900">{t('lifecycle.workSchedule')}</h3>
    <p className="text-sm text-slate-700">{t('lifecycle.dailyRate', { amount: rate })}</p>
    <WorkTimeSummary start={start} end={end} rate={rate} />
    <p className="text-xs text-slate-600">{t('lifecycle.dailyDates')}</p>
    <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">{dates.map((date) => {
      const day = payments?.find((item) => item.workDate === date);
      return <li key={date} className="flex flex-wrap justify-between gap-2 border-b border-brand-100 py-2"><span>{date}</span>{payments && <span>{t(day?.paidAt ? 'lifecycle.dailyPaid' : day?.submittedAt ? 'lifecycle.dailyAwaiting' : 'lifecycle.dailyScheduled')}</span>}</li>;
    })}</ul>
  </section>;
}
