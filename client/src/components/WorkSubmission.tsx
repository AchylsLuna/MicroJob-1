import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, Input, Textarea } from './ui';
import { submitWork } from '../services/api';

export function WorkSubmission({ applicationId, onChanged }: { applicationId: string; onChanged: () => void }) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  return <>
    <Button onClick={() => { setError(''); setOpen(true); }}>{t('lifecycle.submitWork')}</Button>
    <Dialog open={open} title={t('lifecycle.submitWork')} onClose={() => { if (!busy) setOpen(false); }} closeDisabled={busy}>
      <div className="space-y-4">
        <Textarea label={t('lifecycle.completionStatement')} value={statement} maxLength={4000} onChange={(event) => setStatement(event.target.value)} />
        <Input label={t('lifecycle.completionFile')} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        {error && <p role="alert">{error}</p>}
        <Button disabled={busy || (!statement.trim() && !file)} onClick={async () => {
          if (lock.current) return;
          lock.current = true; setBusy(true); setError('');
          try {
            if (file && file.size > 5 * 1024 * 1024) throw new Error(t('lifecycle.evidenceTooLarge'));
            await submitWork(applicationId, { statement: statement.trim(), file });
            setOpen(false); setStatement(''); setFile(null); onChanged();
          } catch (caught: any) { setError(caught.message); }
          finally { lock.current = false; setBusy(false); }
        }}>{t('lifecycle.confirm')}</Button>
      </div>
    </Dialog>
  </>;
}
