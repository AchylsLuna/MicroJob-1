import { Link } from 'react-router-dom';
import { getTransactionDescription } from '../../lib/transactionDescription';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { PaymentTransaction } from '../../services/api';
import { formatCurrency } from '../../lib/formatters';
import { getWalletTransactionStatus } from '../../lib/transactionStatus';
import { formatDate, getTransactionDirection, getTransactionStatusClasses, linkedEntityLabel, toAmount, txLabel, txTypeLabel } from './walletFormat';

type Props = {
  transactions: PaymentTransaction[];
  ownerId: string;
  loading: boolean;
  title: string;
  t: TFunction;
  jobHref: (jobId: string) => string;
};

export function WalletTransactions({ transactions, ownerId, loading, title, t, jobHref }: Props) {
  const { t: common } = useTranslation('common');
  const rows = transactions.slice(0, 20);
  const statusBadge = (tx: PaymentTransaction) => {
    const status = getWalletTransactionStatus(tx);
    return <span className={`inline-flex max-w-full rounded-lg px-2.5 py-1.5 text-xs font-medium leading-snug ${getTransactionStatusClasses(status)}`}>
      {common(`wallet.transactionStatus.${status}`)}
    </span>;
  };
  const amount = (tx: PaymentTransaction) => {
    const direction = getTransactionDirection(tx, ownerId);
    return <div className="tabular-nums">
      <p className={`whitespace-nowrap font-semibold ${direction === 'credit' ? 'text-green-700' : direction === 'debit' ? 'text-red-700' : 'text-slate-700'}`}>
        {direction === 'credit' ? '+' : direction === 'debit' ? '−' : ''}{formatCurrency(toAmount(tx.amount))}
      </p>
      {toAmount(tx.meta?.processingFee) > 0 && <p className="mt-1 text-xs font-normal text-slate-500">{common('wallet.transactionFee', { amount: formatCurrency(toAmount(tx.meta?.processingFee)) })}</p>}
    </div>;
  };
  const details = (tx: PaymentTransaction) => {
    const { jobTitle, jobId } = getTransactionDescription(tx);
    return <div className="min-w-0 space-y-1.5">
    <p className="break-words font-semibold leading-snug text-slate-900">{txLabel(t, tx)}{jobTitle && <> — {jobId ? <Link className="text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" to={jobHref(jobId)}>{jobTitle}</Link> : jobTitle}</>}</p>
    <p className="break-words text-xs leading-relaxed text-slate-500">{txTypeLabel(t, tx.type)} · {linkedEntityLabel(t, tx.relatedEntityType || tx.balanceTarget)}</p>
    {(tx.reference || tx.providerReference) && <details className="text-xs text-slate-500">
      <summary className="w-fit cursor-pointer rounded py-1 font-medium text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">{t('eWallet.transactions.columns.reference')}</summary>
      <div className="mt-1 space-y-1 break-all rounded-lg bg-slate-50 p-2 font-mono leading-relaxed">
        {tx.reference && <p>{tx.reference}</p>}
        {tx.providerReference && <p>{tx.providerReference}</p>}
      </div>
    </details>}
  </div>;
  };

  return <section className="ui-card min-w-0 overflow-hidden" aria-label={title} aria-busy={loading}>
    <div className="border-b border-slate-100 px-4 py-5 sm:px-6">
      <h3 className="text-section font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-caption leading-relaxed text-slate-500">{t('eWallet.transactions.helper')}</p>
    </div>
    {loading || rows.length === 0 ? <p role="status" className="px-4 py-10 text-center text-body-sm text-slate-500 sm:px-6">
      {t(loading ? 'eWallet.transactions.loading' : 'eWallet.transactions.empty')}
    </p> : <>
      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((tx) => <li key={tx._id} className="space-y-3 p-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">{details(tx)}</div>
            <div className="shrink-0 text-right text-sm">{amount(tx)}</div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {statusBadge(tx)}
            <span className="text-xs text-slate-500">{formatDate(tx.createdAt)}</span>
          </div>
        </li>)}
      </ul>
      <div className="hidden md:block">
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">{title}</caption>
          <colgroup><col className="w-[38%]" /><col className="w-[23%]" /><col className="w-[21%]" /><col className="w-[18%]" /></colgroup>
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
            <tr>
              <th scope="col" className="px-6 py-3 font-medium">{t('eWallet.transactions.columns.label')}</th>
              <th scope="col" className="px-3 py-3 font-medium">{t('eWallet.transactions.columns.status')}</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">{t('eWallet.transactions.columns.amount')}</th>
              <th scope="col" className="px-6 py-3 font-medium">{t('eWallet.transactions.columns.date')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((tx) => <tr key={tx._id} className="align-top hover:bg-slate-50/60">
              <td className="px-6 py-4">{details(tx)}</td>
              <td className="px-3 py-4">{statusBadge(tx)}</td>
              <td className="px-3 py-4 text-right">{amount(tx)}</td>
              <td className="px-6 py-4 text-xs leading-relaxed text-slate-500">{formatDate(tx.createdAt)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </>}
  </section>;
}
