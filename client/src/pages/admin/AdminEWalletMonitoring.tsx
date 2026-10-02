import { useState, useMemo } from "react";
import { ArrowRightLeft, Clipboard, Clock3, CreditCard, DollarSign, Download, History, Receipt, Search, UserRound, Wallet, X } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { AdminGate } from "./admin/AdminGate";
import { useAdminData } from "../../hooks/useAdminData";
import { formatCurrency, formatDate, formatDateTime } from "../../lib/formatters";
import type { PaymentTransaction } from "../../services/api";
import { toast } from "../../lib/toast";
import { LAYER_Z } from "../../components/ui/layers";

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

const readableValue = (value?: string | null) => String(value || "")
  .replace(/[_-]+/g, " ")
  .replace(/\b\w/g, (character) => character.toUpperCase()) || "—";

const formatProcessingMethod = (value?: string | null) => {
  const normalized = String(value || "").trim().toLowerCase();
  const knownMethods: Record<string, string> = {
    manual_admin_review: "Manual Admin Review",
    paymongo: "PayMongo",
    xendit: "Xendit",
    "xendit-link": "Xendit Payment Link",
    gcash: "GCash",
    maya: "Maya",
    bank_transfer: "Bank Transfer",
    dev_webhook: "Development Payment Simulator",
  };
  return knownMethods[normalized] || readableValue(value);
};

const maskEmail = (email?: string | null) => {
  const [local, domain] = String(email || "").trim().split("@");
  if (!local || !domain) return "—";
  return `${local.slice(0, Math.min(8, Math.max(2, local.length - 2)))}****@${domain}`;
};

const maskAccountNumber = (value?: string | null) => {
  const account = String(value || "").trim();
  if (!account) return "—";
  return `******${account.replace(/\D/g, "").slice(-4) || account.slice(-4)}`;
};

