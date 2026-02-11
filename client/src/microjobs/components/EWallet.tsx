import { ArrowUpRight, ArrowDownLeft, CreditCard, TrendingUp, DollarSign, Send, Download, ChevronRight, X } from "lucide-react";
import { toast } from "../lib/toast";
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

  const jobPayments = transactions.filter((transaction) => transaction.category === "Job Payment");

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

      {/* Job Payment History */}
      <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[20px] font-semibold text-[#111827]">Job Payment History</h3>
          <span className="text-[12px] text-[#6B7280] bg-[#F3F4F6] px-3 py-1 rounded-full">
            {jobPayments.length} payments
          </span>
        </div>
        <div className="space-y-3">
          {jobPayments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center justify-between p-4 border border-[#E5E7EB] rounded-[12px]"
            >
              <div>
                <p className="text-[14px] font-semibold text-[#111827]">{payment.description}</p>
                <p className="text-[12px] text-[#6B7280]">{payment.date}</p>
              </div>
              <div className="text-right">
                <p className="text-[14px] font-semibold text-[#10B981]">
                  +₱{payment.amount.toLocaleString()}
                </p>
                <span className="text-[11px] font-semibold px-2 py-1 rounded-full text-[#10B981] bg-[#D1FAE5]">
                  {payment.status === "completed" ? "Completed" : "Pending"}
                </span>
              </div>
            </div>
          ))}
          {jobPayments.length === 0 && (
            <div className="text-[14px] text-[#6B7280]">No job payments yet.</div>
          )}
        </div>
      </div>

      {/* Xendit Test Payment */}
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
