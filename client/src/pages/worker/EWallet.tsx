import { ArrowUpRight, ArrowDownLeft, CreditCard, TrendingUp, DollarSign, Send, Download, ChevronRight } from "lucide-react";
import { toast } from "../../lib/toast";
import { useState } from "react";

interface Transaction {
  id: string;
  type: "credit" | "debit";
  description: string;
  amount: number;
  date: string;
  status: "completed" | "pending";
  category: string;
}

const transactions: Transaction[] = [
  {
    id: "1",
    type: "credit",
    description: "Payment received from Tech Solutions Inc.",
    amount: 25000,
    date: "Feb 1, 2026",
    status: "completed",
    category: "Job Payment"
  },
  {
    id: "2",
    type: "debit",
    description: "Withdrawal to Bank Account",
    amount: 10000,
    date: "Jan 30, 2026",
    status: "completed",
    category: "Withdrawal"
  },
  {
    id: "3",
    type: "credit",
    description: "Payment received from Innovation Labs",
    amount: 18000,
    date: "Jan 28, 2026",
    status: "completed",
    category: "Job Payment"
  },
  {
    id: "4",
    type: "debit",
    description: "Platform Fee",
    amount: 500,
    date: "Jan 28, 2026",
    status: "completed",
    category: "Fee"
  },
  {
    id: "5",
    type: "credit",
    description: "Bonus Payment",
    amount: 5000,
    date: "Jan 25, 2026",
    status: "completed",
    category: "Bonus"
  },
  {
    id: "6",
    type: "credit",
    description: "Payment received from Digital Ventures",
    amount: 32000,
    date: "Jan 22, 2026",
    status: "completed",
    category: "Job Payment"
  },
  {
    id: "7",
    type: "debit",
    description: "Subscription Fee",
    amount: 299,
    date: "Jan 20, 2026",
    status: "completed",
    category: "Subscription"
  },
  {
    id: "8",
    type: "credit",
    description: "Referral Bonus",
    amount: 2000,
    date: "Jan 18, 2026",
    status: "pending",
    category: "Bonus"
  },
];

