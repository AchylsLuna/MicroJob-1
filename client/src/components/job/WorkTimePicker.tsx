import { useTranslation } from 'react-i18next';
import { WorkTimeSummary } from '../WorkTimeSummary';

export function WorkTimePicker({ start, end, rate, disabled, onChange }: { start: string; end: string; rate?: unknown; disabled?: boolean; onChange: (field: 'workStartTime' | 'workEndTime', value: string) => void }) {
  const { t } = useTranslation('common');
  return <fieldset className="space-y-3" data-field="workTime">
    <legend className="text-sm font-semibold text-slate-700">{t('workTime.title')}</legend>
    <div className="grid grid-cols-2 gap-3">
      {([['workStartTime', start, 'start'], ['workEndTime', end, 'end']] as const).map(([field, value, label]) => <label key={field} className="block text-sm text-slate-700">{t(`workTime.${label}`)}<input type="time" aria-label={t(`workTime.${label}`)} value={value} required step={60} disabled={disabled} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50" onChange={(event) => onChange(field, event.target.value)} /></label>)}
    </div>
    <p className="text-xs text-slate-600">{t('workTime.hint')}</p>
    <WorkTimeSummary start={start} end={end} rate={rate} />
  </fieldset>;
}
