import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog } from './ui';
import { getEmployerApplications, updateHireChecklistItem, type HireChecklistItem } from '../services/api';

export function HireChecklistDialog({ title, description, warning, onConfirm, onClose }: { title: string; description?: string; warning?: string; onConfirm: (checklist: string[]) => Promise<void>; onClose: () => void }) {
  const { t } = useTranslation('common');
  const [enabled, setEnabled] = useState(false);
  const [rows, setRows] = useState([{ id: 0, description: '' }]);
  const sequence = useRef(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  return <Dialog open title={title} onClose={() => { if (!busy) onClose(); }} closeDisabled={busy} size="lg">
    <div className="space-y-4">
      {description && <p>{description}</p>}
      <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 p-3 font-bold text-amber-900">{warning || t('hireChecklist.hireWarning')}</p>
      <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={enabled} disabled={busy} onChange={(event) => setEnabled(event.target.checked)} />{t('hireChecklist.include')}</label>
      {enabled && <div className="space-y-3">
        <p className="text-sm text-slate-500">{t('hireChecklist.hint')}</p>
        <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="w-16 p-3">{t('hireChecklist.done')}</th><th className="p-3">{t('hireChecklist.description')}</th><th className="w-12 p-3"><span className="sr-only">{t('hireChecklist.removeRow')}</span></th></tr></thead><tbody>
          {rows.map((row, index) => <tr key={row.id} className="border-t border-slate-200"><td className="p-3"><input type="checkbox" disabled checked={false} aria-label={t('hireChecklist.doneRow', { number: index + 1 })} /></td><td className="p-2"><textarea rows={2} maxLength={500} disabled={busy} aria-label={t('hireChecklist.descriptionRow', { number: index + 1 })} className="w-full min-w-0 rounded-lg border border-slate-300 p-2" value={row.description} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, description: event.target.value } : item))} /></td><td className="p-2"><button type="button" disabled={busy} aria-label={t('hireChecklist.removeRow')} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}><Trash2 className="h-4 w-4" /></button></td></tr>)}
        </tbody></table></div>
        <Button disabled={busy || rows.length >= 20} onClick={() => setRows((current) => [...current, { id: sequence.current++, description: '' }])}><Plus className="mr-2 h-4 w-4" />{t('hireChecklist.addRow')}</Button>
      </div>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button disabled={busy} onClick={onClose}>{t('lifecycle.cancelCompletion')}</Button><Button disabled={busy} onClick={async () => {
        if (lock.current) return;
        const checklist = enabled ? rows.map((row) => row.description.trim()).filter(Boolean) : [];
        if (enabled && !checklist.length) { setError(t('hireChecklist.empty')); return; }
        lock.current = true; setBusy(true); setError('');
        try { await onConfirm(checklist); onClose(); }
        catch (caught: any) { setError(caught.message); }
        finally { lock.current = false; setBusy(false); }
      }}>{t('hireChecklist.confirmHire')}</Button></div>
    </div>
  </Dialog>;
}

export function ChecklistTable({ items }: { items: string[] }) {
  const { t } = useTranslation('common');
  if (!items.length) return <p className="text-sm text-slate-500">{t('hireChecklist.none')}</p>;
  return <table className="w-full text-left text-sm"><caption className="sr-only">{t('hireChecklist.title')}</caption><thead><tr><th className="w-10 p-2">#</th><th className="p-2">{t('hireChecklist.description')}</th></tr></thead><tbody>{items.map((description, index) => <tr key={index} className="border-t border-slate-200"><td className="p-2 align-top">{index + 1}</td><td className="whitespace-pre-wrap break-words p-2">{description}</td></tr>)}</tbody></table>;
}

export function HiredWorkerChecklists({ jobId }: { jobId: string }) {
  const { t } = useTranslation('common');
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void getEmployerApplications({ jobId, includeHidden: 'true' }).then((items) => { if (active) setWorkers((Array.isArray(items) ? items : []).filter((item: any) => ['Hired', 'Accepted'].includes(item.status))); }).catch((caught: any) => { if (active) setError(caught.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [jobId]);
  return <section className="space-y-3"><h3 className="font-semibold text-slate-900">{t('hireChecklist.hiredWorkers')}</h3>
    {loading ? <p className="text-sm text-slate-500">{t('hireChecklist.loading')}</p> : workers.length === 0 ? <p className="text-sm text-slate-500">{t('hireChecklist.noWorkers')}</p> : workers.map((worker) => <div key={worker._id} className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
      <p className="mb-2 font-semibold text-slate-900">{`${worker.applicant?.firstName || ''} ${worker.applicant?.lastName || ''}`.trim() || t('hireChecklist.worker')}</p>
      {worker.hireChecklist?.length ? <table className="w-full text-left text-sm"><thead><tr><th className="w-16 p-2">{t('hireChecklist.done')}</th><th className="p-2">{t('hireChecklist.description')}</th></tr></thead><tbody>{worker.hireChecklist.map((item: HireChecklistItem, index: number) => <tr key={item._id} className="border-t border-slate-200"><td className="p-2 align-top"><input type="checkbox" checked={item.completed} disabled={Boolean(busy)} aria-label={t('hireChecklist.doneRow', { number: index + 1 })} onChange={async (event) => {
        if (lock.current) return;
        lock.current = true; setBusy(item._id); setError('');
        try { const result = await updateHireChecklistItem(worker._id, item._id, event.target.checked); setWorkers((current) => current.map((entry) => entry._id === worker._id ? { ...entry, hireChecklist: result.checklist } : entry)); }
        catch (caught: any) { setError(caught.message); }
        finally { lock.current = false; setBusy(null); }
      }} /></td><td className="whitespace-pre-wrap break-words p-2">{item.description}</td></tr>)}</tbody></table> : <p className="text-sm text-slate-500">{t('hireChecklist.none')}</p>}
    </div>)}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <p className="text-sm text-slate-500">{t('hireChecklist.trackingOnly')}</p>
  </section>;
}