export function EWallet() {
  const totalBalance = 71201;
  const totalIncome = 82000;
  const totalExpenses = 10799;

  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isSendMoneyOpen, setIsSendMoneyOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [xenditAmount, setXenditAmount] = useState("");
  const [xenditEmail, setXenditEmail] = useState("");
  const [xenditName, setXenditName] = useState("");
  const [xenditMethod, setXenditMethod] = useState("GCash");
  const [walletTab, setWalletTab] = useState<"overview" | "history">("overview");

  const paymentCategories = [
    "All",
    ...Array.from(new Set(transactions.map((transaction) => transaction.category))),
  ];
  const [paymentCategory, setPaymentCategory] = useState(paymentCategories[0]);
  const [paymentPage, setPaymentPage] = useState(1);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const paymentPageSize = 4;

  const filteredPayments =
    paymentCategory === "All"
      ? transactions
      : transactions.filter((transaction) => transaction.category === paymentCategory);

  const paymentPageCount = Math.max(1, Math.ceil(filteredPayments.length / paymentPageSize));
  const paymentPageSafe = Math.min(paymentPage, paymentPageCount);
  const pagedPayments = filteredPayments.slice(
    (paymentPageSafe - 1) * paymentPageSize,
    paymentPageSafe * paymentPageSize
  );

  const selectedPayment =
    filteredPayments.find((transaction) => transaction.id === selectedPaymentId) ||
    pagedPayments[0] ||
    null;

  const handleTopUp = () => {
    setIsTopUpOpen(true);
  };

  const handleWithdraw = () => {
    setIsWithdrawOpen(true);
  };

  const handleSendMoney = () => {
    setIsSendMoneyOpen(true);
  };

  const handleTopUpSubmit = () => {
    if (!topUpAmount || Number(topUpAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    toast.success(`Successfully topped up ₱${Number(topUpAmount).toLocaleString()}`);
    setIsTopUpOpen(false);
    setTopUpAmount("");
  };

  const handleWithdrawSubmit = () => {
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (Number(withdrawAmount) > totalBalance) {
      toast.error("Insufficient balance");
      return;
    }
    toast.success(`Withdrawal of ₱${Number(withdrawAmount).toLocaleString()} initiated`);
    setIsWithdrawOpen(false);
    setWithdrawAmount("");
  };

  const handleSendMoneySubmit = () => {
    if (!sendAmount || Number(sendAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!recipientEmail) {
      toast.error("Please enter recipient email");
      return;
    }
    if (Number(sendAmount) > totalBalance) {
      toast.error("Insufficient balance");
      return;
    }
    toast.success(`Successfully sent ₱${Number(sendAmount).toLocaleString()} to ${recipientEmail}`);
    setIsSendMoneyOpen(false);
    setSendAmount("");
    setRecipientEmail("");
  };

  const handleViewAllTransactions = () => {
    toast.info("Loading all transactions...");
  };

  const handleTransactionClick = (transaction: Transaction) => {
    toast.info(`Transaction: ${transaction.description}`);
  };

  const handlePaymentClick = (transaction: Transaction) => {
    setSelectedPaymentId(transaction.id);
  };

  const handleXenditTestPayment = () => {
    if (!xenditAmount || Number(xenditAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!xenditEmail) {
      toast.error("Please enter a customer email");
      return;
    }
    if (!xenditName) {
      toast.error("Please enter a customer name");
      return;
    }
    toast.success(`Xendit test payment created for ${xenditName} via ${xenditMethod}`);
    setXenditAmount("");
    setXenditEmail("");
    setXenditName("");
    setXenditMethod("GCash");
  };

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      {/* E-Wallet Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setWalletTab("overview")}
          className={`px-4 py-2 rounded-full text-[12px] font-semibold transition ${
            walletTab === "overview"
              ? "bg-[#1C4D8D] text-white"
              : "bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]"
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setWalletTab("history")}
          className={`px-4 py-2 rounded-full text-[12px] font-semibold transition ${
            walletTab === "history"
              ? "bg-[#1C4D8D] text-white"
              : "bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]"
          }`}
        >
          Payment History
        </button>
      </div>

      {walletTab === "overview" && (
        <>
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-[#0F2954] via-[#1C4D8D] to-[#4988C4] rounded-[20px] p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24"></div>
        
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="text-[14px] opacity-80 mb-2">Total Balance</p>
              <h2 className="text-[42px] font-bold tracking-tight">₱{totalBalance.toLocaleString()}</h2>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-[16px] p-4">
              <CreditCard className="w-8 h-8" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-[12px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownLeft className="w-4 h-4" />
                <p className="text-[13px] opacity-80">Total Income</p>
              </div>
              <p className="text-[24px] font-bold">₱{totalIncome.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-[12px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpRight className="w-4 h-4" />
                <p className="text-[13px] opacity-80">Total Expenses</p>
              </div>
              <p className="text-[24px] font-bold">₱{totalExpenses.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleTopUp}
              className="flex-1 bg-white text-[#1C4D8D] font-semibold py-3 px-6 rounded-[12px] hover:bg-gray-100 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <ChevronRight className="w-5 h-5" />
              Top Up
            </button>
            <button
              onClick={handleWithdraw}
              className="flex-1 bg-white/20 backdrop-blur-sm text-white font-semibold py-3 px-6 rounded-[12px] hover:bg-white/30 transition-all duration-300 flex items-center justify-center gap-2 border border-white/40"
            >
              <Download className="w-5 h-5" />
              Withdraw
            </button>
            <button
              onClick={handleSendMoney}
              className="flex-1 bg-white/20 backdrop-blur-sm text-white font-semibold py-3 px-6 rounded-[12px] hover:bg-white/30 transition-all duration-300 flex items-center justify-center gap-2 border border-white/40"
            >
              <Send className="w-5 h-5" />
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-[12px] bg-gradient-to-br from-[#D1FAE5] to-[#A7F3D0] flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-[#10B981]" />
            </div>
            <div className="flex items-center gap-1 text-[12px] text-[#10B981] bg-[#D1FAE5] px-2 py-1 rounded-full font-semibold">
              <ArrowUpRight className="w-3 h-3" />
              +24%
            </div>
          </div>
          <p className="text-[13px] text-[#6B7280] mb-1">This Month Income</p>
          <p className="text-[28px] font-bold text-[#111827]">₱43,000</p>
        </div>

        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-[12px] bg-gradient-to-br from-[#DBEAFE] to-[#BFDBFE] flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-[#3B82F6]" />
            </div>
            <div className="flex items-center gap-1 text-[12px] text-[#3B82F6] bg-[#DBEAFE] px-2 py-1 rounded-full font-semibold">
              8 Jobs
            </div>
          </div>
          <p className="text-[13px] text-[#6B7280] mb-1">Pending Payments</p>
          <p className="text-[28px] font-bold text-[#111827]">₱18,500</p>
        </div>

        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-[12px] bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-[#F59E0B]" />
            </div>
            <div className="flex items-center gap-1 text-[12px] text-[#6B7280] bg-[#F3F4F6] px-2 py-1 rounded-full font-semibold">
              12 Total
            </div>
          </div>
          <p className="text-[13px] text-[#6B7280] mb-1">Completed Jobs</p>
          <p className="text-[28px] font-bold text-[#111827]">₱82,000</p>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[20px] font-semibold text-[#111827]">Recent Transactions</h3>
          <button
            onClick={handleViewAllTransactions}
            className="text-[14px] text-[#1C4D8D] hover:text-[#0F2954] font-medium flex items-center gap-1"
          >
            View All
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              onClick={() => handleTransactionClick(transaction)}
              className="flex items-center justify-between p-4 hover:bg-[#F9FAFB] rounded-[12px] transition-colors cursor-pointer border border-transparent hover:border-[#E5E7EB]"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-[12px] flex items-center justify-center ${
                    transaction.type === "credit"
                      ? "bg-gradient-to-br from-[#D1FAE5] to-[#A7F3D0]"
                      : "bg-gradient-to-br from-[#FEE2E2] to-[#FECACA]"
                  }`}
                >
                  {transaction.type === "credit" ? (
                    <ArrowDownLeft className="w-6 h-6 text-[#10B981]" />
                  ) : (
                    <ArrowUpRight className="w-6 h-6 text-[#EF4444]" />
                  )}
                </div>
                <div>
                  <h4 className="text-[14px] font-semibold text-[#111827] mb-1">
                    {transaction.description}
                  </h4>
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] text-[#6B7280]">{transaction.date}</p>
                    <span className="text-[12px] text-[#9CA3AF]">•</span>
                    <span className="text-[11px] text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded-full">
                      {transaction.category}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p
                  className={`text-[16px] font-bold ${
                    transaction.type === "credit" ? "text-[#10B981]" : "text-[#EF4444]"
                  }`}
                >
                  {transaction.type === "credit" ? "+" : "-"}₱{transaction.amount.toLocaleString()}
                </p>
                <span
                  className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                    transaction.status === "completed"
                      ? "text-[#10B981] bg-[#D1FAE5]"
                      : "text-[#F59E0B] bg-[#FEF3C7]"
                  }`}
                >
                  {transaction.status === "completed" ? "Completed" : "Pending"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      </>
      )}

      {/* Payment History */}
      {walletTab === "history" && (
      <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[20px] font-semibold text-[#111827]">Payment History</h3>
          <span className="text-[12px] text-[#6B7280] bg-[#F3F4F6] px-3 py-1 rounded-full">
            {filteredPayments.length} records
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {paymentCategories.map((category) => (
            <button
              key={category}
              onClick={() => {
                setPaymentCategory(category);
                setPaymentPage(1);
                setSelectedPaymentId(null);
              }}
              className={`px-4 py-2 rounded-full text-[12px] font-semibold transition ${
                paymentCategory === category
                  ? "bg-[#1C4D8D] text-white"
                  : "bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr] gap-6">
          <div className="space-y-3">
            {pagedPayments.map((payment) => (
              <button
                key={payment.id}
                type="button"
                onClick={() => handlePaymentClick(payment)}
                className={`w-full text-left flex items-center justify-between p-4 rounded-[12px] border transition-colors ${
                  selectedPaymentId === payment.id
                    ? "border-[#1C4D8D] bg-[#F5F9FF]"
                    : "border-[#E5E7EB] hover:bg-[#F9FAFB]"
                }`}
              >
                <div>
                  <p className="text-[14px] font-semibold text-[#111827]">{payment.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[12px] text-[#6B7280]">{payment.date}</p>
                    <span className="text-[12px] text-[#9CA3AF]">•</span>
                    <span className="text-[11px] text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded-full">
                      {payment.category}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-[14px] font-semibold ${
                      payment.type === "credit" ? "text-[#10B981]" : "text-[#EF4444]"
                    }`}
                  >
                    {payment.type === "credit" ? "+" : "-"}₱{payment.amount.toLocaleString()}
                  </p>
                  <span
                    className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                      payment.status === "completed"
                        ? "text-[#10B981] bg-[#D1FAE5]"
                        : "text-[#F59E0B] bg-[#FEF3C7]"
                    }`}
                  >
                    {payment.status === "completed" ? "Completed" : "Pending"}
                  </span>
                </div>
              </button>
            ))}
            {pagedPayments.length === 0 && (
              <div className="text-[14px] text-[#6B7280]">No payments found for this category.</div>
            )}

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setPaymentPage((prev) => Math.max(1, prev - 1))}
                className={`px-3 py-2 text-[12px] font-semibold rounded-[10px] border ${
                  paymentPageSafe === 1
                    ? "border-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"
                    : "border-[#1C4D8D] text-[#1C4D8D] hover:bg-[#F5F9FF]"
                }`}
                disabled={paymentPageSafe === 1}
              >
                Previous
              </button>
              <p className="text-[12px] text-[#6B7280]">
                Page {paymentPageSafe} of {paymentPageCount}
              </p>
              <button
                type="button"
                onClick={() => setPaymentPage((prev) => Math.min(paymentPageCount, prev + 1))}
                className={`px-3 py-2 text-[12px] font-semibold rounded-[10px] border ${
                  paymentPageSafe === paymentPageCount
                    ? "border-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"
                    : "border-[#1C4D8D] text-[#1C4D8D] hover:bg-[#F5F9FF]"
                }`}
                disabled={paymentPageSafe === paymentPageCount}
              >
                Next
              </button>
            </div>
          </div>

          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[16px] p-5">
            <h4 className="text-[16px] font-semibold text-[#111827] mb-4">Payment Details</h4>
            {selectedPayment ? (
              <div className="space-y-3">
                <div>
                  <p className="text-[12px] text-[#6B7280]">Description</p>
                  <p className="text-[14px] font-semibold text-[#111827]">{selectedPayment.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[12px] text-[#6B7280]">Type</p>
                    <p className="text-[14px] font-semibold text-[#111827]">
                      {selectedPayment.type === "credit" ? "Credit" : "Debit"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[12px] text-[#6B7280]">Status</p>
                    <p className="text-[14px] font-semibold text-[#111827]">
                      {selectedPayment.status === "completed" ? "Completed" : "Pending"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[12px] text-[#6B7280]">Category</p>
                    <p className="text-[14px] font-semibold text-[#111827]">{selectedPayment.category}</p>
                  </div>
                  <div>
                    <p className="text-[12px] text-[#6B7280]">Date</p>
                    <p className="text-[14px] font-semibold text-[#111827]">{selectedPayment.date}</p>
                  </div>
                </div>
                <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[12px] text-[#6B7280]">Amount</p>
                    <p
                      className={`text-[18px] font-bold ${
                        selectedPayment.type === "credit" ? "text-[#10B981]" : "text-[#EF4444]"
                      }`}
                    >
                      {selectedPayment.type === "credit" ? "+" : "-"}₱{selectedPayment.amount.toLocaleString()}
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-[#EEF2FF] text-[#1C4D8D]">
                    Ref #{selectedPayment.id.padStart(6, "0")}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-[13px] text-[#6B7280]">Select a payment to view details.</div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Xendit Test Payment */}
      {walletTab === "overview" && (
      <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[20px] font-semibold text-[#111827]">Xendit Test Payment</h3>
          <span className="text-[12px] text-[#6B7280] bg-[#F3F4F6] px-3 py-1 rounded-full">
            Sandbox
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[13px] text-[#6B7280]">Customer Name</label>
            <input
              value={xenditName}
              onChange={(e) => setXenditName(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              className="w-full p-3 border border-[#E5E7EB] rounded-[12px] mt-2"
            />
          </div>
          <div>
            <label className="text-[13px] text-[#6B7280]">Customer Email</label>
            <input
              type="email"
              value={xenditEmail}
              onChange={(e) => setXenditEmail(e.target.value)}
              placeholder="e.g. juan@email.com"
              className="w-full p-3 border border-[#E5E7EB] rounded-[12px] mt-2"
            />
          </div>
          <div>
            <label className="text-[13px] text-[#6B7280]">Amount</label>
            <input
              type="number"
              value={xenditAmount}
              onChange={(e) => setXenditAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full p-3 border border-[#E5E7EB] rounded-[12px] mt-2"
            />
          </div>
          <div>
            <label className="text-[13px] text-[#6B7280]">Payment Method</label>
            <select
              value={xenditMethod}
              onChange={(e) => setXenditMethod(e.target.value)}
              className="w-full p-3 border border-[#E5E7EB] rounded-[12px] mt-2"
            >
              <option>GCash</option>
              <option>Credit/Debit Card</option>
              <option>PayMaya</option>
              <option>Bank Transfer</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleXenditTestPayment}
          className="bg-[#1C4D8D] text-white font-semibold py-3 px-6 rounded-[12px] hover:bg-[#0F2954] transition-all duration-300"
        >
          Create Test Payment
        </button>
      </div>
      )}

      {/* Top Up Modal */}
      {isTopUpOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-[16px] p-8 shadow-xl w-[300px]">
            <h2 className="text-[20px] font-semibold text-[#111827] mb-4">Top Up</h2>
            <input
              type="number"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full p-3 border border-[#E5E7EB] rounded-[12px] mb-4"
            />
            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsTopUpOpen(false)}
                className="text-[14px] text-[#6B7280] hover:text-[#1C4D8D] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleTopUpSubmit}
                className="bg-[#1C4D8D] text-white font-semibold py-3 px-6 rounded-[12px] hover:bg-[#0F2954] transition-all duration-300"
              >
                Top Up
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {isWithdrawOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-[16px] p-8 shadow-xl w-[300px]">
            <h2 className="text-[20px] font-semibold text-[#111827] mb-4">Withdraw</h2>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full p-3 border border-[#E5E7EB] rounded-[12px] mb-4"
            />
            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsWithdrawOpen(false)}
                className="text-[14px] text-[#6B7280] hover:text-[#1C4D8D] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdrawSubmit}
                className="bg-[#1C4D8D] text-white font-semibold py-3 px-6 rounded-[12px] hover:bg-[#0F2954] transition-all duration-300"
              >
                Withdraw
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Money Modal */}
      {isSendMoneyOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-[16px] p-8 shadow-xl w-[300px]">
            <h2 className="text-[20px] font-semibold text-[#111827] mb-4">Send Money</h2>
            <input
              type="number"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full p-3 border border-[#E5E7EB] rounded-[12px] mb-4"
            />
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="Enter recipient email"
              className="w-full p-3 border border-[#E5E7EB] rounded-[12px] mb-4"
            />
            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsSendMoneyOpen(false)}
                className="text-[14px] text-[#6B7280] hover:text-[#1C4D8D] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSendMoneySubmit}
                className="bg-[#1C4D8D] text-white font-semibold py-3 px-6 rounded-[12px] hover:bg-[#0F2954] transition-all duration-300"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
