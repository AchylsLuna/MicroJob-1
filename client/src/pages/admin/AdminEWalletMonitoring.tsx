import { useState, useMemo } from "react";
import { DollarSign, Wallet, X, Search, Receipt, ArrowRightLeft } from "lucide-react";
import { AdminGate } from "./admin/AdminGate";
import { useAdminData } from "../../hooks/useAdminData";
import type { PaymentTransaction } from "../../services/api";

// ── Receipt Modal ──────────────────────────────────────────────────────────────
const TX_TYPE_STYLES: Record<string, string> = {
  TOP_UP:  "bg-[#1C4D8D]/10 text-[#1C4D8D]",
  ESCROW:  "bg-[#FEF3C7] text-[#B45309]",
  PAYOUT:  "bg-[#D1FAE5] text-[#047857]",
  REFUND:  "bg-[#E9D5FF] text-[#7C3AED]",
};

const TX_STATUS_STYLES: Record<string, string> = {
  COMPLETED:  "bg-[#D1FAE5] text-[#065F46]",
  PENDING:    "bg-[#FEF9C3] text-[#854D0E]",
  FAILED:     "bg-[#FEE2E2] text-[#991B1B]",
  CANCELLED:  "bg-[#E5E7EB] text-[#374151]",
};

function userLabel(u: any) {
  if (!u || typeof u !== "object") return "—";
  const name = `${u.firstName || ""} ${u.lastName || ""}`.trim();
  return name || u.email || u._id || "—";
}

