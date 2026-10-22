import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Select } from './ui';
import { lifecycleRequest } from '../services/api';
import { useAdminPermissions } from '../hooks/useAdminPermissions';

export function LifecycleReports() {
  const { t } = useTranslation('common'); const { can } = useAdminPermissions();
  const [type, setType] = useState('cancellations'); const [format, setFormat] = useState('csv'); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const download = async () => {
    setBusy(true); setError('');
    try {
      const params = new URLSearchParams({ from, to }); const { rows } = await lifecycleRequest(`/admin/reports/${type}?${params}`);
      const cell = (value: any) => { let text = String(value ?? ''); if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; };
      const columns = Object.keys(rows[0] || { id: '', reason: '', createdAt: '' });
      const content = format === 'json' ? JSON.stringify(rows, null, 2) : [columns.map(cell).join(','), ...rows.map((row: any) => columns.map((key) => cell(row[key])).join(','))].join('\r\n');
      const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${type}.${format}`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return <section className="rounded-2xl border bg-white p-6 space-y-4"><h2 className="font-semibold text-xl">{t('financialReports.title')}</h2><div className="flex gap-4 flex-wrap"><Select label={t('reports.type')} value={type} onChange={(e) => setType(e.target.value)}><option value="cancellations">{t('lifecycle.history')}</option>{can('finance.transactions.view') && <option value="financial-history">{t('financialReports.financialHistory')}</option>}</Select><Input type="date" label={t('reports.from')} value={from} onChange={(e) => setFrom(e.target.value)} /><Input type="date" label={t('reports.to')} value={to} onChange={(e) => setTo(e.target.value)} /><Select label={t('reports.format')} value={format} onChange={(e) => setFormat(e.target.value)}><option value="csv">CSV</option><option value="json">JSON</option></Select></div>{error && <p role="alert">{error}</p>}<Button disabled={busy} onClick={() => void download()}>{t('reports.download')}</Button></section>;
}
