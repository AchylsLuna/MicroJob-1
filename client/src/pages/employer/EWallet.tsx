import { WalletTransactions } from '../../components/wallet/WalletTransactions';
import { WithdrawalPanel } from "../../components/wallet/WithdrawalPanel";
import { WithdrawalHistory } from "../../components/wallet/WithdrawalHistory";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Landmark, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "../../lib/toast";
import { Dialog } from "../../components/ui";
import { WalletSectionPager, type WalletSection } from "../../components/wallet/WalletSectionPager";
import {
  toAmount,
} from "../../components/wallet/walletFormat";
import { formatCurrency } from "../../lib/formatters";
import { safeExternalUrl } from "../../utils/safeExternalUrl";
import { useAuth } from "../../hooks/useAuth";
import {
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
  const [walletSectionId, setWalletSectionId] = useState("withdraw");
  const [loading, setLoading] = useState(true);
  const [employerBalance, setEmployerBalance] = useState(0);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [submittingTopUp, setSubmittingTopUp] = useState(false);

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
    { id: "withdraw", label: t("eWallet.form.title"), content: <div ref={attachPayoutCard}><WithdrawalPanel sourceWallet="EMPLOYER" balance={employerBalance} onChanged={() => void loadWallet()} /></div> },
    {
      id: "transactions",
      label: t("eWallet.transactions.title"),
      content: <WalletTransactions transactions={transactions} ownerId={walletOwnerId} loading={loading} title={t('eWallet.transactions.title')} t={t} jobHref={(jobId) => `/employer/jobs?jobId=${encodeURIComponent(jobId)}`} />,
    },
    {
      id: "withdrawal-history",
      label: t("common:wallet.history"),
      content: <WithdrawalHistory sourceWallet="EMPLOYER" onChanged={() => void loadWallet()} />,
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
