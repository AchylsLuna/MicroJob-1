import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, Input, Textarea } from './ui';
import { submitWork } from '../services/api';

export function WorkSubmission({ applicationId, onChanged }: { applicationId: string; onChanged: () => void }) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  return <>
    <Button className="shrink-0 whitespace-nowrap !bg-emerald-700 !text-white" onClick={() => { setError(''); setOpen(true); }}>{t('lifecycle.submitWork')}</Button>
    <Dialog open={open} title={t('lifecycle.submitWork')} onClose={() => { if (!busy) setOpen(false); }} closeDisabled={busy}>
      <div className="space-y-4">
        <Textarea label={t('lifecycle.completionStatement')} value={statement} maxLength={4000} onChange={(event) => setStatement(event.target.value)} />
        <Input label={t('lifecycle.completionImages')} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple required disabled={busy} onChange={(event) => { setFiles(Array.from(event.target.files || [])); setError(''); }} />
        <p className="text-sm text-slate-500">{t('lifecycle.completionImagesHint')}</p>
        {files.length > 0 && <ul className="space-y-1 text-sm text-slate-700">{files.map((file, index) => <li className="break-words" key={`${file.name}-${index}`}>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</li>)}</ul>}
        {error && <p role="alert">{error}</p>}
        <Button className="!bg-emerald-700 !text-white" disabled={busy || !files.length} onClick={async () => {
          if (lock.current) return;
          lock.current = true; setBusy(true); setError('');
          try {
            if (!files.length || files.length > 10 || files.some((file) => !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type))) throw new Error(t('lifecycle.completionImagesHint'));
            if (files.some((file) => file.size > 5 * 1024 * 1024)) throw new Error(t('lifecycle.evidenceTooLarge'));
            await submitWork(applicationId, { statement: statement.trim(), files });
            setOpen(false); setStatement(''); setFiles([]); onChanged();
          } catch (caught: any) { setError(caught.message); }
          finally { lock.current = false; setBusy(false); }
        }}>{t('lifecycle.submitWork')}</Button>
      </div>
    </Dialog>
  </>;
}
