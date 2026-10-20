import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toAbsoluteAssetUrl } from '../lib/assetUrl';
import { getBearerAccessToken } from '../utils/authTransport';
import { EvidenceImage } from './messaging/CompletionMessageCard';

export function EvidenceDownload({ fileUrl, fileName }: { fileUrl: string; fileName?: string }) {
  const { t } = useTranslation('common');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const download = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (!/^\/uploads\/[a-zA-Z0-9._-]+$/.test(fileUrl)) throw new Error();
      const token = getBearerAccessToken();
      const response = await fetch(toAbsoluteAssetUrl(fileUrl)!, { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = fileName || 'evidence'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError(t('lifecycle.downloadFailed')); }
    finally { setBusy(false); }
  };
  return <><button type="button" className="underline" disabled={busy} onClick={() => void download()}>{fileName || t('lifecycle.saveEvidence')}</button>{error && <p role="alert">{error}</p>}</>;
}

export function CompletionEvidence({ items }: { items?: any[] }) {
  const { t } = useTranslation('common');
  if (!items?.length) return null;
  return <div className="space-y-2"><h3 className="font-semibold">{t('lifecycle.completionEvidence')}</h3>{items.map((item, index) => {
    const at = item.submittedAt || item.uploadedAt || item.at;
    return <div className="rounded-xl border p-3" key={item._id || index}>
      <p className="whitespace-pre-wrap">{item.statement || item.description || (item.noEvidence ? t('financialWorkflow.noEvidence') : '')}</p>
      {item.fileUrl && (item.contentType?.startsWith('image/') ? <EvidenceImage fileUrl={item.fileUrl} fileName={item.fileName || t('lifecycle.completionEvidence')} /> : <EvidenceDownload fileUrl={item.fileUrl} fileName={item.fileName} />)}
      {at && <p className="text-sm">{new Date(at).toLocaleString()}</p>}
      {item.feedback?.reason && <p className="whitespace-pre-wrap">{t('financialWorkflow.feedback', { reason: item.feedback.reason })} · {new Date(item.feedback.at).toLocaleString()}</p>}
    </div>;
  })}</div>;
}
