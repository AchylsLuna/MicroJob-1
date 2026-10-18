import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog } from '../ui';
import type { ChatMessage } from '../../contexts/MessagingContext';
import { useAuth } from '../../contexts/AuthContext';
import { settlePayment } from '../../services/api';
import { toAbsoluteAssetUrl } from '../../lib/assetUrl';
import { getBearerAccessToken } from '../../utils/authTransport';

export function EvidenceImage({ fileUrl, fileName }: { fileUrl: string; fileName: string }) {
  const { t } = useTranslation('common');
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    if (!/^\/uploads\/[a-zA-Z0-9._-]+$/.test(fileUrl)) { setFailed(true); return; }
    const token = getBearerAccessToken();
    void fetch(toAbsoluteAssetUrl(fileUrl)!, { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.blob(); })
      .then((blob) => { if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [fileUrl]);
  if (failed) return <p role="alert" className="text-sm text-red-700">{t('lifecycle.downloadFailed')}</p>;
  return url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={fileName} className="max-h-64 w-full rounded-lg object-contain" loading="lazy" /></a> : <p className="text-sm text-slate-500">{t('lifecycle.loadingImages')}</p>;
}

export function CompletionMessageCard({ message }: { message: ChatMessage }) {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const attachment = message.attachment;
  const application = attachment?.application;
  const applicationId = typeof application === 'string' ? application : application?._id;
  const paid = completed || (typeof application === 'object' && application?.paymentStatus === 'Paid');
  const latest = typeof application === 'object' && application?.workStatus === 'Submitted' && application.workSubmittedAt === attachment?.submittedAt;
  const canComplete = user?.id === message.receiver._id && latest && !paid;
  return <div className="w-full max-w-sm space-y-3 rounded-card border border-emerald-200 bg-white p-4 text-slate-900">
    <p className="font-semibold">{attachment?.jobTitle}</p>
    <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
    <div className="grid gap-2">{attachment?.images?.map((image) => <EvidenceImage key={image.fileUrl} {...image} />)}</div>
    {paid ? <p className="text-sm font-semibold text-emerald-700">{t('lifecycle.jobCompleted')}</p> : canComplete ? <Button className="!bg-emerald-700 !text-white hover:!bg-emerald-800" onClick={() => { setError(''); setOpen(true); }}>{t('lifecycle.markJobDone')}</Button> : <p className="text-sm text-slate-500">{t('lifecycle.evidenceSent')}</p>}
    <Dialog open={open} title={t('lifecycle.markJobDone')} onClose={() => { if (!busy) setOpen(false); }} closeDisabled={busy}>
      <div className="space-y-4">
        <p>{t('lifecycle.completeJobConfirmation')}</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button disabled={busy} onClick={() => setOpen(false)}>{t('lifecycle.cancelCompletion')}</Button>
          <Button disabled={busy || !applicationId} className="!bg-emerald-700 !text-white hover:!bg-emerald-800" onClick={async () => {
            if (lock.current || !applicationId) return;
            lock.current = true; setBusy(true); setError('');
            try { await settlePayment(applicationId, attachment?.submittedAt); setCompleted(true); setOpen(false); }
            catch (caught: any) { setError(caught.message); }
            finally { lock.current = false; setBusy(false); }
          }}>{t('lifecycle.confirm')}</Button>
        </div>
      </div>
    </Dialog>
  </div>;
}
