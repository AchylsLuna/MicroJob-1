import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ConfirmDialog, Dialog, Input, Select } from '../ui';
import { confirmWithdrawal, getPayoutRequests, getWithdrawalInstitutions, previewWithdrawal, type PayoutRequest, type WithdrawalPreview } from '../../services/api';
import { formatCurrency } from '../../lib/formatters';

export function WithdrawalPanel({ sourceWallet, balance, onChanged }: { sourceWallet: 'EMPLOYER' | 'WORKER'; balance: number; onChanged: () => void }) {
  const { t } = useTranslation('common');
  const [form, setForm] = useState({ amount: '', institutionName: '', accountName: '', accountNumber: '', bic: '' });
  const [institutions, setInstitutions] = useState<Array<{ bic: string; name: string }>>([]);
  const [preview, setPreview] = useState<WithdrawalPreview | null>(null);
  const [step, setStep] = useState<'confirm' | 'verify' | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PayoutRequest | null>(null);
  const [providerReady, setProviderReady] = useState(sourceWallet === 'WORKER');
  const load = useCallback(async () => {
    const data = await getPayoutRequests(); const next = data.payoutRequests.filter((item) => (item.sourceWallet || 'WORKER') === sourceWallet); setResult((current) => current ? next.find((item) => item._id === current._id) || current : null);
  }, [sourceWallet]);
  useEffect(() => {
    let active = true;
    setPreview(null); setStep(null); setResult(null); setError('');
    void load().catch((e) => active && setError(e.message));
    if (sourceWallet === 'EMPLOYER') {
      setProviderReady(false);
      void getWithdrawalInstitutions().then((data) => { if (active) { setInstitutions(data.institutions); setProviderReady(true); } }).catch((e) => active && setError(e.message));
    } else setProviderReady(true);
    const timer = window.setInterval(() => { void load().catch(() => {}); }, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [sourceWallet, load]);
  const edit = (key: keyof typeof form, value: string) => { setForm((old) => ({ ...old, [key]: value })); setPreview(null); setStep(null); setChecked(false); };
  const review = async () => {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const next = await previewWithdrawal({ sourceWallet, amount: Number(form.amount), destinationSnapshot: { ...form, methodType: 'bank_transfer' } });
      setPreview(next); setChecked(false); setStep('confirm');
    } catch (e: any) { setError(e.message); }
    finally { submitting.current = false; setBusy(false); }
  };
  const submit = async () => {
    if (!preview || !checked || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const data = await confirmWithdrawal(preview.previewToken); setResult(data.payoutRequest); setStep(null); setPreview(null);
      setForm({ amount: '', institutionName: '', accountName: '', accountNumber: '', bic: '' }); await load(); onChanged();
    } catch (e: any) { setError(e.message); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <section id="withdrawal" className="rounded-2xl border bg-white p-6 space-y-4">
    <h2 className="text-xl font-semibold">{t('wallet.withdraw')}</h2>
    <p>{t('wallet.available', { amount: formatCurrency(balance) })} · {t(`wallet.${sourceWallet.toLowerCase()}`)}</p>
    {sourceWallet === 'EMPLOYER' && <p className="text-sm text-slate-600">{t('wallet.unused')}</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <Input label={t('wallet.amount')} type="number" min="1" max={balance} step="0.01" value={form.amount} onChange={(e) => edit('amount', e.target.value)} />
      {sourceWallet === 'EMPLOYER' ? <Select label={t('wallet.institution')} value={form.bic} onChange={(e) => { const item = institutions.find((row) => row.bic === e.target.value); setForm((old) => ({ ...old, bic: item?.bic || '', institutionName: item?.name || '' })); setPreview(null); setChecked(false); }}><option value="">{t('wallet.select')}</option>{institutions.map((item) => <option key={item.bic} value={item.bic}>{item.name}</option>)}</Select> : <Input label={t('wallet.institution')} value={form.institutionName} onChange={(e) => edit('institutionName', e.target.value)} />}
      <Input label={t('wallet.accountName')} value={form.accountName} onChange={(e) => edit('accountName', e.target.value)} />
      <Input label={t('wallet.accountNumber')} value={form.accountNumber} onChange={(e) => edit('accountNumber', e.target.value)} />
    </div>
    <Button onClick={() => void review()} disabled={busy || !providerReady}>{t('wallet.withdraw')}</Button>
    <ConfirmDialog open={step === 'confirm'} title={t('wallet.areYouSure')} description={t('wallet.confirmDescription', { amount: formatCurrency(preview?.amount || 0) })} cancelLabel={t('wallet.back')} confirmLabel={t('wallet.continue')} onClose={() => { setStep(null); setPreview(null); }} onConfirm={() => setStep('verify')} />
    <Dialog open={step === 'verify'} title={t('wallet.verify')} onClose={() => { if (!busy) { setStep(null); setPreview(null); } }} closeDisabled={busy}>
      {preview && <div className="space-y-4"><p>{t(`wallet.${sourceWallet.toLowerCase()}`)} · {formatCurrency(preview.amount)}</p><p>{preview.destination.institutionName} · {preview.destination.accountName} · {preview.destination.accountNumberMasked}</p><p>{t('wallet.fee')}: {formatCurrency(preview.fee)}</p><p>{t('wallet.remaining')}: {formatCurrency(preview.remainingBalance)}</p><p className="text-sm">{t('wallet.detailsNotice')}</p><label className="flex items-center gap-3"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} disabled={busy} />{t('wallet.correct')}</label>{error && <p role="alert" className="text-red-700">{error}</p>}<div className="flex gap-3"><Button onClick={() => { setStep('confirm'); setChecked(false); }} disabled={busy}>{t('wallet.back')}</Button><Button onClick={() => void submit()} disabled={!checked || busy} aria-busy={busy}>{busy ? t('wallet.processing') : t('wallet.confirm')}</Button></div></div>}
    </Dialog>
    {result && <p role="status">{t(`wallet.status.${result.status}`)} · {result.providerTransferId || result._id}</p>}
  </section>;
}
