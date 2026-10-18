import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, Input, Textarea } from './ui';
import { lifecycleRequest } from '../services/api';
import { formatCurrency } from '../lib/formatters';
import { RecruitmentControls } from './RecruitmentControls';

export function PostingActions({ job, onChanged }: { job: any; onChanged: () => void }) {
  const { t } = useTranslation('common'); const [action, setAction] = useState(''); const [reason, setReason] = useState(''); const [checked, setChecked] = useState(false); const [deadline, setDeadline] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const history = ['Completed', 'Cancelled', 'Closed'].includes(job.status);
  return <div className="my-3 space-y-2">
    <RecruitmentControls job={job} onChanged={onChanged} />
    <p className="text-sm">{t(`lifecycle.paymentStatus.${job.paymentSummary?.status || 'Funds secured'}`)} · {t('lifecycle.secured')}: {formatCurrency(job.paymentSummary?.secured || 0)} · {t('lifecycle.paid')}: {formatCurrency(job.paymentSummary?.paid || 0)} · {t('wallet.remaining')}: {formatCurrency(job.paymentSummary?.remaining || 0)}</p>
    {job.cancellationReason && <p className="text-sm">{t('lifecycle.cancellation')}: {job.cancellationReason}</p>}
    <Button disabled={job.cancellationPending} onClick={() => { setChecked(false); setError(''); setAction(history ? 'repost' : 'cancel'); }}>{t(history ? 'lifecycle.postAgain' : 'lifecycle.cancelPosting')}</Button>
    {job.status === 'Closed' && <Button disabled={job.cancellationPending} onClick={() => { setChecked(false); setAction('cancel'); }}>{t('lifecycle.cancelPosting')}</Button>}
    <Dialog open={Boolean(action)} title={t(action === 'repost' ? 'lifecycle.postAgain' : 'lifecycle.cancelPosting')} onClose={() => { if (!busy) setAction(''); }} closeDisabled={busy}>
      <div className="space-y-4"><p>{job.title}</p><p>{action === 'repost' ? formatCurrency(Number(job.salary) * Number(job.positionsNeeded || 1) + 20 + (job.highlighted ? 50 : 0)) : t('lifecycle.cancelPostingNotice')}</p>{action === 'repost' ? <Input label={t('reports.to')} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /> : <Textarea label={t('lifecycle.reason')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} />}<label className="flex gap-3"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />{t(action === 'repost' ? 'lifecycle.repostNotice' : 'lifecycle.acknowledge')}</label>{error && <p role="alert">{error}</p>}<Button disabled={busy || !checked || (action === 'repost' ? !deadline : !reason.trim())} onClick={async () => { if (busy) return; setBusy(true); setError(''); try { await lifecycleRequest(`/jobs/${job._id}/${action === 'repost' ? 'repost' : 'cancel'}`, action === 'repost' ? { deadline: new Date(`${deadline}T23:59:59+08:00`).toISOString() } : { reason, policyAcknowledged: true, workerPayment: 0 }); setAction(''); onChanged(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }}>{t('lifecycle.confirm')}</Button></div>
    </Dialog>
  </div>;
}
