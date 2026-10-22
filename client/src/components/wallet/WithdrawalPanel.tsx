import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ConfirmDialog, Dialog, Input, Select } from '../ui';
import { confirmWithdrawal, getWithdrawalPolicy, getPayoutRequests, previewWithdrawal, type PayoutRequest, type WithdrawalPreview } from '../../services/api';
import { formatCurrency } from '../../lib/formatters';
import { formatWithdrawalAmount } from '../../lib/withdrawalAmount';
import { useAuth } from '../../contexts/AuthContext';

const institutions = ['BPI Online', 'UnionBank Online', 'BDO Online', 'Landbank Online', 'Metrobank Online', 'MariBank', 'GCash'];

export function WithdrawalPanel({ sourceWallet, balance, onChanged }: { sourceWallet: 'EMPLOYER' | 'WORKER'; balance: number; onChanged: () => void }) {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const accountName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  const accountNumber = user?.phoneNumber || '';
  const [form, setForm] = useState({ amount: '', institutionName: '', accountName: '', accountNumber: '', bic: '' });
  const [policy, setPolicy] = useState<{ minimum: number; maximum: number | null; reviewThreshold: number } | null>(null);
  const [preview, setPreview] = useState<WithdrawalPreview | null>(null);
  const [step, setStep] = useState<'confirm' | 'verify' | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PayoutRequest | null>(null);
  useEffect(() => {
    setForm((current) => ({ ...current, accountName, accountNumber }));
    setPreview(null); setStep(null); setChecked(false);
  }, [user?.id, accountName, accountNumber]);
  const load = useCallback(async () => {
    const data = await getPayoutRequests(); const next = data.payoutRequests.filter((item) => (item.sourceWallet || 'WORKER') === sourceWallet); setResult((current) => current ? next.find((item) => item._id === current._id) || current : null);
  }, [sourceWallet]);
  useEffect(() => {
    let active = true;
    setPreview(null); setStep(null); setResult(null); setError('');
    void getWithdrawalPolicy(sourceWallet).then((data) => active && setPolicy(data)).catch((e) => active && setError(e.message));
    void load().catch((e) => active && setError(e.message));
    const timer = window.setInterval(() => { void load().catch(() => {}); }, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [sourceWallet, load]);
  const edit = (key: keyof typeof form, value: string) => {
    const next = key === 'amount' ? formatWithdrawalAmount(value) : value;
    if (next === null) return;
    setForm((old) => ({ ...old, [key]: next })); setPreview(null); setStep(null); setChecked(false);
  };
  const review = async () => {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const next = await previewWithdrawal({ sourceWallet, amount: Number(form.amount.replace(/,/g, '')), destinationSnapshot: { ...form, methodType: form.institutionName === 'GCash' ? 'gcash' : 'bank_transfer' } });
      setPreview(next); setChecked(false); setStep('confirm');
    } catch (e: any) { setError(e.message); }
    finally { submitting.current = false; setBusy(false); }
  };
  const submit = async () => {
    if (!preview || !checked || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const data = await confirmWithdrawal(preview.previewToken); setResult(data.payoutRequest); setStep(null); setPreview(null);
      setForm({ amount: '', institutionName: '', accountName, accountNumber, bic: '' }); await load(); onChanged();
    } catch (e: any) { setError(e.message); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <section id="withdrawal" className="rounded-2xl border bg-white p-6 space-y-4">
    <h2 className="text-xl font-semibold">{t('wallet.withdraw')}</h2>
    <p>{t('wallet.available', { amount: formatCurrency(balance) })} · {t(`wallet.${sourceWallet.toLowerCase()}`)}</p>
    {sourceWallet === 'EMPLOYER' && <p className="text-sm text-slate-600">{t('wallet.unused')}</p>}
    {policy && <p className="text-sm">{t('wallet.limits', { minimum: formatCurrency(policy.minimum), maximum: policy.maximum === null ? t('wallet.noMaximum') : formatCurrency(policy.maximum) })}</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <Input label={t('wallet.amount')} type="text" inputMode="decimal" value={form.amount} onChange={(e) => {
        const input = e.currentTarget;
        const caret = input.selectionStart ?? input.value.length;
        const charactersBeforeCaret = input.value.slice(0, caret).replace(/,/g, '').length;
        const formatted = formatWithdrawalAmount(input.value);
        edit('amount', input.value);
        if (formatted !== null) {
          let position = 0; let characters = 0;
          while (position < formatted.length && characters < charactersBeforeCaret) {
            if (formatted[position] !== ',') characters += 1;
            position += 1;
          }
          queueMicrotask(() => input.setSelectionRange(position, position));
        }
      }} />
      <Select label={t('wallet.institution')} value={form.institutionName} disabled={busy} required onChange={(e) => edit('institutionName', e.target.value)}>
        <option value="" disabled>{t('wallet.chooseInstitution')}</option>
        {institutions.map((name) => <option key={name} value={name}>{name}</option>)}
      </Select>
      <Input label={t('wallet.accountName')} value={form.accountName} onChange={(e) => edit('accountName', e.target.value)} />
      <Input label={t('wallet.accountNumber')} value={form.accountNumber} onChange={(e) => edit('accountNumber', e.target.value)} />
    </div>
    <Button onClick={() => void review()} disabled={busy}>{t('wallet.withdraw')}</Button>
    <ConfirmDialog open={step === 'confirm'} title={t('wallet.areYouSure')} description={t('wallet.confirmDescription', { amount: formatCurrency(preview?.amount || 0) })} cancelLabel={t('wallet.back')} confirmLabel={t('wallet.continue')} onClose={() => { setStep(null); setPreview(null); }} onConfirm={() => setStep('verify')} />
    <Dialog open={step === 'verify'} title={t('wallet.verify')} onClose={() => { if (!busy) { setStep(null); setPreview(null); } }} closeDisabled={busy}>
      {preview && <div className="space-y-4"><p>{t(`wallet.${sourceWallet.toLowerCase()}`)} · {formatCurrency(preview.amount)}</p><p>{preview.destination.institutionName} · {preview.destination.accountName} · {preview.destination.accountNumberMasked}</p><p>{t('wallet.fee')}: {formatCurrency(preview.fee)}</p><p>{t('wallet.remaining')}: {formatCurrency(preview.remainingBalance)}</p><p className="text-sm">{t('wallet.detailsNotice')}</p>{preview.reviewReason && <p role="status">{preview.reviewReason}</p>}<label className="flex items-center gap-3"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} disabled={busy} />{t('wallet.correct')}</label>{error && <p role="alert" className="text-red-700">{error}</p>}<div className="flex gap-3"><Button onClick={() => { setStep('confirm'); setChecked(false); }} disabled={busy}>{t('wallet.back')}</Button><Button onClick={() => void submit()} disabled={!checked || busy} aria-busy={busy}>{busy ? t('wallet.processing') : t('wallet.confirm')}</Button></div></div>}
    </Dialog>
    {result && <p role="status">{t(`wallet.status.${result.status}`)} · {result.providerTransferId || result._id}</p>}
  </section>;
}