function ReceiptModal({ tx, onClose }: { tx: PaymentTransaction; onClose: () => void }) {
  const payout = tx.payoutRequest && typeof tx.payoutRequest === "object" ? tx.payoutRequest : null;
  const dest = (payout as any)?.destinationSnapshot ?? null;
  const linked = tx.linkedTransaction && typeof tx.linkedTransaction === "object" ? tx.linkedTransaction : null;
  const job = tx.jobReference && typeof tx.jobReference === "object" ? tx.jobReference as any : null;

  const Field = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wide">{label}</span>
      <span className="text-[13px] text-[#111827] break-all">{value || "—"}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-[#F0FDF4] flex items-center justify-center">
              <Receipt className="w-5 h-5 text-[#047857]" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#111827]">Transaction Receipt</h3>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "—"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#F3F4F6] transition-colors"
          >
            <X className="w-4 h-4 text-[#6B7280]" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Type & Status */}
          <div className="flex gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${TX_TYPE_STYLES[tx.type] || "bg-[#F3F4F6] text-[#374151]"}`}>
              {tx.type}
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${TX_STATUS_STYLES[tx.status || ""] || "bg-[#F3F4F6] text-[#374151]"}`}>
              {tx.status || "—"}
            </span>
            {tx.balanceTarget && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F3F4F6] text-[#374151]">
                {tx.balanceTarget}
              </span>
            )}
          </div>

          {/* Amount */}
          <div className="bg-[#F9FAFB] rounded-[12px] p-4 text-center">
            <p className="text-[11px] text-[#9CA3AF] mb-1">Amount</p>
            <p className="text-[28px] font-bold text-[#111827]">
              ₱{Number(tx.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* References */}
          <div className="grid grid-cols-1 gap-3">
            <Field label="Transaction ID" value={tx._id} />
            {tx.reference && <Field label="Reference No." value={tx.reference} />}
            {tx.provider && <Field label="Provider" value={tx.provider} />}
            {tx.providerReference && <Field label="Provider Reference" value={tx.providerReference} />}
            {tx.label && <Field label="Label" value={tx.label} />}
          </div>

          {/* Sender / Receiver */}
          <div className="grid grid-cols-2 gap-4 border-t border-[#F3F4F6] pt-4">
            <div>
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">Paid By (Sender)</p>
              {tx.sender && typeof tx.sender === "object" ? (
                <div className="space-y-1">
                  <p className="text-[13px] font-medium text-[#111827]">{userLabel(tx.sender)}</p>
                  <p className="text-[11px] text-[#6B7280]">{(tx.sender as any).email || ""}</p>
                  <p className="text-[11px] text-[#9CA3AF] capitalize">{(tx.sender as any).role || ""}</p>
                </div>
              ) : job && (job as any).jobPoster && typeof (job as any).jobPoster === "object" ? (
                <div className="space-y-1">
                  <p className="text-[13px] font-medium text-[#111827]">{userLabel((job as any).jobPoster)}</p>
                  <p className="text-[11px] text-[#6B7280]">{(job as any).jobPoster.email || ""}</p>
                  <p className="text-[11px] text-[#9CA3AF]">Employer · via escrow</p>
                </div>
              ) : (
                <p className="text-[13px] text-[#9CA3AF]">Escrow / System</p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">Receiver</p>
              {tx.receiver && typeof tx.receiver === "object" ? (
                <div className="space-y-1">
                  <p className="text-[13px] font-medium text-[#111827]">{userLabel(tx.receiver)}</p>
                  <p className="text-[11px] text-[#6B7280]">{(tx.receiver as any).email || ""}</p>
                  <p className="text-[11px] text-[#9CA3AF] capitalize">{(tx.receiver as any).role || ""}</p>
                </div>
              ) : (
                <p className="text-[13px] text-[#9CA3AF]">System / External</p>
              )}
            </div>
          </div>

          {/* Payment Destination (from payout request) */}
          {dest && (
            <div className="border border-[#E5E7EB] rounded-[12px] p-4 space-y-3 bg-[#FAFAFA]">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Payment Destination</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Method / Channel" value={dest.methodType} />
                <Field label="Institution" value={dest.institutionName} />
                <Field label="Account Name" value={dest.accountName} />
                <Field label="Account No." value={dest.accountNumberMasked || dest.accountNumber} />
              </div>
            </div>
          )}

          {/* Job Reference */}
          {job && (
            <div className="border-t border-[#F3F4F6] pt-4 space-y-2">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Job Reference</p>
              <Field label="Title" value={job.title} />
              <Field label="Status" value={job.status} />
            </div>
          )}

          {/* Linked Transaction */}
          {linked && (
            <div className="border-t border-[#F3F4F6] pt-4 space-y-2">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Linked Transaction</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type" value={(linked as any).type} />
                <Field label="Status" value={(linked as any).status} />
                <Field label="Amount" value={(linked as any).amount != null ? `₱${Number((linked as any).amount).toLocaleString()}` : "—"} />
                <Field label="Reference" value={(linked as any).reference} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Content ───────────────────────────────────────────────────────────────
function AdminEWalletMonitoringContent() {
  const { isLoading, loadError, walletStats, transactions, formatCurrency } = useAdminData();

  const [activeTab, setActiveTab] = useState<"payouts" | "logs">("payouts");
  const [selectedTx, setSelectedTx] = useState<PaymentTransaction | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Completed payouts = all PAYOUT-type transactions (auto-pay + manual withdrawals)
  const completedPayouts = useMemo(
    () => transactions.filter((tx) => tx.type === "PAYOUT"),
    [transactions]
  );

  const filteredTxs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (typeFilter !== "ALL" && tx.type !== typeFilter) return false;
      if (statusFilter !== "ALL" && tx.status !== statusFilter) return false;
      if (!q) return true;
      const senderName = userLabel(tx.sender).toLowerCase();
      const receiverName = userLabel(tx.receiver).toLowerCase();
      const senderEmail = (tx.sender as any)?.email?.toLowerCase() || "";
      const receiverEmail = (tx.receiver as any)?.email?.toLowerCase() || "";
      const ref = (tx.reference || "").toLowerCase();
      const label = (tx.label || "").toLowerCase();
      const id = tx._id?.toLowerCase() || "";
      return [senderName, receiverName, senderEmail, receiverEmail, ref, label, id].some((v) => v.includes(q));
    });
  }, [transactions, search, typeFilter, statusFilter]);

  const cards = [
    {
      label: "Completed Payouts",
      value: isLoading ? "—" : walletStats.completedCount,
      icon: <Wallet className="w-6 h-6 text-[#0F766E]" />,
      accent: "from-[#CCFBF1] to-[#99F6E4]",
    },
    {
      label: "Completed Total",
      value: isLoading ? "—" : formatCurrency(walletStats.completedTotal),
      icon: <DollarSign className="w-6 h-6 text-[#047857]" />,
      accent: "from-[#D1FAE5] to-[#A7F3D0]",
    },
  ];

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      {selectedTx && <ReceiptModal tx={selectedTx} onClose={() => setSelectedTx(null)} />}

      {loadError ? (
        <div className="bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] px-4 py-3 rounded-[12px] text-[13px]">
          {loadError}
        </div>
      ) : null}

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-[12px] bg-gradient-to-br ${card.accent} flex items-center justify-center`}>
                {card.icon}
              </div>
            </div>
            <p className="text-[13px] text-[#6B7280] mb-1">{card.label}</p>
            <p className="text-[26px] font-bold text-[#111827] truncate">{card.value}</p>
          </div>
        ))}
      </section>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F3F4F6] rounded-[12px] p-1 w-fit">
        <button
          onClick={() => setActiveTab("payouts")}
          className={`px-4 py-2 rounded-[10px] text-[13px] font-medium transition-colors ${
            activeTab === "payouts"
              ? "bg-white shadow-sm text-[#111827]"
              : "text-[#6B7280] hover:text-[#374151]"
          }`}
        >
          <span className="flex items-center gap-2"><Wallet className="w-4 h-4" />Completed Payouts</span>
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2 rounded-[10px] text-[13px] font-medium transition-colors ${
            activeTab === "logs"
              ? "bg-white shadow-sm text-[#111827]"
              : "text-[#6B7280] hover:text-[#374151]"
          }`}
        >
          <span className="flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" />Transaction Logs</span>
        </button>
      </div>

      {/* ── Tab: Completed Payouts ── */}
      {activeTab === "payouts" && (
        <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
          <div className="mb-6">
            <h3 className="text-[18px] font-semibold text-[#111827]">Completed Payouts</h3>
            <p className="text-[13px] text-[#6B7280] mt-1">
              All payout transactions — includes auto-pay from job completion and manual withdrawal requests.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[#6B7280] border-b border-[#E5E7EB]">
                  <th className="py-3 pr-4 font-medium">From (Sender)</th>
                  <th className="py-3 pr-4 font-medium">To (Receiver)</th>
                  <th className="py-3 pr-4 font-medium">Destination / Channel</th>
                  <th className="py-3 pr-4 font-medium">Amount</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Date</th>
                  <th className="py-3 font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#9CA3AF]">
                      Loading payouts…
                    </td>
                  </tr>
                )}
                {!isLoading && completedPayouts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#9CA3AF]">
                      No payout transactions yet.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  completedPayouts.map((tx) => {
                    const payout = tx.payoutRequest && typeof tx.payoutRequest === "object" ? tx.payoutRequest : null;
                    const dest = (payout as any)?.destinationSnapshot ?? null;
                    const job = tx.jobReference && typeof tx.jobReference === "object" ? tx.jobReference as any : null;
                    return (
                      <tr key={tx._id} className="border-b border-[#F3F4F6] hover:bg-[#FAFAFA] transition-colors align-top">
                        {/* Sender / Payer */}
                        <td className="py-3 pr-4 text-[#111827]">
                          {tx.sender && typeof tx.sender === "object" ? (
                            <>
                              <div className="font-medium">{userLabel(tx.sender)}</div>
                              <div className="text-[11px] text-[#6B7280] mt-0.5">{(tx.sender as any).email || ""}</div>
                            </>
                          ) : job && (job as any).jobPoster && typeof (job as any).jobPoster === "object" ? (
                            <>
                              <div className="font-medium">{userLabel((job as any).jobPoster)}</div>
                              <div className="text-[11px] text-[#6B7280] mt-0.5">{(job as any).jobPoster.email || ""}</div>
                              <div className="text-[11px] text-[#9CA3AF] mt-0.5">via escrow</div>
                            </>
                          ) : (
                            <span className="text-[#9CA3AF]">Escrow (System)</span>
                          )}
                        </td>
                        {/* Receiver */}
                        <td className="py-3 pr-4 text-[#111827]">
                          <div className="font-medium">{userLabel(tx.receiver)}</div>
                          {tx.receiver && typeof tx.receiver === "object" && (
                            <div className="text-[11px] text-[#6B7280] mt-0.5">{(tx.receiver as any).email || ""}</div>
                          )}
                        </td>
                        {/* Destination */}
                        <td className="py-3 pr-4 text-[#6B7280]">
                          {dest ? (
                            <div>
                              <div className="font-medium text-[#374151]">{dest.institutionName}</div>
                              <div className="text-[11px] text-[#9CA3AF] mt-0.5">
                                {dest.methodType} · {dest.accountNumberMasked || dest.accountNumber || "—"}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-[#374151]">Auto-Pay (Escrow)</div>
                              {job && <div className="text-[11px] text-[#9CA3AF] mt-0.5">{job.title}</div>}
                            </div>
                          )}
                        </td>
                        {/* Amount */}
                        <td className="py-3 pr-4 font-semibold text-[#111827]">
                          ₱{Number(tx.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        {/* Status */}
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${TX_STATUS_STYLES[tx.status || ""] || "bg-[#F3F4F6] text-[#374151]"}`}>
                            {tx.status || "—"}
                          </span>
                        </td>
                        {/* Date */}
                        <td className="py-3 pr-4 text-[#6B7280] whitespace-nowrap">
                          {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </td>
                        {/* Receipt */}
                        <td className="py-3">
                          <button
                            onClick={() => setSelectedTx(tx)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-[12px] font-medium bg-[#F0FDF4] text-[#047857] hover:bg-[#DCFCE7] transition-colors"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {!isLoading && completedPayouts.length > 0 && (
            <p className="mt-4 text-[12px] text-[#9CA3AF] text-right">
              {completedPayouts.length} payout transaction{completedPayouts.length !== 1 ? "s" : ""}
            </p>
          )}
        </section>
      )}

      {/* ── Tab: Transaction Logs ── */}
      {activeTab === "logs" && (
        <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-[18px] font-semibold text-[#111827]">Transaction Logs</h3>
              <p className="text-[13px] text-[#6B7280] mt-1">
                All platform transactions — top-ups, escrow, payouts, refunds. Click <strong>View</strong> for the full receipt.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Type filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-[13px] border border-[#E5E7EB] rounded-[8px] px-3 py-2 text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
              >
                <option value="ALL">All Types</option>
                <option value="TOP_UP">Top-Up</option>
                <option value="ESCROW">Escrow</option>
                <option value="PAYOUT">Payout</option>
                <option value="REFUND">Refund</option>
              </select>
              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-[13px] border border-[#E5E7EB] rounded-[8px] px-3 py-2 text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              {/* Search */}
              <div className="flex items-center gap-2 border border-[#E5E7EB] rounded-[8px] px-3 py-2 bg-white">
                <Search className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                <input
                  type="text"
                  placeholder="Search name, email, ref…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="text-[13px] text-[#374151] bg-transparent outline-none w-48"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[#6B7280] border-b border-[#E5E7EB]">
                  <th className="py-3 pr-4 font-medium">Type</th>
                  <th className="py-3 pr-4 font-medium">From (Sender)</th>
                  <th className="py-3 pr-4 font-medium">To (Receiver)</th>
                  <th className="py-3 pr-4 font-medium">Destination / Channel</th>
                  <th className="py-3 pr-4 font-medium">Amount</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Date</th>
                  <th className="py-3 font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#9CA3AF]">
                      Loading transactions…
                    </td>
                  </tr>
                )}
                {!isLoading && filteredTxs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#9CA3AF]">
                      No transactions match your filters.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  filteredTxs.map((tx) => {
                    const payout = tx.payoutRequest && typeof tx.payoutRequest === "object" ? tx.payoutRequest : null;
                    const dest = (payout as any)?.destinationSnapshot ?? null;
                    return (
                      <tr key={tx._id} className="border-b border-[#F3F4F6] hover:bg-[#FAFAFA] transition-colors align-top">
                        {/* Type */}
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${TX_TYPE_STYLES[tx.type] || "bg-[#F3F4F6] text-[#374151]"}`}>
                            {tx.type}
                          </span>
                        </td>
                        {/* Sender */}
                        <td className="py-3 pr-4 text-[#111827]">
                          <div className="font-medium">{userLabel(tx.sender)}</div>
                          {tx.sender && typeof tx.sender === "object" && (
                            <div className="text-[11px] text-[#6B7280] mt-0.5">{(tx.sender as any).email || ""}</div>
                          )}
                        </td>
                        {/* Receiver */}
                        <td className="py-3 pr-4 text-[#111827]">
                          <div className="font-medium">{userLabel(tx.receiver)}</div>
                          {tx.receiver && typeof tx.receiver === "object" && (
                            <div className="text-[11px] text-[#6B7280] mt-0.5">{(tx.receiver as any).email || ""}</div>
                          )}
                        </td>
                        {/* Destination */}
                        <td className="py-3 pr-4 text-[#6B7280]">
                          {dest ? (
                            <div>
                              <div className="font-medium text-[#374151]">{dest.institutionName}</div>
                              <div className="text-[11px] text-[#9CA3AF] mt-0.5">
                                {dest.methodType} · {dest.accountNumberMasked || dest.accountNumber || "—"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[#D1D5DB]">—</span>
                          )}
                        </td>
                        {/* Amount */}
                        <td className="py-3 pr-4 font-semibold text-[#111827]">
                          ₱{Number(tx.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        {/* Status */}
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${TX_STATUS_STYLES[tx.status || ""] || "bg-[#F3F4F6] text-[#374151]"}`}>
                            {tx.status || "—"}
                          </span>
                        </td>
                        {/* Date */}
                        <td className="py-3 pr-4 text-[#6B7280] whitespace-nowrap">
                          {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </td>
                        {/* View */}
                        <td className="py-3">
                          <button
                            onClick={() => setSelectedTx(tx)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-[12px] font-medium bg-[#F0FDF4] text-[#047857] hover:bg-[#DCFCE7] transition-colors"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {!isLoading && filteredTxs.length > 0 && (
            <p className="mt-4 text-[12px] text-[#9CA3AF] text-right">
              Showing {filteredTxs.length} of {transactions.length} transactions
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export function AdminEWalletMonitoring() {
  return (
    <AdminGate allowedRoles={["admin"]}>
      <AdminEWalletMonitoringContent />
    </AdminGate>
  );
}
