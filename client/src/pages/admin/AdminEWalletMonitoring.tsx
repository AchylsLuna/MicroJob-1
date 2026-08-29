import { useState, useMemo } from "react";
import { DollarSign, Wallet, X, Search, Receipt, ArrowRightLeft } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { AdminGate } from "./admin/AdminGate";
import { useAdminData } from "../../hooks/useAdminData";
import { formatCurrency, formatDate, formatDateTime } from "../../lib/formatters";
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
  const { t } = useTranslation("admin");
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
              <h3 className="text-[15px] font-semibold text-[#111827]">{t("eWallet.receipt.title")}</h3>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                {tx.createdAt ? formatDateTime(tx.createdAt) : "—"}
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
            <p className="text-[11px] text-[#9CA3AF] mb-1">{t("eWallet.receipt.amount")}</p>
            <p className="text-[28px] font-bold text-[#111827]">
              {formatCurrency(tx.amount)}
            </p>
          </div>

          {/* References */}
          <div className="grid grid-cols-1 gap-3">
            <Field label={t("eWallet.receipt.fields.transactionId")} value={tx._id} />
            {tx.reference && <Field label={t("eWallet.receipt.fields.referenceNo")} value={tx.reference} />}
            {tx.provider && <Field label={t("eWallet.receipt.fields.provider")} value={tx.provider} />}
            {tx.providerReference && <Field label={t("eWallet.receipt.fields.providerReference")} value={tx.providerReference} />}
            {tx.label && <Field label={t("eWallet.receipt.fields.label")} value={tx.label} />}
          </div>

          {/* Sender / Receiver */}
          <div className="grid grid-cols-2 gap-4 border-t border-[#F3F4F6] pt-4">
            <div>
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">{t("eWallet.receipt.paidBySender")}</p>
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
                  <p className="text-[11px] text-[#9CA3AF]">{t("eWallet.receipt.employerViaEscrow")}</p>
                </div>
              ) : (
                <p className="text-[13px] text-[#9CA3AF]">{t("eWallet.receipt.escrowOrSystem")}</p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">{t("eWallet.receipt.fields.receiver")}</p>
              {tx.receiver && typeof tx.receiver === "object" ? (
                <div className="space-y-1">
                  <p className="text-[13px] font-medium text-[#111827]">{userLabel(tx.receiver)}</p>
                  <p className="text-[11px] text-[#6B7280]">{(tx.receiver as any).email || ""}</p>
                  <p className="text-[11px] text-[#9CA3AF] capitalize">{(tx.receiver as any).role || ""}</p>
                </div>
              ) : (
                <p className="text-[13px] text-[#9CA3AF]">{t("eWallet.receipt.systemOrExternal")}</p>
              )}
            </div>
          </div>

          {/* Payment Destination (from payout request) */}
          {dest && (
            <div className="border border-[#E5E7EB] rounded-[12px] p-4 space-y-3 bg-[#FAFAFA]">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">{t("eWallet.receipt.paymentDestination")}</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("eWallet.receipt.fields.methodChannel")} value={dest.methodType} />
                <Field label={t("eWallet.receipt.fields.institution")} value={dest.institutionName} />
                <Field label={t("eWallet.receipt.fields.accountName")} value={dest.accountName} />
                <Field label={t("eWallet.receipt.fields.accountNo")} value={dest.accountNumberMasked || dest.accountNumber} />
              </div>
            </div>
          )}

          {/* Job Reference */}
          {job && (
            <div className="border-t border-[#F3F4F6] pt-4 space-y-2">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">{t("eWallet.receipt.jobReference")}</p>
              <Field label={t("eWallet.receipt.fields.title")} value={job.title} />
              <Field label={t("eWallet.receipt.fields.status")} value={job.status} />
            </div>
          )}

          {/* Linked Transaction */}
          {linked && (
            <div className="border-t border-[#F3F4F6] pt-4 space-y-2">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">{t("eWallet.receipt.linkedTransaction")}</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("eWallet.receipt.fields.type")} value={(linked as any).type} />
                <Field label={t("eWallet.receipt.fields.status")} value={(linked as any).status} />
                <Field label={t("eWallet.receipt.fields.amount")} value={(linked as any).amount != null ? formatCurrency((linked as any).amount) : "—"} />
                <Field label={t("eWallet.receipt.fields.reference")} value={(linked as any).reference} />
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
  const { t } = useTranslation("admin");
  const { isLoading, loadError, walletStats, transactions, formatCurrency: formatCurrencyHook } = useAdminData();

  const [activeTab, setActiveTab] = useState<"payouts" | "logs">("payouts");
  const [selectedTx, setSelectedTx] = useState<PaymentTransaction | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Completed payouts include only ledger entries that have actually completed.
  const completedPayouts = useMemo(
    () => transactions.filter((tx) => tx.type === "PAYOUT" && tx.status === "COMPLETED"),
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
      label: t("eWallet.cards.completedPayouts"),
      value: isLoading ? "—" : walletStats.completedCount,
      icon: <Wallet className="w-6 h-6 text-[#0F766E]" />,
      accent: "from-[#CCFBF1] to-[#99F6E4]",
    },
    {
      label: t("eWallet.cards.completedTotal"),
      value: isLoading ? "—" : formatCurrencyHook(walletStats.completedTotal),
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
          <span className="flex items-center gap-2"><Wallet className="w-4 h-4" />{t("eWallet.cards.completedPayouts")}</span>
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2 rounded-[10px] text-[13px] font-medium transition-colors ${
            activeTab === "logs"
              ? "bg-white shadow-sm text-[#111827]"
              : "text-[#6B7280] hover:text-[#374151]"
          }`}
        >
          <span className="flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" />{t("eWallet.logs.title")}</span>
        </button>
      </div>

      {/* ── Tab: Completed Payouts ── */}
      {activeTab === "payouts" && (
        <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
          <div className="mb-6">
            <h3 className="text-[18px] font-semibold text-[#111827]">{t("eWallet.cards.completedPayouts")}</h3>
            <p className="text-[13px] text-[#6B7280] mt-1">
              {t("eWallet.payouts.subtitle")}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[#6B7280] border-b border-[#E5E7EB]">
                  <th className="py-3 pr-4 font-medium">{t("eWallet.table.fromSender")}</th>
                  <th className="py-3 pr-4 font-medium">{t("eWallet.table.toReceiver")}</th>
                  <th className="py-3 pr-4 font-medium">{t("eWallet.table.destinationChannel")}</th>
                  <th className="py-3 pr-4 font-medium">{t("eWallet.table.amount")}</th>
                  <th className="py-3 pr-4 font-medium">{t("eWallet.table.status")}</th>
                  <th className="py-3 pr-4 font-medium">{t("eWallet.table.date")}</th>
                  <th className="py-3 font-medium">{t("eWallet.table.receipt")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#9CA3AF]">
                      {t("eWallet.payouts.loading")}
                    </td>
                  </tr>
                )}
                {!isLoading && completedPayouts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#9CA3AF]">
                      {t("eWallet.payouts.empty")}
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
                              <div className="text-[11px] text-[#9CA3AF] mt-0.5">{t("eWallet.viaEscrow")}</div>
                            </>
                          ) : (
                            <span className="text-[#9CA3AF]">{t("eWallet.escrowSystem")}</span>
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
                              <div className="text-[#374151]">{t("eWallet.autoPayEscrow")}</div>
                              {job && <div className="text-[11px] text-[#9CA3AF] mt-0.5">{job.title}</div>}
                            </div>
                          )}
                        </td>
                        {/* Amount */}
                        <td className="py-3 pr-4 font-semibold text-[#111827]">
                          {formatCurrency(tx.amount)}
                        </td>
                        {/* Status */}
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${TX_STATUS_STYLES[tx.status || ""] || "bg-[#F3F4F6] text-[#374151]"}`}>
                            {tx.status || "—"}
                          </span>
                        </td>
                        {/* Date */}
                        <td className="py-3 pr-4 text-[#6B7280] whitespace-nowrap">
                          {tx.createdAt ? formatDate(tx.createdAt, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </td>
                        {/* Receipt */}
                        <td className="py-3">
                          <button
                            onClick={() => setSelectedTx(tx)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-[12px] font-medium bg-[#F0FDF4] text-[#047857] hover:bg-[#DCFCE7] transition-colors"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            {t("eWallet.viewAction")}
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
              {t("eWallet.payouts.count", { count: completedPayouts.length })}
            </p>
          )}
        </section>
      )}

      {/* ── Tab: Transaction Logs ── */}
      {activeTab === "logs" && (
        <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-[18px] font-semibold text-[#111827]">{t("eWallet.logs.title")}</h3>
              <p className="text-[13px] text-[#6B7280] mt-1">
                <Trans t={t} i18nKey="eWallet.logs.subtitle" components={{ strong: <strong /> }} />
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Type filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-[13px] border border-[#E5E7EB] rounded-[8px] px-3 py-2 text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
              >
                <option value="ALL">{t("eWallet.logs.typeOptions.all")}</option>
                <option value="TOP_UP">{t("eWallet.logs.typeOptions.topUp")}</option>
                <option value="ESCROW">{t("eWallet.logs.typeOptions.escrow")}</option>
                <option value="PAYOUT">{t("eWallet.logs.typeOptions.payout")}</option>
                <option value="REFUND">{t("eWallet.logs.typeOptions.refund")}</option>
              </select>
              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-[13px] border border-[#E5E7EB] rounded-[8px] px-3 py-2 text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
              >
                <option value="ALL">{t("eWallet.logs.statusOptions.all")}</option>
                <option value="COMPLETED">{t("eWallet.logs.statusOptions.completed")}</option>
                <option value="PENDING">{t("eWallet.logs.statusOptions.pending")}</option>
                <option value="FAILED">{t("eWallet.logs.statusOptions.failed")}</option>
                <option value="CANCELLED">{t("eWallet.logs.statusOptions.cancelled")}</option>
              </select>
              {/* Search */}
              <div className="flex items-center gap-2 border border-[#E5E7EB] rounded-[8px] px-3 py-2 bg-white">
                <Search className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                <input
                  type="text"
                  placeholder={t("eWallet.logs.searchPlaceholder")}
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
                  <th className="py-3 pr-4 font-medium">{t("eWallet.table.type")}</th>
                  <th className="py-3 pr-4 font-medium">{t("eWallet.table.fromSender")}</th>
                  <th className="py-3 pr-4 font-medium">{t("eWallet.table.toReceiver")}</th>
                  <th className="py-3 pr-4 font-medium">{t("eWallet.table.destinationChannel")}</th>
                  <th className="py-3 pr-4 font-medium">{t("eWallet.table.amount")}</th>
                  <th className="py-3 pr-4 font-medium">{t("eWallet.table.status")}</th>
                  <th className="py-3 pr-4 font-medium">{t("eWallet.table.date")}</th>
                  <th className="py-3 font-medium">{t("eWallet.table.receipt")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#9CA3AF]">
                      {t("eWallet.logs.loading")}
                    </td>
                  </tr>
                )}
                {!isLoading && filteredTxs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#9CA3AF]">
                      {t("eWallet.logs.empty")}
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
                          {formatCurrency(tx.amount)}
                        </td>
                        {/* Status */}
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${TX_STATUS_STYLES[tx.status || ""] || "bg-[#F3F4F6] text-[#374151]"}`}>
                            {tx.status || "—"}
                          </span>
                        </td>
                        {/* Date */}
                        <td className="py-3 pr-4 text-[#6B7280] whitespace-nowrap">
                          {tx.createdAt ? formatDate(tx.createdAt, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </td>
                        {/* View */}
                        <td className="py-3">
                          <button
                            onClick={() => setSelectedTx(tx)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-[12px] font-medium bg-[#F0FDF4] text-[#047857] hover:bg-[#DCFCE7] transition-colors"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            {t("eWallet.viewAction")}
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
              {t("eWallet.logs.showingCount", { shown: filteredTxs.length, total: transactions.length })}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export function AdminEWalletMonitoring() {
  return (
    <AdminGate permission="finance.transactions.view">
      <AdminEWalletMonitoringContent />
    </AdminGate>
  );
}
