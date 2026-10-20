import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, Input, Select, Textarea } from './ui';
import { submitWork, lifecycleRequest } from '../services/api';
import { getManilaDate } from '../lib/jobCompensation';

export function WorkSubmission({ applicationId, onChanged }: { applicationId: string; onChanged: () => void }) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [daily, setDaily] = useState(false);
  const [dates, setDates] = useState<string[]>([]);
  const [workDate, setWorkDate] = useState('');
  const lock = useRef(false);
  return <>
    <Button className="shrink-0 whitespace-nowrap !bg-emerald-700 !text-white" disabled={busy} onClick={async () => {
      setError(''); setBusy(true); setReady(false);
      try {
        const data = await lifecycleRequest(`/applications/${applicationId}/lifecycle`);
        const days = data.application.dailyPayments || [];
        const available = days.filter((day: any) => !day.paidAt && day.workDate <= getManilaDate()).map((day: any) => day.workDate);
        setReady(true); setDaily(data.job.paymentMode === 'daily'); setDates(available); setWorkDate(available.includes(getManilaDate()) ? getManilaDate() : available[0] || ''); setOpen(true);
      } catch (caught: any) { setError(caught.message); setOpen(true); }
      finally { setBusy(false); }
    }}>{t('lifecycle.submitWork')}</Button>
    <Dialog open={open} title={t('lifecycle.submitWork')} onClose={() => { if (!busy) setOpen(false); }} closeDisabled={busy}>
      <div className="space-y-4">
        {daily && <><Select label={t('lifecycle.selectWorkDate')} value={workDate} onChange={(event) => setWorkDate(event.target.value)} disabled={busy}><option value="">{t('lifecycle.selectWorkDate')}</option>{dates.map((date) => <option key={date} value={date}>{date}</option>)}</Select><p className="text-sm text-slate-600">{t(dates.length ? 'lifecycle.dailyProofHint' : 'lifecycle.noWorkDates')}</p></>}
        <Textarea label={t('lifecycle.completionStatement')} value={statement} maxLength={4000} onChange={(event) => setStatement(event.target.value)} />
        <Input label={t('lifecycle.completionImages')} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple required disabled={busy} onChange={(event) => { setFiles(Array.from(event.target.files || [])); setError(''); }} />
        <p className="text-sm text-slate-500">{t('lifecycle.completionImagesHint')}</p>
        {files.length > 0 && <ul className="space-y-1 text-sm text-slate-700">{files.map((file, index) => <li className="break-words" key={`${file.name}-${index}`}>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</li>)}</ul>}
        {error && <p role="alert">{error}</p>}
        <Button className="!bg-emerald-700 !text-white" disabled={busy || !ready || !files.length || (daily && !workDate)} onClick={async () => {
          if (lock.current) return;
          lock.current = true; setBusy(true); setError('');
          try {
            if (!files.length || files.length > 10 || files.some((file) => !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type))) throw new Error(t('lifecycle.completionImagesHint'));
            if (files.some((file) => file.size > 5 * 1024 * 1024)) throw new Error(t('lifecycle.evidenceTooLarge'));
            await submitWork(applicationId, { statement: statement.trim(), files, ...(daily ? { workDate } : {}) });
            setOpen(false); setStatement(''); setFiles([]); onChanged();
          } catch (caught: any) { setError(caught.message); }
          finally { lock.current = false; setBusy(false); }
        }}>{t('lifecycle.submitWork')}</Button>
      </div>
    </Dialog>
  </>;
}
