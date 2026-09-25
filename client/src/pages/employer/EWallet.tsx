import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Landmark, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "../../lib/toast";
import { formatCurrency, formatDateTime } from "../../lib/formatters";
import { safeExternalUrl } from "../../utils/safeExternalUrl";
import {
  cancelPayoutRequest,
  createPayoutRequest,
  createTopUpSession,
  getPaymentTransactions,
  getPayoutRequests,
  getProfile,
  type PaymentTransaction,
  type PayoutRequest,
} from "../../services/api";

const amountOf = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const statusClass = (status: PayoutRequest["status"]) => ({
  requested: "bg-[#1C4D8D]/10 text-[#1C4D8D]",
  approved: "bg-[#FEF3C7] text-[#B45309]",
  paid: "bg-[#DCFCE7] text-[#15803D]",
  rejected: "bg-[#FEE2E2] text-[#B91C1C]",
  cancelled: "bg-[#F3F4F6] text-[#6B7280]",
}[status]);

export function EmployerEWallet() {
  const { t } = useTranslation("employer");
  const payoutRef = useRef<HTMLDivElement | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [employerBalance, setEmployerBalance] = useState(0);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [submittingTopUp, setSubmittingTopUp] = useState(false);
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [form, setForm] = useState({ amount: "", methodType: "bank_transfer", institutionName: "", accountName: "", accountNumber: "" });

  const loadWallet = useCallback(async () => {
    try {
      const [profileResponse, transactionResponse, payoutResponse] = await Promise.all([
        getProfile(),
        getPaymentTransactions(),
        getPayoutRequests("EMPLOYER"),
      ]);
      const profile = (profileResponse as any)?.profile ?? profileResponse;
      setEmployerBalance(amountOf((profile as any)?.employerBalance));
      setTransactions((transactionResponse.transactions || []).filter((transaction) => transaction.balanceTarget === "EMPLOYER" || transaction.balanceTarget === "ESCROW"));
      setPayouts(payoutResponse.payoutRequests || []);
    } catch (error: any) {
      toast.error(error?.message || t("eWallet.toast.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void loadWallet(); }, [loadWallet]);

  const pendingTotal = useMemo(() => payouts
    .filter((payout) => payout.status === "requested" || payout.status === "approved")
    .reduce((total, payout) => total + amountOf(payout.amount), 0), [payouts]);

  const submitTopUp = async () => {
    const amount = amountOf(topUpAmount);
    if (amount <= 0) return toast.error(t("eWallet.toast.invalidTopUp"));
    setSubmittingTopUp(true);
    try {
      const response = await createTopUpSession({ amount, target: "EMPLOYER" });
      const checkoutUrl = safeExternalUrl(response?.checkoutUrl, { purpose: "payment" });
      if (!checkoutUrl) throw new Error(t("eWallet.toast.topUpFailed"));
      if (response?.checkoutId) sessionStorage.setItem("topup_checkout_id", response.checkoutId);
      window.location.assign(checkoutUrl);
    } catch (error: any) {
      toast.error(error?.message || t("eWallet.toast.topUpFailed"));
      setSubmittingTopUp(false);
    }
  };

  const submitPayout = async () => {
    const amount = amountOf(form.amount);
    if (amount <= 0) return toast.error(t("eWallet.toast.invalidWithdrawal"));
    if (amount > employerBalance) return toast.error(t("eWallet.toast.exceedsBalance"));
    if (!form.institutionName.trim() || !form.accountName.trim() || !form.accountNumber.trim()) return toast.error(t("eWallet.toast.destinationRequired"));
    setSubmittingPayout(true);
    try {
      idempotencyKeyRef.current ||= globalThis.crypto?.randomUUID?.() || `employer-payout-${Date.now()}`;
      await createPayoutRequest({
        amount,
        balanceTarget: "EMPLOYER",
        idempotencyKey: idempotencyKeyRef.current,
        destinationSnapshot: { ...form, institutionName: form.institutionName.trim(), accountName: form.accountName.trim(), accountNumber: form.accountNumber.trim() },
      });
      idempotencyKeyRef.current = null;
      setForm({ amount: "", methodType: "bank_transfer", institutionName: "", accountName: "", accountNumber: "" });
      toast.success(t("eWallet.toast.withdrawalSubmitted"));
      await loadWallet();
    } catch (error: any) {
      toast.error(error?.message || t("eWallet.toast.withdrawalFailed"));
    } finally {
      setSubmittingPayout(false);
    }
  };

  const cancelPayout = async (payoutId: string) => {
    setCancellingId(payoutId);
    try {
      await cancelPayoutRequest(payoutId);
      toast.success(t("eWallet.toast.withdrawalCancelled"));
      await loadWallet();
    } catch (error: any) {
      toast.error(error?.message || t("eWallet.toast.withdrawalCancelFailed"));
    } finally {
      setCancellingId(null);
    }
  };

  return <div className="max-w-[1341px] mx-auto space-y-6">
    <section className="rounded-[20px] bg-[#1C4D8D] p-8 text-white shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-sm text-white/80">{t("eWallet.balanceLabel")}</p>
          <h1 className="mt-2 text-4xl font-bold">{loading ? "—" : formatCurrency(employerBalance)}</h1>
          <p className="mt-3 max-w-2xl text-sm text-white/80">{t("eWallet.description")}</p>
        </div>
        <Wallet className="h-10 w-10 text-white/85" />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => setTopUpOpen(true)} className="rounded-xl bg-white px-5 py-3 font-semibold text-[#1C4D8D]">{t("eWallet.topUp")}</button>
        <button type="button" onClick={() => payoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="rounded-xl bg-white/20 px-5 py-3 font-semibold text-white">{t("eWallet.withdraw")}</button>
      </div>
    </section>

    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {[
        { Icon: ArrowDownLeft, label: t("eWallet.stats.available"), value: formatCurrency(employerBalance), color: "text-[#15803D]" },
        { Icon: ArrowUpRight, label: t("eWallet.stats.pending"), value: formatCurrency(pendingTotal), color: "text-[#B45309]" },
        { Icon: Landmark, label: t("eWallet.stats.withdrawals"), value: String(payouts.length), color: "text-[#1C4D8D]" },
      ].map(({ Icon, label, value, color }) => <div key={label} className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <div className={`flex items-center gap-2 text-sm ${color}`}><Icon className="h-4 w-4" />{label}</div><p className="mt-3 text-2xl font-bold text-[#111827]">{value}</p>
      </div>)}
    </section>

    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
        <h2 className="text-xl font-semibold text-[#111827]">{t("eWallet.history.title")}</h2><p className="mt-1 text-sm text-[#6B7280]">{t("eWallet.history.description")}</p>
        <div className="mt-5 space-y-3">{payouts.length === 0 ? <p className="py-6 text-sm text-[#6B7280]">{t("eWallet.history.empty")}</p> : payouts.map((payout) => <article key={payout._id} className="rounded-xl border border-[#E5E7EB] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-lg font-semibold text-[#111827]">{formatCurrency(amountOf(payout.amount))}</p><p className="mt-1 text-sm text-[#6B7280]">{payout.destinationSnapshot.institutionName} · {payout.destinationSnapshot.accountName}</p><p className="mt-1 text-xs text-[#9CA3AF]">{payout.destinationSnapshot.accountNumberMasked || payout.destinationSnapshot.accountNumber}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(payout.status)}`}>{t(`eWallet.status.${payout.status}`)}</span></div>
          <p className="mt-3 text-xs text-[#6B7280]">{t("eWallet.history.requested", { date: payout.createdAt ? formatDateTime(payout.createdAt) : "—" })}</p>
          {payout.reviewNotes ? <p className="mt-3 rounded-lg bg-[#F8FAFC] p-3 text-sm text-[#475569]">{payout.reviewNotes}</p> : null}
          {payout.status === "requested" ? <button type="button" disabled={cancellingId === payout._id} onClick={() => void cancelPayout(payout._id)} className="mt-4 rounded-lg border border-[#FCA5A5] px-3 py-2 text-sm font-medium text-[#B91C1C] disabled:opacity-60">{cancellingId === payout._id ? t("eWallet.history.cancelling") : t("eWallet.history.cancel")}</button> : null}
        </article>)}</div>
      </div>
      <div ref={payoutRef} className="h-fit rounded-2xl border border-[#E5E7EB] bg-white p-6">
        <h2 className="text-xl font-semibold text-[#111827]">{t("eWallet.form.title")}</h2><p className="mt-2 text-sm text-[#6B7280]">{t("eWallet.form.available", { amount: formatCurrency(employerBalance) })}</p>
        <div className="mt-5 space-y-4">
          <input aria-label={t("eWallet.form.amount")} type="number" min="1" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder={t("eWallet.form.amount")} className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2" />
          <select aria-label={t("eWallet.form.method")} value={form.methodType} onChange={(event) => setForm((current) => ({ ...current, methodType: event.target.value }))} className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"><option value="bank_transfer">{t("eWallet.form.bank")}</option><option value="gcash">GCash</option><option value="maya">Maya</option></select>
          {(["institutionName", "accountName", "accountNumber"] as const).map((field) => <input key={field} aria-label={t(`eWallet.form.${field}`)} type="text" value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} placeholder={t(`eWallet.form.${field}`)} className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2" />)}
          <button type="button" disabled={submittingPayout} onClick={() => void submitPayout()} className="w-full rounded-lg bg-[#1C4D8D] px-4 py-3 font-medium text-white disabled:opacity-60">{submittingPayout ? t("eWallet.form.submitting") : t("eWallet.form.submit")}</button>
        </div>
      </div>
    </section>

    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6"><h2 className="text-xl font-semibold text-[#111827]">{t("eWallet.transactions.title")}</h2><div className="mt-4 space-y-3">{transactions.length === 0 ? <p className="py-4 text-sm text-[#6B7280]">{t("eWallet.transactions.empty")}</p> : transactions.slice(0, 20).map((transaction) => <div key={transaction._id} className="flex justify-between gap-4 border-b border-[#F3F4F6] py-3 text-sm"><span className="text-[#374151]">{transaction.label || transaction.type}</span><span className="font-medium text-[#111827]">{formatCurrency(amountOf(transaction.amount))}</span></div>)}</div></section>

    {topUpOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-semibold text-[#111827]">{t("eWallet.topUp")}</h2><p className="mt-2 text-sm text-[#6B7280]">{t("eWallet.topUpDescription")}</p><input aria-label={t("eWallet.form.amount")} type="number" min="1" step="0.01" value={topUpAmount} onChange={(event) => setTopUpAmount(event.target.value)} className="mt-5 w-full rounded-lg border border-[#D1D5DB] px-3 py-2" /><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setTopUpOpen(false)} className="rounded-lg px-4 py-2 text-[#374151]">{t("eWallet.cancel")}</button><button type="button" disabled={submittingTopUp} onClick={() => void submitTopUp()} className="rounded-lg bg-[#1C4D8D] px-4 py-2 text-white disabled:opacity-60">{submittingTopUp ? t("eWallet.loading") : t("eWallet.continue")}</button></div></div></div> : null}
  </div>;
}
