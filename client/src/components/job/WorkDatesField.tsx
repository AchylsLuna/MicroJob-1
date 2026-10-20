import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarPanel } from '../ui/CalendarPanel';
import { formatDateInputValue, parseDateInputValue } from './postJobForm';
import { getManilaDate } from '../../lib/jobCompensation';

export function WorkDatesField({ value, onChange, disabled = false }: { value: string[]; onChange: (dates: string[]) => void; disabled?: boolean }) {
  const { t } = useTranslation('employer');
  const [open, setOpen] = useState(false);
  return <fieldset className="space-y-2" data-field="workDates">
    <legend className="text-sm font-semibold text-slate-700">{t('postJob.daily.workDates')}</legend>
    <button type="button" disabled={disabled} className="min-h-11 rounded-xl border border-brand-200 bg-brand-50 px-4 text-sm font-semibold text-brand-700 disabled:opacity-50" onClick={() => setOpen(true)}>{t('postJob.daily.selectDates', { count: value.length })}</button>
    <p className="text-xs text-slate-600">{t('postJob.daily.scheduleHint')}</p>
    <CalendarPanel open={open} onClose={() => setOpen(false)} mode="multiple" dates={value.map((date) => parseDateInputValue(date)!)} minDate={parseDateInputValue(getManilaDate())!} title={t('postJob.daily.workDates')} onChange={(dates) => onChange(dates.map(formatDateInputValue).sort())} footer={{ primaryLabel: t('postJob.daily.useDates'), onPrimary: () => setOpen(false), primaryDisabled: value.length < 2 || value.length > 366 }} />
  </fieldset>;
}
