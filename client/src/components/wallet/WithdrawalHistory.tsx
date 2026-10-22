import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ConfirmDialog } from '../ui';
import { cancelPayoutRequest, getPayoutRequests, type PayoutRequest } from '../../services/api';
import { formatCurrency } from '../../lib/formatters';

const PAGE_SIZE = 10;

export function WithdrawalHistory({ sourceWallet, onChanged }: { sourceWallet: 'EMPLOYER' | 'WORKER'; onChanged: () => void }) {
  const { t } = useTranslation('common');
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [page, setPage] = useState(1);
  const [cancel, setCancel] = useState<PayoutRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const pageCount = Math.max(1, Math.ceil(requests.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRequests = requests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const load = useCallback(async () => {
    const data = await getPayoutRequests(sourceWallet);
    const nextRequests = data.payoutRequests.filter((item) => (item.sourceWallet || 'WORKER') === sourceWallet);
    setRequests(nextRequests);
    setPage((current) => Math.min(current, Math.max(1, Math.ceil(nextRequests.length / PAGE_SIZE))));
  }, [sourceWallet]);

  useEffect(() => {
    let active = true;
    setRequests([]); setPage(1); setError('');
    void load().catch((e) => active && setError(e.message));
    const timer = window.setInterval(() => { void load().catch(() => {}); }, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [load]);

  const cancelWithdrawal = async () => {
    if (!cancel || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      await cancelPayoutRequest(cancel._id);
      setCancel(null); await load(); onChanged();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); submitting.current = false; }
  };

  return <section id="withdrawal-history" className="rounded-2xl border bg-white p-6 space-y-4">
    <h2 className="text-xl font-semibold">{t('wallet.history')}</h2>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {pageRequests.map((item) => <article key={item._id} className="rounded-xl border p-3 space-y-2"><p>{formatCurrency(item.amount)} · {t(`wallet.status.${item.status}`)}</p><p>{item.destinationSnapshot.institutionName} · {item.destinationSnapshot.accountNumberMasked}</p><p className="text-xs">{item.providerTransferId || item._id}</p>{item.reviewNotes && <p>{item.reviewNotes}</p>}{item.failureReason && <p>{item.failureReason}</p>}{item.status === 'requested' && item.processingMode !== 'automatic' && <Button onClick={() => setCancel(item)}>{t('wallet.cancelWithdrawal')}</Button>}</article>)}
    {requests.length > PAGE_SIZE && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
      <p role="status" className="text-sm text-slate-500">{t('wallet.pagination.showing', { from: (currentPage - 1) * PAGE_SIZE + 1, to: Math.min(currentPage * PAGE_SIZE, requests.length), total: requests.length })}</p>
      <nav aria-label={t('wallet.pagination.label')} className="flex max-w-full flex-wrap items-center gap-3">
        <Button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>{t('wallet.pagination.previous')}</Button>
        <span className="text-sm text-slate-600">{t('wallet.pagination.page', { page: currentPage, total: pageCount })}</span>
        <Button disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>{t('wallet.pagination.next')}</Button>
      </nav>
    </div>}
    <ConfirmDialog open={Boolean(cancel)} title={t('wallet.cancelWithdrawal')} description={t('wallet.cancelDescription', { amount: formatCurrency(cancel?.amount || 0) })} pending={busy} error={error} onClose={() => setCancel(null)} onConfirm={() => void cancelWithdrawal()} />
  </section>;
}
