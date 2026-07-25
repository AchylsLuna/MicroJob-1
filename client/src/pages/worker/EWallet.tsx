import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Landmark,
  Loader2,
  Wallet,
} from "lucide-react";
import { toast } from "../../lib/toast";
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

const currency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

const toAmount = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const txLabel = (tx: PaymentTransaction) => {
  if (tx.label) return tx.label;
  switch (tx.type) {
    case "TOP_UP":
      return "Top-up";
    case "ESCROW":
      return "Escrow";
    case "PAYOUT":
      return "Payout";
    case "REFUND":
      return "Refund";
    default:
      return "Transaction";
  }
};

const getPayoutStatusClasses = (status: PayoutRequest["status"]) => {
  switch (status) {
    case "requested":
      return "bg-[#DBEAFE] text-[#1D4ED8]";
    case "approved":
      return "bg-[#FEF3C7] text-[#B45309]";
    case "paid":
      return "bg-[#DCFCE7] text-[#15803D]";
    case "rejected":
      return "bg-[#FEE2E2] text-[#B91C1C]";
    case "cancelled":
      return "bg-[#F3F4F6] text-[#6B7280]";
    default:
      return "bg-[#F3F4F6] text-[#6B7280]";
  }
};

const getTransactionStatusClasses = (status?: PaymentTransaction["status"]) => {
  switch (status) {
    case "COMPLETED":
      return "bg-[#DCFCE7] text-[#15803D]";
    case "PENDING":
      return "bg-[#DBEAFE] text-[#1D4ED8]";
    case "FAILED":
      return "bg-[#FEE2E2] text-[#B91C1C]";
    case "CANCELLED":
      return "bg-[#F3F4F6] text-[#6B7280]";
    default:
      return "bg-[#F3F4F6] text-[#6B7280]";
  }
};

