import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Landmark, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "../../lib/toast";
import { Dialog, StatusState } from "../../components/ui";
import { WalletSectionPager, type WalletSection } from "../../components/wallet/WalletSectionPager";
import {
  formatDate,
  getPayoutStatusClasses,
  getTransactionDirection,
  getTransactionStatusClasses,
  linkedEntityLabel,
  toAmount,
  txLabel,
  txTypeLabel,
} from "../../components/wallet/walletFormat";
import { formatCurrency } from "../../lib/formatters";
import { safeExternalUrl } from "../../utils/safeExternalUrl";
import { useAuth } from "../../hooks/useAuth";
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

export function EmployerEWallet() {
  const { t } = useTranslation("employer");
  const { user } = useAuth();
  const payoutRef = useRef<HTMLDivElement | null>(null);
  const pendingWithdrawScrollRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const [walletSectionId, setWalletSectionId] = useState("withdraw");
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

  const walletOwnerId = String(user?.id || "");

  const loadWallet = useCallback(async () => {
    try {
      const [profileResponse, transactionResponse, payoutResponse] = await Promise.all([
        getProfile(),
        getPaymentTransactions(),
        getPayoutRequests("EMPLOYER"),
      ]);
      const profile = (profileResponse as any)?.profile ?? profileResponse;
      setEmployerBalance(toAmount((profile as any)?.employerBalance));
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
    .reduce((total, payout) => total + toAmount(payout.amount), 0), [payouts]);

  const submitTopUp = async () => {
    const amount = toAmount(topUpAmount);
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
    const amount = toAmount(form.amount);
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

  /**
   * The form sits on one tab of `WalletSectionPager`, so its node is only
   * mounted while that tab is showing -- a plain `scrollIntoView` would hit a
   * null ref and silently do nothing. Deferring by a frame is not enough
   * either: the pager's `AnimatePresence` runs in `mode="wait"`, so the
   * outgoing pane animates away before the form mounts. The ref callback below
   * does the scroll at the moment the node actually appears.
   *
   * Which section is showing is read from `walletSectionId`, never from whether
   * the ref happens to be populated. During the pager's exit animation the ref
   * still points at the *outgoing* pane, so a ref-liveness check would take the
   * "already here, just scroll" branch while another tab was showing -- leaving
   * the button scrolling a dying node and never switching tabs.
   */
  const handleWithdrawClick = () => {
    if (walletSectionId !== "withdraw") {
      pendingWithdrawScrollRef.current = true;
      setWalletSectionId("withdraw");
    }
    // Already mounted -- the withdraw tab is showing, or the layout is stacked
    // below `lg` and every section is on screen at once.
    payoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const attachPayoutCard = useCallback((node: HTMLDivElement | null) => {
    payoutRef.current = node;
    if (!node || !pendingWithdrawScrollRef.current) return;
    pendingWithdrawScrollRef.current = false;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Built as data so `WalletSectionPager` can render these either stacked
  // (below `lg`) or one at a time behind its tab strip, from a single copy of
  // each block -- the same shape the worker wallet uses.
  const walletSections: WalletSection[] = [
    {
      id: "withdraw",
      label: t("eWallet.form.title"),
      content: (
        <div ref={attachPayoutCard} className="ui-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="w-5 h-5 text-brand" />
            <h3 className="text-section font-semibold text-[#111827]">{t("eWallet.form.title")}</h3>
          </div>
          <p className="text-body-sm text-[#6B7280] mb-6">
            {t("eWallet.form.available", { amount: formatCurrency(employerBalance) })}
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="employer-payout-amount" className="text-body-sm text-[#374151] mb-2 block">{t("eWallet.form.amount")}</label>
              <input
                id="employer-payout-amount"
                type="number"
                min="1"
                step="0.01"
                className="w-full border border-[#D1D5DB] rounded-control px-3 py-2 text-body"
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                placeholder="1000"
              />
            </div>

            <div>
              <label htmlFor="employer-payout-method" className="text-body-sm text-[#374151] mb-2 block">{t("eWallet.form.method")}</label>
              <select
                id="employer-payout-method"
                className="w-full border border-[#D1D5DB] rounded-control px-3 py-2 text-body"
                value={form.methodType}
                onChange={(event) => setForm((current) => ({ ...current, methodType: event.target.value }))}
              >
                <option value="bank_transfer">{t("eWallet.form.methodOptions.bankTransfer")}</option>
                <option value="gcash">{t("eWallet.form.methodOptions.gcash")}</option>
                <option value="maya">{t("eWallet.form.methodOptions.maya")}</option>
              </select>
            </div>

            <div>
              <label htmlFor="employer-payout-institution" className="text-body-sm text-[#374151] mb-2 block">{t("eWallet.form.institutionName")}</label>
              <input
                id="employer-payout-institution"
                type="text"
                className="w-full border border-[#D1D5DB] rounded-control px-3 py-2 text-body"
                value={form.institutionName}
                onChange={(event) => setForm((current) => ({ ...current, institutionName: event.target.value }))}
                placeholder={t("eWallet.form.institutionPlaceholder")}
              />
            </div>

            <div>
              <label htmlFor="employer-payout-account-name" className="text-body-sm text-[#374151] mb-2 block">{t("eWallet.form.accountName")}</label>
              <input
                id="employer-payout-account-name"
                type="text"
                className="w-full border border-[#D1D5DB] rounded-control px-3 py-2 text-body"
                value={form.accountName}
                onChange={(event) => setForm((current) => ({ ...current, accountName: event.target.value }))}
                placeholder={t("eWallet.form.accountNamePlaceholder")}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="employer-payout-account-number" className="text-body-sm text-[#374151] mb-2 block">{t("eWallet.form.accountNumber")}</label>
              <input
                id="employer-payout-account-number"
                type="text"
                className="w-full border border-[#D1D5DB] rounded-control px-3 py-2 text-body"
                value={form.accountNumber}
                onChange={(event) => setForm((current) => ({ ...current, accountNumber: event.target.value }))}
                placeholder={t("eWallet.form.accountNumberPlaceholder")}
              />
            </div>

            <button
              type="button"
              className="sm:col-span-2 w-full px-4 py-3 rounded-control bg-brand text-white text-body font-medium disabled:opacity-60"
              onClick={() => void submitPayout()}
              disabled={submittingPayout}
            >
              {submittingPayout ? t("eWallet.form.submitting") : t("eWallet.form.submit")}
            </button>
          </div>
        </div>
      ),
    },
    {
      id: "history",
      label: t("eWallet.history.title"),
      content: (
        <div className="ui-card p-6">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div>
              <h3 className="text-section font-semibold text-[#111827]">{t("eWallet.history.title")}</h3>
              <p className="text-body-sm text-[#6B7280] mt-1">{t("eWallet.history.description")}</p>
            </div>
          </div>

          {loading ? (
            <StatusState tone="loading" title={t("eWallet.history.loading")} />
          ) : payouts.length === 0 ? (
            <StatusState
              title={t("eWallet.history.empty")}
              description={t("eWallet.history.emptyDescription")}
            />
          ) : (
            <div className="space-y-3">
              {payouts.map((payout) => (
                <div key={payout._id} className="rounded-card border border-[#E5E7EB] p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-[18px] font-semibold text-[#111827]">{formatCurrency(toAmount(payout.amount))}</p>
                      <p className="text-body-sm text-[#6B7280] mt-1">
                        {payout.destinationSnapshot.institutionName} · {payout.destinationSnapshot.accountName}
                      </p>
                      <p className="text-caption text-[#9CA3AF] mt-1">
                        {payout.destinationSnapshot.accountNumberMasked || payout.destinationSnapshot.accountNumber || "-"}
                      </p>
                    </div>
                    <span className={`px-3 py-1.5 rounded-full text-[11px] font-semibold ${getPayoutStatusClasses(payout.status)}`}>
                      {t(`eWallet.status.${payout.status}`)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-body-sm text-[#6B7280]">
                    <div>
                      <p className="text-[#111827] font-medium">{t("eWallet.history.requested")}</p>
                      <p>{formatDate(payout.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-[#111827] font-medium">{t("eWallet.history.reviewed")}</p>
                      <p>{formatDate(payout.reviewedAt || undefined)}</p>
                    </div>
                    <div>
                      <p className="text-[#111827] font-medium">{t("eWallet.history.paid")}</p>
                      <p>{formatDate(payout.paidAt || undefined)}</p>
                    </div>
                  </div>
                  {payout.reviewNotes ? (
                    <div className="mt-4 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] px-4 py-3 text-body-sm text-[#475569]">
                      {payout.reviewNotes}
                    </div>
                  ) : null}
                  {payout.status === "requested" ? (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => void cancelPayout(payout._id)}
                        disabled={cancellingId === payout._id}
                        className="px-4 py-2 rounded-control border border-[#FCA5A5] text-[#B91C1C] text-body font-medium hover:bg-[#FEF2F2] disabled:opacity-60"
                      >
                        {cancellingId === payout._id ? t("eWallet.history.cancelling") : t("eWallet.history.cancel")}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "transactions",
      label: t("eWallet.transactions.title"),
      content: (
        <div className="ui-card p-6">
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <h3 className="text-section font-semibold text-[#111827]">{t("eWallet.transactions.title")}</h3>
            <div className="text-caption text-[#6B7280]">{t("eWallet.transactions.helper")}</div>
          </div>

          {loading ? (
            <div className="text-body text-[#6B7280] py-6">{t("eWallet.transactions.loading")}</div>
          ) : transactions.length === 0 ? (
            <div className="text-body text-[#6B7280] py-6">{t("eWallet.transactions.empty")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-body-sm">
                <thead>
                  <tr className="text-[#6B7280] border-b border-[#E5E7EB]">
                    <th className="py-3 pr-4 font-medium">{t("eWallet.transactions.columns.type")}</th>
                    <th className="py-3 pr-4 font-medium">{t("eWallet.transactions.columns.status")}</th>
                    <th className="py-3 pr-4 font-medium">{t("eWallet.transactions.columns.label")}</th>
                    <th className="py-3 pr-4 font-medium">{t("eWallet.transactions.columns.amount")}</th>
                    <th className="py-3 pr-4 font-medium">{t("eWallet.transactions.columns.reference")}</th>
                    <th className="py-3 pr-4 font-medium">{t("eWallet.transactions.columns.linkedEntity")}</th>
                    <th className="py-3 font-medium">{t("eWallet.transactions.columns.date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 20).map((tx) => {
                    const direction = getTransactionDirection(tx, walletOwnerId);
                    const amountPrefix = direction === "credit" ? "+" : direction === "debit" ? "-" : "";
                    const amountClass = direction === "credit"
                      ? "text-[#15803D]"
                      : direction === "debit"
                      ? "text-[#B91C1C]"
                      : "text-[#6B7280]";
                    return (
                      <tr key={tx._id} className="border-b border-[#F3F4F6] align-top">
                        <td className="py-3 pr-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-brand/[0.06] text-brand">
                            {txTypeLabel(t, tx.type)}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${getTransactionStatusClasses(tx.status)}`}>
                            {tx.status ? t(`eWallet.transactionStatus.${tx.status}`) : "-"}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-[#111827]">{txLabel(t, tx)}</td>
                        <td className={`py-3 pr-4 font-semibold ${amountClass}`}>
                          {amountPrefix}{formatCurrency(toAmount(tx.amount))}
                          {tx.meta?.processingFee ? <div className="text-[11px] font-normal text-[#6B7280]">Fee: {formatCurrency(toAmount(tx.meta.processingFee))}</div> : null}
                        </td>
                        <td className="py-3 pr-4 text-[#6B7280]">
                          <div>{tx.reference || "-"}</div>
                          {tx.providerReference ? <div className="text-[11px] text-[#9CA3AF]">{tx.providerReference}</div> : null}
                        </td>
                        <td className="py-3 pr-4 text-[#6B7280]">
                          {linkedEntityLabel(t, tx.relatedEntityType || tx.balanceTarget)}
                        </td>
                        <td className="py-3 text-[#6B7280]">{formatDate(tx.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ),
    },
  ];

  return <div className="max-w-[1341px] mx-auto space-y-6">
    <section className="rounded-[20px] bg-brand p-5 sm:p-8 text-white shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-sm text-white/80">{t("eWallet.balanceLabel")}</p>
          <h1 className="mt-2 text-[28px] sm:text-4xl font-bold">{loading ? "—" : formatCurrency(employerBalance)}</h1>
          <p className="mt-3 max-w-2xl text-sm text-white/80">{t("eWallet.description")}</p>
        </div>
        <Wallet className="h-10 w-10 text-white/85" />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => setTopUpOpen(true)} className="rounded-xl bg-white px-5 py-3 font-semibold text-brand">{t("eWallet.topUp")}</button>
        <button type="button" onClick={handleWithdrawClick} className="rounded-xl bg-white/20 px-5 py-3 font-semibold text-white">{t("eWallet.withdraw")}</button>
      </div>
    </section>

    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="ui-card p-6">
        <div className="flex items-center gap-2 text-[#10B981] mb-2">
          <ArrowDownLeft className="w-4 h-4" />
          <span className="text-body-sm">{t("eWallet.stats.available")}</span>
        </div>
        <p className="text-[26px] font-bold text-[#111827]">{formatCurrency(employerBalance)}</p>
        <p className="mt-1 text-[11px] text-[#6B7280]">{t("eWallet.stats.availableHelper")}</p>
      </div>

      <div className="ui-card p-6">
        <div className="flex items-center gap-2 text-[#EF4444] mb-2">
          <ArrowUpRight className="w-4 h-4" />
          <span className="text-body-sm">{t("eWallet.stats.pending")}</span>
        </div>
        <p className="text-[26px] font-bold text-[#111827]">{formatCurrency(pendingTotal)}</p>
        <p className="mt-1 text-[11px] text-[#6B7280]">{t("eWallet.stats.pendingHelper")}</p>
      </div>

      <div className="ui-card p-6">
        <div className="flex items-center gap-2 text-brand mb-2">
          <Landmark className="w-4 h-4" />
          <span className="text-body-sm">{t("eWallet.stats.withdrawals")}</span>
        </div>
        <p className="text-[26px] font-bold text-[#111827]">{payouts.length}</p>
        <p className="mt-1 text-[11px] text-[#6B7280]">{t("eWallet.stats.withdrawalsHelper")}</p>
      </div>
    </section>

    <WalletSectionPager
      sections={walletSections}
      ariaLabel={t("eWallet.pager.ariaLabel")}
      previousLabel={t("eWallet.pager.previous")}
      nextLabel={t("eWallet.pager.next")}
      idPrefix="employer-wallet-section"
      activeId={walletSectionId}
      onActiveIdChange={setWalletSectionId}
    />

    {topUpOpen ? (
      <Dialog
        open
        title={t("eWallet.topUp")}
        description={t("eWallet.topUpDescription")}
        onClose={() => setTopUpOpen(false)}
        closeDisabled={submittingTopUp}
      >
        <label htmlFor="employer-topup-amount" className="text-body-sm text-[#374151] mb-2 block">{t("eWallet.form.amount")}</label>
        <input
          id="employer-topup-amount"
          type="number"
          min="1"
          step="0.01"
          value={topUpAmount}
          onChange={(event) => setTopUpAmount(event.target.value)}
          className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2"
        />
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setTopUpOpen(false)} className="min-h-11 rounded-lg px-4 text-[#374151]">
            {t("eWallet.cancel")}
          </button>
          <button
            type="button"
            disabled={submittingTopUp}
            onClick={() => void submitTopUp()}
            className="min-h-11 rounded-lg bg-brand px-4 text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {submittingTopUp ? t("eWallet.loading") : t("eWallet.continue")}
          </button>
        </div>
      </Dialog>
    ) : null}
  </div>;
}
