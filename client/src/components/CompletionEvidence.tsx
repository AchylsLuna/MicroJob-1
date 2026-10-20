import { useTranslation } from 'react-i18next';
import { toAbsoluteAssetUrl } from '../lib/assetUrl';
import { EvidenceImage } from './messaging/CompletionMessageCard';

export function CompletionEvidence({ items }: { items?: any[] }) {
  const { t } = useTranslation('common');
  if (!items?.length) return null;
  return <div className="space-y-2"><h3 className="font-semibold">{t('lifecycle.completionEvidence')}</h3>{items.map((item, index) => <div className="rounded-xl border p-3" key={item._id || index}><p className="whitespace-pre-wrap">{item.statement}</p>{item.fileUrl && (item.contentType?.startsWith('image/') ? <EvidenceImage fileUrl={item.fileUrl} fileName={item.fileName || t('lifecycle.completionEvidence')} /> : <a className="underline" href={toAbsoluteAssetUrl(item.fileUrl) || '#'} target="_blank" rel="noreferrer">{item.fileName || t('lifecycle.completionEvidence')}</a>)}<p className="text-sm">{new Date(item.submittedAt).toLocaleString()}</p></div>)}</div>;
}