export function EWallet() {
  const { user } = useAuth();
  const payoutRequestRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingTopUp, setIsCreatingTopUp] = useState(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);
  const [cancellingPayoutId, setCancellingPayoutId] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [employerBalance, setEmployerBalance] = useState(0);
  const [workerBalance, setWorkerBalance] = useState(0);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [payoutForm, setPayoutForm] = useState({
    amount: "",
    methodType: "bank_transfer",
    institutionName: "",
    accountName: "",
    accountNumber: "",
  });

  const accountType = user?.accountType || "worker";
  const accountOptions = user?.accountOptions || ["worker"];
  const isBothRole =
    user?.role === "both" ||
    (accountOptions.includes("worker") && accountOptions.includes("employer"));
  const isEmployerWalletView = !isBothRole && accountType === "employer";
  const canUseWorkerWallet =
    isBothRole ||
    (!isEmployerWalletView && (accountOptions.includes("worker") || accountType === "worker"));
  const isWorkerWalletView = isBothRole || (!isEmployerWalletView && canUseWorkerWallet);

  const loadWallet = async (skipLoader = false) => {
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
      const nextEmployerBalance = toAmount((profile as any)?.employerBalance);
      const nextWorkerBalance = toAmount((profile as any)?.workerBalance);

      setEmployerBalance(nextEmployerBalance);
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
        toast.error(error?.message || "Failed to load wallet data.");
      }
    } finally {
      if (!skipLoader) setIsLoading(false);
    }
  };

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
  }, [isWorkerWalletView]);

  const activeBalance = isBothRole
    ? employerBalance + workerBalance
    : isEmployerWalletView
    ? employerBalance
    : workerBalance;

  const totalCredits = useMemo(
    () => transactions.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + toAmount(tx.amount), 0),
    [transactions],
  );

  const totalDebits = useMemo(
    () =>
      transactions
        .filter((tx) => tx.type === "ESCROW" || tx.type === "PAYOUT")
        .reduce((sum, tx) => sum + toAmount(tx.amount), 0),
    [transactions],
  );

  const pendingPayoutTotal = useMemo(
    () =>
      payoutRequests
        .filter((item) => item.status === "requested" || item.status === "approved")
        .reduce((sum, item) => sum + toAmount(item.amount), 0),
    [payoutRequests],
  );

  const handleTopUpSubmit = async () => {
    if (!(isEmployerWalletView || isBothRole)) {
      return;
    }

    const amount = Number(topUpAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    setIsCreatingTopUp(true);
    try {
      const response = await createTopUpSession({ amount, target: "EMPLOYER" });
      if (!response?.checkoutUrl) {
        throw new Error("Payment checkout URL was not returned.");
      }

      if (response?.checkoutId) {
        sessionStorage.setItem("topup_checkout_id", response.checkoutId);
      }

      window.location.assign(response.checkoutUrl);
    } catch (error: any) {
      toast.error(error?.message || "Failed to initialize top-up.");
      setIsCreatingTopUp(false);
    }
  };

  const handlePayoutSubmit = async () => {
    if (!isWorkerWalletView) return;

    const amount = Number(payoutForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid payout amount.");
      return;
    }
    if (amount > workerBalance) {
      toast.error("Payout amount cannot exceed your worker balance.");
      return;
    }
    if (!payoutForm.institutionName.trim() || !payoutForm.accountName.trim() || !payoutForm.accountNumber.trim()) {
      toast.error("Complete the destination details before submitting your withdrawal.");
      return;
    }

    setIsSubmittingPayout(true);
    try {
      await createPayoutRequest({
        amount,
        destinationSnapshot: {
          methodType: payoutForm.methodType,
          institutionName: payoutForm.institutionName.trim(),
          accountName: payoutForm.accountName.trim(),
          accountNumber: payoutForm.accountNumber.trim(),
        },
      });
      setPayoutForm({
        amount: "",
        methodType: "bank_transfer",
        institutionName: "",
        accountName: "",
        accountNumber: "",
      });
      toast.success("Withdrawal submitted.");
      await loadWallet();
    } catch (error: any) {
      toast.error(error?.message || "Failed to submit withdrawal.");
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  const handleCancelPayout = async (payoutRequestId: string) => {
    setCancellingPayoutId(payoutRequestId);
    try {
      await cancelPayoutRequest(payoutRequestId);
      toast.success("Withdrawal cancelled.");
      await loadWallet();
    } catch (error: any) {
      toast.error(error?.message || "Failed to cancel withdrawal.");
    } finally {
      setCancellingPayoutId(null);
    }
  };

  const handleWithdrawClick = () => {
    payoutRequestRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      <div className="bg-gradient-to-br from-[#0F2954] via-[#1C4D8D] to-[#4988C4] rounded-[20px] p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24" />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
            <div>
              <p className="text-[14px] opacity-80 mb-2">
                {isBothRole ? "Combined Balance" : `Current Balance (${isEmployerWalletView ? "employer" : "worker"})`}
              </p>
              <h2 className="text-[42px] font-bold tracking-tight">
                {isLoading ? "Loading..." : currency.format(activeBalance)}
              </h2>
              <p className="text-[14px] text-white/75 mt-3">
                {isBothRole
                  ? "Your combined employer and worker balance. Top up your wallet to fund jobs, and withdraw your earned balance."
                  : isEmployerWalletView
                  ? "Employers add funds here to pay into escrow and cover worker earnings."
                  : "Workers can only withdraw completed earnings here once payouts are available."}
              </p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-[16px] p-4">
              <CreditCard className="w-8 h-8" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {isBothRole ? (
              <>
                <div className="bg-white/10 backdrop-blur-sm rounded-[12px] p-4">
                  <p className="text-[12px] opacity-80">Employer Balance</p>
                  <p className="text-[20px] font-semibold mt-1">{isLoading ? "—" : currency.format(employerBalance)}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-[12px] p-4">
                  <p className="text-[12px] opacity-80">Worker Balance</p>
                  <p className="text-[20px] font-semibold mt-1">{isLoading ? "—" : currency.format(workerBalance)}</p>
                </div>
              </>
            ) : isEmployerWalletView ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-[12px] p-4">
                <p className="text-[12px] opacity-80">Employer Balance</p>
                <p className="text-[20px] font-semibold mt-1">{currency.format(employerBalance)}</p>
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-sm rounded-[12px] p-4">
                <p className="text-[12px] opacity-80">Worker Balance</p>
                <p className="text-[20px] font-semibold mt-1">{currency.format(workerBalance)}</p>
              </div>
            )}
            <div className="bg-white/10 backdrop-blur-sm rounded-[12px] p-4">
              <p className="text-[12px] opacity-80">Pending Withdrawals</p>
              <p className="text-[20px] font-semibold mt-1">{currency.format(pendingPayoutTotal)}</p>
            </div>
            {!isBothRole && (
              <div className="bg-white/10 backdrop-blur-sm rounded-[12px] p-4">
                <p className="text-[12px] opacity-80">Total Transactions</p>
                <p className="text-[20px] font-semibold mt-1">{transactions.length}</p>
              </div>
            )}
          </div>

          {isBothRole ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsTopUpOpen(true)}
                className="w-full md:w-auto bg-white text-[#1C4D8D] font-semibold py-3 px-6 rounded-[12px] hover:bg-gray-100 transition"
              >
                Top Up
              </button>
              <button
                type="button"
                onClick={handleWithdrawClick}
                className="w-full md:w-auto bg-white/20 text-white font-semibold py-3 px-6 rounded-[12px] hover:bg-white/30 transition"
              >
                Withdraw Worker Funds
              </button>
            </div>
          ) : isEmployerWalletView ? (
            <button
              type="button"
              onClick={() => setIsTopUpOpen(true)}
              className="w-full md:w-auto bg-white text-[#1C4D8D] font-semibold py-3 px-6 rounded-[12px] hover:bg-gray-100 transition"
            >
              Top Up
            </button>
          ) : isWorkerWalletView ? (
            <button
              type="button"
              onClick={handleWithdrawClick}
              className="w-full md:w-auto bg-white text-[#1C4D8D] font-semibold py-3 px-6 rounded-[12px] hover:bg-gray-100 transition"
            >
              Withdraw Funds
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[#10B981] mb-2">
            <ArrowDownLeft className="w-4 h-4" />
            <span className="text-[13px]">Credits</span>
          </div>
          <p className="text-[26px] font-bold text-[#111827]">{currency.format(totalCredits)}</p>
        </div>

        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[#EF4444] mb-2">
            <ArrowUpRight className="w-4 h-4" />
            <span className="text-[13px]">Escrow + Payout Debits</span>
          </div>
          <p className="text-[26px] font-bold text-[#111827]">{currency.format(totalDebits)}</p>
        </div>

        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[#1D4ED8] mb-2">
            <Landmark className="w-4 h-4" />
            <span className="text-[13px]">Withdrawals</span>
          </div>
          <p className="text-[26px] font-bold text-[#111827]">{payoutRequests.length}</p>
        </div>
      </div>

      {(isWorkerWalletView || isBothRole) ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] gap-6">
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div>
                <h3 className="text-[20px] font-semibold text-[#111827]">Withdrawal History</h3>
                <p className="text-[13px] text-[#6B7280] mt-1">Track requested, approved, rejected, paid, and cancelled withdrawals.</p>
              </div>
              <div className="text-[12px] text-[#6B7280]">Worker wallet only</div>
            </div>

            {isLoading ? (
              <div className="text-[14px] text-[#6B7280] py-6">Loading withdrawals...</div>
            ) : payoutRequests.length === 0 ? (
              <div className="text-[14px] text-[#6B7280] py-6">No withdrawals yet.</div>
            ) : (
              <div className="space-y-3">
                {payoutRequests.map((request) => (
                  <div key={request._id} className="rounded-[14px] border border-[#E5E7EB] p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-[18px] font-semibold text-[#111827]">{currency.format(toAmount(request.amount))}</p>
                        <p className="text-[13px] text-[#6B7280] mt-1">
                          {request.destinationSnapshot.institutionName} · {request.destinationSnapshot.accountName}
                        </p>
                        <p className="text-[12px] text-[#9CA3AF] mt-1">
                          {request.destinationSnapshot.accountNumberMasked || request.destinationSnapshot.accountNumber || "-"}
                        </p>
                      </div>
                      <span className={`px-3 py-1.5 rounded-full text-[11px] font-semibold ${getPayoutStatusClasses(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-[13px] text-[#6B7280]">
                      <div>
                        <p className="text-[#111827] font-medium">Requested</p>
                        <p>{formatDate(request.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-[#111827] font-medium">Reviewed</p>
                        <p>{formatDate(request.reviewedAt || undefined)}</p>
                      </div>
                      <div>
                        <p className="text-[#111827] font-medium">Paid</p>
                        <p>{formatDate(request.paidAt || undefined)}</p>
                      </div>
                    </div>
                    {request.reviewNotes ? (
                      <div className="mt-4 rounded-[12px] bg-[#F8FAFC] border border-[#E5E7EB] px-4 py-3 text-[13px] text-[#475569]">
                        {request.reviewNotes}
                      </div>
                    ) : null}
                    {request.status === "requested" ? (
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => handleCancelPayout(request._id)}
                          disabled={cancellingPayoutId === request._id}
                          className="px-4 py-2 rounded-[10px] border border-[#FCA5A5] text-[#B91C1C] text-[14px] font-medium hover:bg-[#FEF2F2] disabled:opacity-60"
                        >
                          {cancellingPayoutId === request._id ? "Cancelling..." : "Cancel Withdrawal"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div ref={payoutRequestRef} className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 h-fit">
            <div className="flex items-center gap-3 mb-4">
              <Wallet className="w-5 h-5 text-[#1D4ED8]" />
              <h3 className="text-[20px] font-semibold text-[#111827]">Withdraw Funds</h3>
            </div>
            <p className="text-[13px] text-[#6B7280] mb-6">
              Available to withdraw: {currency.format(workerBalance)}. Withdrawals debit your worker balance immediately and remain pending until reviewed.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-[13px] text-[#374151] mb-2 block">Amount (PHP)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  className="w-full border border-[#D1D5DB] rounded-[10px] px-3 py-2 text-[14px]"
                  value={payoutForm.amount}
                  onChange={(event) => setPayoutForm((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="1000"
                />
              </div>

              <div>
                <label className="text-[13px] text-[#374151] mb-2 block">Method</label>
                <select
                  className="w-full border border-[#D1D5DB] rounded-[10px] px-3 py-2 text-[14px]"
                  value={payoutForm.methodType}
                  onChange={(event) => setPayoutForm((current) => ({ ...current, methodType: event.target.value }))}
                >
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="gcash">GCash</option>
                  <option value="maya">Maya</option>
                </select>
              </div>

              <div>
                <label className="text-[13px] text-[#374151] mb-2 block">Institution</label>
                <input
                  type="text"
                  className="w-full border border-[#D1D5DB] rounded-[10px] px-3 py-2 text-[14px]"
                  value={payoutForm.institutionName}
                  onChange={(event) => setPayoutForm((current) => ({ ...current, institutionName: event.target.value }))}
                  placeholder="BDO, GCash, Maya"
                />
              </div>

              <div>
                <label className="text-[13px] text-[#374151] mb-2 block">Account Name</label>
                <input
                  type="text"
                  className="w-full border border-[#D1D5DB] rounded-[10px] px-3 py-2 text-[14px]"
                  value={payoutForm.accountName}
                  onChange={(event) => setPayoutForm((current) => ({ ...current, accountName: event.target.value }))}
                  placeholder="Juan Dela Cruz"
                />
              </div>

              <div>
                <label className="text-[13px] text-[#374151] mb-2 block">Account Number</label>
                <input
                  type="text"
                  className="w-full border border-[#D1D5DB] rounded-[10px] px-3 py-2 text-[14px]"
                  value={payoutForm.accountNumber}
                  onChange={(event) => setPayoutForm((current) => ({ ...current, accountNumber: event.target.value }))}
                  placeholder="09171234567 or bank account number"
                />
              </div>

              <button
                type="button"
                className="w-full px-4 py-3 rounded-[10px] bg-[#1D4ED8] text-white text-[14px] font-medium disabled:opacity-60"
                onClick={handlePayoutSubmit}
                disabled={isSubmittingPayout}
              >
                {isSubmittingPayout ? "Submitting withdrawal..." : "Withdraw Funds"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <h3 className="text-[20px] font-semibold text-[#111827]">
            {isEmployerWalletView ? "Payment History" : "Recent Transactions"}
          </h3>
          <div className="text-[12px] text-[#6B7280]">Linked transaction status and payout references included</div>
        </div>

        {isLoading ? (
          <div className="text-[14px] text-[#6B7280] py-6">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="text-[14px] text-[#6B7280] py-6">No transactions yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[#6B7280] border-b border-[#E5E7EB]">
                  <th className="py-3 pr-4 font-medium">Type</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Label</th>
                  <th className="py-3 pr-4 font-medium">Amount</th>
                  <th className="py-3 pr-4 font-medium">Reference</th>
                  <th className="py-3 pr-4 font-medium">Linked Entity</th>
                  <th className="py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 20).map((tx) => (
                  <tr key={tx._id} className="border-b border-[#F3F4F6] align-top">
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-[#EEF2FF] text-[#3730A3]">
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${getTransactionStatusClasses(tx.status)}`}>
                        {tx.status || "-"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-[#111827]">{txLabel(tx)}</td>
                    <td className="py-3 pr-4 text-[#111827]">{currency.format(toAmount(tx.amount))}</td>
                    <td className="py-3 pr-4 text-[#6B7280]">
                      <div>{tx.reference || "-"}</div>
                      {tx.providerReference ? <div className="text-[11px] text-[#9CA3AF]">{tx.providerReference}</div> : null}
                    </td>
                    <td className="py-3 pr-4 text-[#6B7280]">
                      {tx.relatedEntityType || tx.balanceTarget || "-"}
                    </td>
                    <td className="py-3 text-[#6B7280]">{formatDate(tx.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(isEmployerWalletView || isBothRole) && isTopUpOpen ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-[16px] p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-[#1D4ED8]" />
              <h4 className="text-[18px] font-semibold text-[#111827]">Top Up</h4>
            </div>

            <label className="text-[13px] text-[#374151] mb-2 block">Amount (PHP)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              className="w-full border border-[#D1D5DB] rounded-[10px] px-3 py-2 text-[14px] mb-4"
              value={topUpAmount}
              onChange={(event) => setTopUpAmount(event.target.value)}
              placeholder="1000"
            />
            <p className="text-[13px] text-[#6B7280] mb-6">
              Employer funding is the only top-up flow here. Worker accounts withdraw from earned balance instead.
            </p>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                className="px-4 py-2 rounded-[10px] border border-[#D1D5DB] text-[14px]"
                onClick={() => {
                  if (isCreatingTopUp) return;
                  setIsTopUpOpen(false);
                  setTopUpAmount("");
                }}
                disabled={isCreatingTopUp}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-[10px] bg-[#1D4ED8] text-white text-[14px] font-medium disabled:opacity-60"
                onClick={handleTopUpSubmit}
                disabled={isCreatingTopUp}
              >
                {isCreatingTopUp ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Redirecting...
                  </span>
                ) : (
                  "Proceed to Checkout"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
