import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog } from './ui';
import { lifecycleRequest } from '../services/api';

export function RecruitmentControls({ job, onChanged }: { job: any; onChanged: () => void }) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reopening = Boolean(job.closedManually);
  const canToggle = job.status === 'In Progress' && !job.cancellationPending && !job.archivedAt && Number(job.availablePositions) > 0 && new Date(job.deadline).getTime() > Date.now();
  const label = t(reopening ? 'lifecycle.reopenRecruitment' : 'lifecycle.closeRecruitment');
  return <div className="space-y-2">
    <p className="text-sm font-medium text-slate-700">{t(job.recruitmentOpen ? 'lifecycle.recruitmentOpen' : 'lifecycle.recruitmentClosed')} · {t('lifecycle.recruitmentSlots', { count: Number(job.availablePositions || 0) })}</p>
    {canToggle && <Button disabled={busy} onClick={() => { setError(''); setOpen(true); }}>{label}</Button>}
    <Dialog open={open} title={label} onClose={() => { if (!busy) setOpen(false); }} closeDisabled={busy}>
      <div className="space-y-4"><p>{t(reopening ? 'lifecycle.reopenRecruitmentNotice' : 'lifecycle.closeRecruitmentNotice')}</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2"><Button disabled={busy} onClick={() => setOpen(false)}>{t('lifecycle.cancelCompletion')}</Button><Button disabled={busy} onClick={async () => {
          if (busy) return;
          setBusy(true); setError('');
          try { await lifecycleRequest(`/jobs/${job._id}/${reopening ? 'reopen' : 'status'}`, reopening ? {} : { status: 'Closed' }, 'PATCH'); setOpen(false); onChanged(); }
          catch (caught: any) { setError(caught.message); }
          finally { setBusy(false); }
        }}>{t('lifecycle.confirm')}</Button></div>
      </div>
    </Dialog>
  </div>;
}