const getReceiptReference = (tx: PaymentTransaction) => {
  if (tx.reference?.startsWith("MJ-")) return tx.reference;
  const date = tx.createdAt ? new Date(tx.createdAt) : new Date();
  const datePart = Number.isNaN(date.getTime())
    ? "00000000"
    : `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `MJ-${String(tx.type || "PAYMENT").replace("_", "")}-${datePart}-${String(tx._id || "").slice(-6).toUpperCase()}`;
};

function ReceiptModal({ tx, onClose }: { tx: PaymentTransaction; onClose: () => void }) {
  const { t } = useTranslation("admin");
  const payout = tx.payoutRequest && typeof tx.payoutRequest === "object" ? tx.payoutRequest : null;
  const dest = (payout as any)?.destinationSnapshot ?? null;
  const linked = tx.linkedTransaction && typeof tx.linkedTransaction === "object" ? tx.linkedTransaction : null;
  const job = tx.jobReference && typeof tx.jobReference === "object" ? tx.jobReference as any : null;
  const receiptReference = getReceiptReference(tx);
  const timeline = [
    ["Created", tx.createdAt],
    ["Reviewed", payout?.reviewedAt],
    ["Completed", payout?.paidAt || (tx.status === "COMPLETED" ? tx.createdAt : null)],
  ].filter(([, value]) => value);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}.`);
    }
  };

  const downloadReceipt = () => {
    const content = [`${readableValue(tx.type)} Transaction Receipt`, `Reference Number: ${receiptReference}`, `Transaction ID: ${tx._id}`, `Total Amount: ${formatCurrency(tx.amount)} PHP`].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${receiptReference}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded.");
  };

  const Field = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wide">{label}</span>
      <span className="text-[13px] text-[#111827] break-all">{value || "—"}</span>
    </div>
  );

  return (
    <div className={`fixed inset-0 ${LAYER_Z.modal} flex items-center justify-center bg-slate-950/55 p-4`} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="transaction-receipt-title" className="bg-white rounded-[20px] shadow-2xl w-full max-w-4xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between p-5 sm:p-6 border-b border-[#E5E7EB] bg-white/95 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-[#F0FDF4] flex items-center justify-center">
              <Receipt className="w-5 h-5 text-[#047857]" />
            </div>
            <div>
              <h3 id="transaction-receipt-title" className="text-lg font-bold text-[#111827]">{readableValue(tx.type)} Transaction Receipt</h3>
              <p className="text-[12px] text-slate-600 mt-1"><span className="font-semibold">Reference No:</span> {receiptReference}</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                {tx.createdAt ? formatDateTime(tx.createdAt) : "—"}
              </p>
            </div>
          </div>
          <button type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#F3F4F6] transition-colors"
            aria-label="Close receipt"
          >
            <X className="w-4 h-4 text-[#6B7280]" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
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

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Receipt className="h-4 w-4 text-[#1C4D8D]" />Transaction Information</h4>
          {/* References */}
          <div className="grid grid-cols-1 gap-3">
            <Field label="Reference Number" value={receiptReference} />
            <Field label={t("eWallet.receipt.fields.transactionId")} value={tx._id} />
            {tx.reference && <Field label={t("eWallet.receipt.fields.referenceNo")} value={tx.reference} />}
            {tx.provider && <Field label="Processing Method" value={formatProcessingMethod(tx.provider)} />}
            {tx.providerReference && <Field label={t("eWallet.receipt.fields.providerReference")} value={tx.providerReference} />}
            {tx.label && <Field label={t("eWallet.receipt.fields.label")} value={tx.label} />}
          </div>
          </section>

          {/* Sender / Receiver */}
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><h4 className="flex items-center gap-2 text-sm font-bold text-slate-900"><UserRound className="h-4 w-4 text-[#1C4D8D]" />User Information</h4><div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">{t("eWallet.receipt.paidBySender")}</p>
              {tx.sender && typeof tx.sender === "object" ? (
                <div className="space-y-1">
                  <p className="text-[13px] font-medium text-[#111827]">{userLabel(tx.sender)}</p>
                  <p className="text-[11px] text-[#6B7280]">Email: {maskEmail((tx.sender as any).email)}</p>
                  <p className="text-[11px] text-[#9CA3AF] capitalize">{(tx.sender as any).role || ""}</p>
                </div>
              ) : job && (job as any).jobPoster && typeof (job as any).jobPoster === "object" ? (
                <div className="space-y-1">
                  <p className="text-[13px] font-medium text-[#111827]">{userLabel((job as any).jobPoster)}</p>
                  <p className="text-[11px] text-[#6B7280]">Email: {maskEmail((job as any).jobPoster.email)}</p>
                  <p className="text-[11px] text-[#9CA3AF]">{t("eWallet.receipt.employerViaEscrow")}</p>
                </div>
              ) : (
                <p className="text-[13px] text-[#9CA3AF]">Not recorded</p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">{t("eWallet.receipt.fields.receiver")}</p>
              {tx.receiver && typeof tx.receiver === "object" ? (
                <div className="space-y-1">
                  <p className="text-[13px] font-medium text-[#111827]">{userLabel(tx.receiver)}</p>
                  <p className="text-[11px] text-[#6B7280]">Email: {maskEmail((tx.receiver as any).email)}</p>
                  <p className="text-[11px] text-[#9CA3AF] capitalize">{(tx.receiver as any).role || ""}</p>
                </div>
              ) : (
                <p className="text-[13px] text-[#9CA3AF]">Not recorded</p>
              )}
            </div>
          </div></section>

          {/* Payment Destination (from payout request) */}
          {dest && (
            <div className="border border-[#E5E7EB] rounded-2xl p-4 space-y-3 bg-[#FAFAFA]">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-900"><CreditCard className="h-4 w-4 text-[#1C4D8D]" />Payment Details</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Payment Method" value={formatProcessingMethod(dest.methodType)} />
                <Field label="Payment Provider" value={formatProcessingMethod(dest.institutionName)} />
                <Field label={t("eWallet.receipt.fields.accountName")} value={dest.accountName} />
                <Field label="Account Number" value={maskAccountNumber(dest.accountNumberMasked || dest.accountNumber)} />
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
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Clock3 className="h-4 w-4 text-[#1C4D8D]" />Transaction Timeline</h4>
            <ol id="transaction-timeline" className="mt-3 space-y-3">
              {timeline.map(([label, value], index) => <li key={String(label)} className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1C4D8D]/10 text-xs font-bold text-[#1C4D8D]">{index + 1}</span><span className="text-sm font-semibold text-slate-800">{label}</span><span className="text-xs text-slate-500">{formatDateTime(value as string)}</span></li>)}
            </ol>
          </section>
        </div>
        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white p-4">
          <button type="button" onClick={() => void copy("Transaction ID", tx._id)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Clipboard className="h-4 w-4" />Copy Transaction ID</button>
          <button type="button" onClick={() => void copy("Reference Number", receiptReference)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Clipboard className="h-4 w-4" />Copy Reference Number</button>
          <button type="button" onClick={downloadReceipt} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" />Download Receipt</button>
          <button type="button" onClick={() => document.getElementById("transaction-timeline")?.scrollIntoView({ behavior: "smooth", block: "center" })} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#1C4D8D] px-3 text-sm font-semibold text-white hover:bg-[#163f75]"><History className="h-4 w-4" />View Transaction History</button>
        </div>
      </section>
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
      accent: "bg-[#CCFBF1]",
    },
    {
      label: t("eWallet.cards.completedTotal"),
      value: isLoading ? "—" : formatCurrencyHook(walletStats.completedTotal),
      icon: <DollarSign className="w-6 h-6 text-[#047857]" />,
      accent: "bg-[#D1FAE5]",
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
              <div className={`w-12 h-12 rounded-[12px] ${card.accent} flex items-center justify-center`}>
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
                              <div className="font-medium text-[#374151]">{formatProcessingMethod(dest.institutionName)}</div>
                              <div className="text-[11px] text-[#9CA3AF] mt-0.5">
                                {formatProcessingMethod(dest.methodType)} · {maskAccountNumber(dest.accountNumberMasked || dest.accountNumber)}
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
                              <div className="font-medium text-[#374151]">{formatProcessingMethod(dest.institutionName)}</div>
                              <div className="text-[11px] text-[#9CA3AF] mt-0.5">
                                {formatProcessingMethod(dest.methodType)} · {maskAccountNumber(dest.accountNumberMasked || dest.accountNumber)}
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
