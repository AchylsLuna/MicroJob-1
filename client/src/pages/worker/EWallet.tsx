import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CreditCard, Loader2, Wallet } from "lucide-react";
import { toast } from "../../lib/toast";
import { useAuth } from "../../hooks/useAuth";
import {
  createTopUpSession,
  getPaymentTransactions,
  getProfile,
  type PaymentTarget,
  type PaymentTransaction,
} from "../../services/api";

const currency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

const toAmount = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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

export function EWallet() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingTopUp, setIsCreatingTopUp] = useState(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [target, setTarget] = useState<PaymentTarget>("WORKER");
  const [employerBalance, setEmployerBalance] = useState(0);
  const [workerBalance, setWorkerBalance] = useState(0);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);

  const accountType = user?.accountType || "worker";
  const accountOptions = user?.accountOptions || ["worker"];

  useEffect(() => {
    if (accountType === "employer") {
      setTarget("EMPLOYER");
      return;
    }

    if (accountOptions.includes("employer") && accountOptions.includes("worker")) {
      setTarget("BOTH");
      return;
    }

    setTarget("WORKER");
  }, [accountOptions, accountType]);

  const loadWallet = async (skipLoader = false) => {
    if (!skipLoader) setIsLoading(true);
    try {
      const [profileResponse, txResponse] = await Promise.all([
        getProfile(),
        getPaymentTransactions().catch(() => ({ transactions: [] as PaymentTransaction[] })),
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
    } catch (error: any) {
      console.error("Wallet load error:", error);
      // Only show error if it's not a 304 (not modified) response
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

    // Refresh balance every 5 seconds to catch top-up confirmations
    const pollInterval = setInterval(() => {
      if (isActive) {
        loadWallet(true); // skip loader to avoid flickering
      }
    }, 5000);

    return () => {
      isActive = false;
      clearInterval(pollInterval);
    };
  }, []);

  const activeBalance = accountType === "employer" ? employerBalance : workerBalance;

  const totalCredits = useMemo(
    () => transactions.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + toAmount(tx.amount), 0),
    [transactions],
  );

  const totalDebits = useMemo(
    () =>
      transactions
        .filter((tx) => tx.type === "ESCROW")
        .reduce((sum, tx) => sum + toAmount(tx.amount), 0),
    [transactions],
  );

  const handleTopUpSubmit = async () => {
    const amount = Number(topUpAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    setIsCreatingTopUp(true);
    try {
      const response = await createTopUpSession({ amount, target });
      if (!response?.checkoutUrl) {
        throw new Error("Payment checkout URL was not returned.");
      }

      // Store checkout ID for confirmation after PayMongo redirects back
      if (response?.checkoutId) {
        sessionStorage.setItem('topup_checkout_id', response.checkoutId);
      }

      window.location.assign(response.checkoutUrl);
    } catch (error: any) {
      toast.error(error?.message || "Failed to initialize top-up.");
      setIsCreatingTopUp(false);
    }
  };

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      <div className="bg-gradient-to-br from-[#0F2954] via-[#1C4D8D] to-[#4988C4] rounded-[20px] p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24" />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="text-[14px] opacity-80 mb-2">Current Balance ({accountType})</p>
              <h2 className="text-[42px] font-bold tracking-tight">
                {isLoading ? "Loading..." : currency.format(activeBalance)}
              </h2>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-[16px] p-4">
              <CreditCard className="w-8 h-8" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-[12px] p-4">
              <p className="text-[12px] opacity-80">Employer Balance</p>
              <p className="text-[20px] font-semibold mt-1">{currency.format(employerBalance)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-[12px] p-4">
              <p className="text-[12px] opacity-80">Worker Balance</p>
              <p className="text-[20px] font-semibold mt-1">{currency.format(workerBalance)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-[12px] p-4">
              <p className="text-[12px] opacity-80">Total Transactions</p>
              <p className="text-[20px] font-semibold mt-1">{transactions.length}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsTopUpOpen(true)}
            className="w-full md:w-auto bg-white text-[#1C4D8D] font-semibold py-3 px-6 rounded-[12px] hover:bg-gray-100 transition"
          >
            Top Up Wallet
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <span className="text-[13px]">Escrow Debits</span>
          </div>
          <p className="text-[26px] font-bold text-[#111827]">{currency.format(totalDebits)}</p>
        </div>
      </div>

      <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[20px] font-semibold text-[#111827]">Recent Transactions</h3>
          <div className="text-[12px] text-[#6B7280]">Synced with backend</div>
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
                  <th className="py-3 pr-4 font-medium">Label</th>
                  <th className="py-3 pr-4 font-medium">Amount</th>
                  <th className="py-3 pr-4 font-medium">Reference</th>
                  <th className="py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 20).map((tx) => (
                  <tr key={tx._id} className="border-b border-[#F3F4F6]">
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-[#EEF2FF] text-[#3730A3]">
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-[#111827]">{txLabel(tx)}</td>
                    <td className="py-3 pr-4 text-[#111827]">{currency.format(toAmount(tx.amount))}</td>
                    <td className="py-3 pr-4 text-[#6B7280]">{tx.reference || "-"}</td>
                    <td className="py-3 text-[#6B7280]">{formatDate(tx.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isTopUpOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-[16px] p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-[#1D4ED8]" />
              <h4 className="text-[18px] font-semibold text-[#111827]">Top Up Wallet</h4>
            </div>

            <label className="text-[13px] text-[#374151] mb-2 block">Amount (₱)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              className="w-full border border-[#D1D5DB] rounded-[10px] px-3 py-2 text-[14px] mb-4"
              value={topUpAmount}
              onChange={(event) => setTopUpAmount(event.target.value)}
              placeholder="1000"
            />

            <label className="text-[13px] text-[#374151] mb-2 block">Top-up Target</label>
            <select
              className="w-full border border-[#D1D5DB] rounded-[10px] px-3 py-2 text-[14px] mb-6"
              value={target}
              onChange={(event) => setTarget(event.target.value as PaymentTarget)}
            >
              {accountOptions.includes("worker") ? (
                <option value="WORKER">Worker Wallet</option>
              ) : null}
              {accountOptions.includes("employer") ? (
                <option value="EMPLOYER">Employer Wallet</option>
              ) : null}
              {accountOptions.includes("worker") && accountOptions.includes("employer") ? (
                <option value="BOTH">Both Wallets</option>
              ) : null}
            </select>

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
      )}
    </div>
  );
}
