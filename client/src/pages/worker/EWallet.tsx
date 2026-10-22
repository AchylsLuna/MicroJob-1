import { WalletTransactions } from '../../components/wallet/WalletTransactions';
import { WithdrawalPanel } from "../../components/wallet/WithdrawalPanel";
import { WithdrawalHistory } from "../../components/wallet/WithdrawalHistory";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WalletSectionPager, type WalletSection } from "../../components/wallet/WalletSectionPager";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Landmark,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "../../lib/toast";
import { useAuth } from "../../hooks/useAuth";
import { formatCurrency } from "../../lib/formatters";
import {
  getPaymentTransactions,
  getPayoutRequests,
  getProfile,
  type PaymentTransaction,
  type PayoutRequest,
} from "../../services/api";
import {
  getTransactionDirection,
  toAmount,
} from "../../components/wallet/walletFormat";

export function EWallet() {
  const { t } = useTranslation("worker");
  const { user } = useAuth();
  const payoutRequestRef = useRef<HTMLDivElement | null>(null);
  const pendingWithdrawScrollRef = useRef(false);
  const [walletSectionId, setWalletSectionId] = useState("withdraw");
  const [isLoading, setIsLoading] = useState(true);
  const [workerBalance, setWorkerBalance] = useState(0);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);


  const isWorkerWalletView = user?.role === "both" ||
    Boolean(user?.accountOptions?.includes("worker")) || user?.accountType === "worker";

  const loadWallet = useCallback(async (skipLoader = false) => {
    if (!skipLoader) setIsLoading(true);
    try {
      const [profileResponse, txResponse, payoutResponse] = await Promise.all([
        getProfile(),
        getPaymentTransactions().catch(() => ({ transactions: [] as PaymentTransaction[] })),
        isWorkerWalletView
          ? getPayoutRequests().catch(() => ({ payoutRequests: [] as PayoutRequest[] }))
          : Promise.resolve({ payoutRequests: [] as PayoutRequest[] }),
      ]);

      const profile = (profileResponse as any)?.profile ?? (profileResponse as any);
      const nextWorkerBalance = toAmount((profile as any)?.workerBalance);

      setWorkerBalance(nextWorkerBalance);

      const txList = Array.isArray((txResponse as any)?.transactions)
        ? ((txResponse as any).transactions as PaymentTransaction[])
        : [];
      setTransactions(txList);

      const nextPayouts = Array.isArray((payoutResponse as any)?.payoutRequests)
        ? ((payoutResponse as any).payoutRequests as PayoutRequest[])
        : [];
      setPayoutRequests(nextPayouts);
    } catch (error: any) {
      if (!error?.message?.includes("304")) {
        toast.error(error?.message || t("eWallet.toast.loadFailed"));
      }
    } finally {
      if (!skipLoader) setIsLoading(false);
    }
  }, [isWorkerWalletView, t]);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      if (!isActive) return;
      await loadWallet();
    };

    load();

    const pollInterval = window.setInterval(() => {
      if (isActive) {
        loadWallet(true);
      }
    }, 15000);

    return () => {
      isActive = false;
      window.clearInterval(pollInterval);
    };
  }, [isWorkerWalletView, loadWallet]);

  const walletOwnerId = String(user?.id || "");

  const totalMoneyIn = useMemo(
    () => transactions
      .filter((tx) => getTransactionDirection(tx, walletOwnerId) === "credit")
      .reduce((sum, tx) => sum + toAmount(tx.amount), 0),
    [transactions, walletOwnerId],
  );

  const totalMoneyOut = useMemo(
    () => transactions
      .filter((tx) => getTransactionDirection(tx, walletOwnerId) === "debit")
      .reduce((sum, tx) => sum + toAmount(tx.amount), 0),
    [transactions, walletOwnerId],
  );

  const pendingPayoutTotal = useMemo(
    () =>
      payoutRequests
        .filter((item) => item.status === "requested" || item.status === "approved")
        .reduce((sum, item) => sum + toAmount(item.amount), 0),
    [payoutRequests],
  );

  /**
   * On desktop the form lives on one tab of `WalletSectionPager`, so its node
   * is only mounted while that tab is showing — the plain `scrollIntoView` this
   * used to do would hit a null ref and silently do nothing.
   *
   * Scrolling cannot simply be deferred by a frame either: the pager's
   * `AnimatePresence` runs in `mode="wait"`, so the outgoing pane animates away
   * before the form mounts. The ref callback below does the scroll at the
   * moment the node actually appears.
   *
   * Which section is showing is read from `walletSectionId`, never from whether
   * the ref happens to be populated. Mid-transition the ref still points at the
   * *outgoing* pane, so a ref-liveness check would take the "already here, just
   * scroll" branch while another tab was showing — leaving the button scrolling
   * a dying node and never switching tabs.
   */
  const handleWithdrawClick = () => {
    if (walletSectionId !== "withdraw") {
      pendingWithdrawScrollRef.current = true;
      setWalletSectionId("withdraw");
    }
    // Already mounted -- the withdraw tab is showing, or the layout is stacked
    // below `lg` and every section is on screen at once.
    payoutRequestRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const attachPayoutCard = useCallback((node: HTMLDivElement | null) => {
    payoutRequestRef.current = node;
    if (!node || !pendingWithdrawScrollRef.current) return;
    pendingWithdrawScrollRef.current = false;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Sections are built as data so `WalletSectionPager` can render them either
  // stacked or one-at-a-time behind its tab strip, from a single copy of each
  // block. Withdrawal sections are available to worker accounts, including
  // accounts with both roles when they use the worker dashboard.
  const walletSections: WalletSection[] = [
    ...(isWorkerWalletView ? [{ id: "withdraw", label: t("eWallet.form.title"), content: <div ref={attachPayoutCard}><WithdrawalPanel sourceWallet="WORKER" balance={workerBalance} onChanged={() => void loadWallet(true)} /></div> }] : []),
    {
      id: "transactions",
      label: t("eWallet.transactions.titleRecent"),
      content: <WalletTransactions transactions={transactions} ownerId={walletOwnerId} loading={isLoading} title={t('eWallet.transactions.titleRecent')} t={t} jobHref={(jobId) => `/worker/job-details/${encodeURIComponent(jobId)}`} />,
    },
    ...(isWorkerWalletView ? [{
      id: "withdrawal-history",
      label: t("common:wallet.history"),
      content: <WithdrawalHistory sourceWallet="WORKER" onChanged={() => void loadWallet(true)} />,
    }] : []),
  ];

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      <div className="bg-brand rounded-[20px] p-5 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24" />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
            <div>
              <p className="text-body opacity-80 mb-2">
                {t("eWallet.balanceCard.currentBalance", { role: t("eWallet.role.worker") })}
              </p>
              <h2 className="text-[28px] sm:text-[42px] font-bold tracking-tight">
                {isLoading ? t("eWallet.balanceCard.loading") : formatCurrency(workerBalance)}
              </h2>
              <p className="text-body text-white/75 mt-3">
                {t("eWallet.balanceCard.descriptionWorker")}
              </p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-card p-4">
              <CreditCard className="w-8 h-8" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-caption opacity-80">{t("eWallet.balanceCard.workerBalance")}</p>
              <p className="text-[20px] font-semibold mt-1">{isLoading ? "—" : formatCurrency(workerBalance)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-caption opacity-80">{t("eWallet.balanceCard.pendingWithdrawals")}</p>
              <p className="text-[20px] font-semibold mt-1">{formatCurrency(pendingPayoutTotal)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-caption opacity-80">{t("eWallet.balanceCard.totalTransactions")}</p>
              <p className="text-[20px] font-semibold mt-1">{transactions.length}</p>
            </div>
          </div>

          {isWorkerWalletView ? (
            <button
              type="button"
              onClick={handleWithdrawClick}
              className="w-full md:w-auto bg-white text-brand font-semibold py-3 px-6 rounded-xl hover:bg-gray-100 transition"
            >
              {t("eWallet.balanceCard.withdrawFunds")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="ui-card p-6">
          <div className="flex items-center gap-2 text-[#10B981] mb-2">
            <ArrowDownLeft className="w-4 h-4" />
            <span className="text-body-sm">{t("eWallet.stats.moneyIn")}</span>
          </div>
          <p className="text-[26px] font-bold text-[#111827]">{formatCurrency(totalMoneyIn)}</p>
          <p className="mt-1 text-[11px] text-[#6B7280]">{t("eWallet.stats.moneyInHelper")}</p>
        </div>

        <div className="ui-card p-6">
          <div className="flex items-center gap-2 text-[#EF4444] mb-2">
            <ArrowUpRight className="w-4 h-4" />
            <span className="text-body-sm">{t("eWallet.stats.moneyOut")}</span>
          </div>
          <p className="text-[26px] font-bold text-[#111827]">{formatCurrency(totalMoneyOut)}</p>
          <p className="mt-1 text-[11px] text-[#6B7280]">{t("eWallet.stats.moneyOutHelper")}</p>
        </div>

        <div className="ui-card p-6">
          <div className="flex items-center gap-2 text-brand mb-2">
            <Landmark className="w-4 h-4" />
            <span className="text-body-sm">{t("eWallet.stats.withdrawals")}</span>
          </div>
          <p className="text-[26px] font-bold text-[#111827]">{payoutRequests.length}</p>
          {/* Third card was the only one without a helper line, so it sat a
              line short of its neighbours and read as unfinished. */}
          <p className="mt-1 text-[11px] text-[#6B7280]">{t("eWallet.stats.withdrawalsHelper")}</p>
        </div>
      </div>

      <WalletSectionPager
        sections={walletSections}
        ariaLabel={t("eWallet.pager.ariaLabel")}
        previousLabel={t("eWallet.pager.previous")}
        nextLabel={t("eWallet.pager.next")}
        idPrefix="wallet-section"
        activeId={walletSectionId}
        onActiveIdChange={setWalletSectionId}
      />
    </div>
  );
}
