import { CompletionEvidence } from './CompletionEvidence';
import { DailyWorkSchedule } from './DailyWorkSchedule';
import { ChecklistTable } from './HireChecklist';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, Input, Select, Textarea } from './ui';
import { lifecycleRequest } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../lib/formatters';

export function AssignmentPanel({ applicationId, onChanged, defaultOpen = false, hideTrigger = false, onClose }: { applicationId: string; onChanged?: () => void; defaultOpen?: boolean; hideTrigger?: boolean; onClose?: () => void }) {
  const { t } = useTranslation('common'); const { user } = useAuth();
  const [open, setOpen] = useState(defaultOpen); const [data, setData] = useState<any>(null);
  const [paymentPreview, setPaymentPreview] = useState<any>(null);
  const [command, setCommand] = useState(''); const [reason, setReason] = useState(''); const [amount, setAmount] = useState('0'); const [kind, setKind] = useState('other');
  const [checked, setChecked] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  useEffect(() => {
    if (!defaultOpen) return;
    let active = true;
    setBusy(true);
    void lifecycleRequest(`/applications/${applicationId}/lifecycle`).then((value) => { if (active) setData(value); }).catch((caught) => { if (active) setError(caught.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [applicationId, defaultOpen]);
  const refresh = async () => setData(await lifecycleRequest(`/applications/${applicationId}/lifecycle`));
  const run = async (fn: () => Promise<any>, changed = true) => { if (lock.current) return false; lock.current = true; setBusy(true); setError(''); try { await fn(); if (changed) { await refresh(); setCommand(''); setReason(''); setChecked(false); onChanged?.(); } return true; } catch (e: any) { setError(e.message); return false; } finally { lock.current = false; setBusy(false); } };
  const app = data?.application; const employer = String(data?.job?.jobPoster) === String(user?.id);
  const pending = data?.cancellations?.find((item: any) => ['pending', 'staff_review'].includes(item.status));
  const dispute = data?.disputes?.find((item: any) => ['open', 'investigating'].includes(item.status));
  const act = async () => {
    if (command === 'start') return lifecycleRequest(`/applications/${applicationId}/work/start`, {});
    if (command === 'cancel') return lifecycleRequest(`/applications/${applicationId}/cancel`, { reason, workerPayment: Number(amount), policyAcknowledged: checked });
    if (command === 'dispute') return lifecycleRequest(`/applications/${applicationId}/disputes`, { reason, kind });
    if (command === 'evidence') return lifecycleRequest(`/financial-disputes/${dispute._id}/evidence`, { statement: reason, noEvidence: checked });
    if (command === 'accept' || command === 'reject') return lifecycleRequest(`/cancellations/${pending._id}/respond`, { action: command });
    if (command === 'pay') return lifecycleRequest(`/applications/${applicationId}/payment/settle`, { confirmed: checked });
  };
  return <>
    {!hideTrigger && <Button className="shrink-0 whitespace-nowrap border border-black !bg-white !text-black" onClick={() => { setOpen(true); setCommand(''); void run(refresh, false); }}>{t('lifecycle.details')}</Button>}
    <Dialog open={open} title={data?.job?.title || t('lifecycle.details')} onClose={() => { if (!busy) { setOpen(false); onClose?.(); } }} closeDisabled={busy}>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {app && <div className="space-y-4">
        <p>{app.status} · {t(`lifecycle.work.${app.workStatus}`, { defaultValue: app.workStatus })} · {app.cancellationPending || (dispute && Number(dispute.amount) > 0) ? t('lifecycle.held') : app.paymentStatus}</p>
        <p>{t('lifecycle.agreed')}: {formatCurrency(app.agreedAmount || data.job.salary)} · {t('lifecycle.paid')}: {formatCurrency(app.paidAmount || (app.paymentStatus === 'Paid' ? app.agreedAmount : 0))}</p>
        <section className="space-y-2">
          <h3 className="font-semibold">{t('lifecycle.jobDescription')}</h3>
          <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{data.job.description || t('lifecycle.descriptionUnavailable')}</p>
        </section>
        <section className="space-y-2">
          <h3 className="font-semibold">{t('hireChecklist.title')}</h3>
          <ChecklistTable items={(app.hireChecklist || []).map((item: { description: string }) => item.description)} />
        </section>
        <p>{(data.job.requirements || []).join(' · ')}</p>
        <CompletionEvidence items={app.completionEvidence} />
        {app.dailyPayments?.length > 0 && <DailyWorkSchedule dates={app.dailyPayments.map((day: any) => day.workDate)} rate={app.agreedDailyRate} payments={app.dailyPayments} start={data.job.workStartTime} end={data.job.workEndTime} />}
        <p className="text-sm text-slate-600">{t('lifecycle.terms')}</p>
        {command ? <div className="space-y-3 border-t pt-4">
          <h3 className="font-semibold">{t(`lifecycle.${command}`)}</h3>
          {['cancel', 'dispute', 'evidence'].includes(command) && <Textarea label={t('lifecycle.reason')} value={reason} maxLength={command === 'evidence' ? 4000 : 2000} onChange={(e) => setReason(e.target.value)} />}
          {command === 'cancel' && app.workStatus !== 'Not started' && <Input label={t('lifecycle.proposed')} type="number" min="0" max={app.agreedAmount || data.job.salary} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />}
          {command === 'dispute' && <Select label={t('lifecycle.disputeType')} value={kind} onChange={(e) => setKind(e.target.value)}><option value="other">{t('lifecycle.other')}</option><option value="nonpayment" disabled={!data.canFileNonpayment}>{t('lifecycle.nonpayment')}</option></Select>}
          {['cancel', 'evidence', 'pay'].includes(command) && <label className="flex items-center gap-3"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />{t(command === 'evidence' ? 'lifecycle.noEvidence' : command === 'pay' ? 'lifecycle.releaseNotice' : 'lifecycle.acknowledge')}</label>}
          {command === 'pay' && <><p>{t('lifecycle.recipient', { name: data.recipient?.name })}</p><p>{t('lifecycle.releaseAmount', { amount: formatCurrency(paymentPreview?.amount || 0) })}</p></>}
          {['accept', 'reject'].includes(command) && <p>{t('lifecycle.respondNotice', { amount: formatCurrency(pending?.workerPayment || 0) })}</p>}
          <Button disabled={busy || (['cancel', 'pay'].includes(command) && !checked)} onClick={() => void run(act)}>{t('lifecycle.confirm')}</Button><Button disabled={busy} onClick={() => setCommand('')}>{t('wallet.back')}</Button>
        </div> : <div className="flex gap-2 flex-wrap">
          {!employer && app.workStatus === 'Not started' && !pending && !dispute && <Button className="!bg-emerald-700 !text-white" disabled={busy} onClick={() => setCommand('start')}>{t('lifecycle.start')}</Button>}
          {app.status === 'Hired' && !['Paid', 'Processing'].includes(app.paymentStatus) && !pending && !dispute && <Button className="!bg-red-700 !text-white" onClick={() => { setCommand('cancel'); setChecked(false); }}>{t('lifecycle.cancel')}</Button>}
          {['Hired', 'Cancelled'].includes(app.status) && app.paymentStatus !== 'Processing' && !dispute && <Button onClick={() => { setKind('other'); setCommand('dispute'); }}>{t('lifecycle.dispute')}</Button>}
          {pending?.status === 'pending' && !dispute && String(pending.actor) !== String(user?.id) && <><Button onClick={() => setCommand('accept')}>{t('lifecycle.accept')}</Button><Button onClick={() => setCommand('reject')}>{t('lifecycle.reject')}</Button></>}
          {dispute && <Button onClick={() => { setCommand('evidence'); setChecked(false); }}>{t('lifecycle.evidence')}</Button>}
          {employer && app.workStatus === 'Submitted' && app.paymentStatus !== 'Paid' && !pending && !dispute && <Button disabled={busy} onClick={() => { void run(async () => { setPaymentPreview(await lifecycleRequest(`/applications/${applicationId}/payment/preview`, {})); }, false).then((success) => { if (success) { setCommand('pay'); setChecked(false); } }); }}>{t('lifecycle.pay')}</Button>}
        </div>}
        {pending && <p>{t('lifecycle.cancellation')}: {pending.reason} · {pending.status} · {formatCurrency(pending.workerPayment)}</p>}
        {dispute && <div><p>{t('lifecycle.evidenceDue')}: {dispute.evidenceDueAt ? new Date(dispute.evidenceDueAt).toLocaleString() : '—'}</p><p>{t('lifecycle.evidenceNotice')}</p>{dispute.evidence?.map((item: any, i: number) => <p key={i}>{item.statement || t('lifecycle.noEvidence')}</p>)}</div>}
        <h3 className="font-semibold">{t('lifecycle.history')}</h3>{data.cancellations?.map((item: any) => <p key={item._id}>{item.reason} · {item.status} · {formatCurrency(item.workerPayment)}</p>)}
      </div>}
    </Dialog>
  </>;
}
