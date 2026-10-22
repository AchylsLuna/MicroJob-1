import { getTransactionDescription } from '../../lib/transactionDescription';
import type { TFunction } from "i18next";
import { formatDateTime } from "../../lib/formatters";
import type { PaymentTransaction, PayoutRequest } from "../../services/api";

/**
 * Formatting shared by the worker and employer wallet pages.
 *
 * The two pages had grown byte-identical copies of this logic under different
 * names (`toAmount`/`amountOf`, `getPayoutStatusClasses`/`statusClass`), which
 * is how their status colours and amount handling were able to drift apart in
 * the first place.
 *
 * The `t`-taking helpers are namespace-agnostic on purpose: each page passes
 * its own `t` (worker or employer), and both namespaces define the same
 * relative keys under `eWallet.*`.
 */

export const toAmount = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

export const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return formatDateTime(date);
};

const getPartyId = (party: PaymentTransaction["sender"] | PaymentTransaction["receiver"]) => {
  if (!party) return "";
  if (typeof party === "string") return party;
  return String(party._id || "");
};

/** Credit/debit relative to `userId`; "neutral" for anything not yet settled. */
export const getTransactionDirection = (tx: PaymentTransaction, userId: string) => {
  if (!userId || tx.status !== "COMPLETED") return "neutral" as const;
  if (getPartyId(tx.receiver) === userId) return "credit" as const;
  if (getPartyId(tx.sender) === userId) return "debit" as const;
  return "neutral" as const;
};

export const txTypeLabel = (t: TFunction, type: PaymentTransaction["type"]) => {
  switch (type) {
    case "TOP_UP":
      return t("eWallet.txLabel.topUp");
    case "ESCROW":
      return t("eWallet.txLabel.escrow");
    case "PAYOUT":
      return t("eWallet.txLabel.payout");
    case "REFUND":
      return t("eWallet.txLabel.refund");
    default:
      return t("eWallet.txLabel.transaction");
  }
};

export const txLabel = (t: TFunction, tx: PaymentTransaction) => {
  const description = getTransactionDescription(tx);
  return description.key ? t(`wallet.transactionLabel.${description.key}`, { ns: 'common' }) : description.label || txTypeLabel(t, tx.type);
};

export const linkedEntityLabel = (t: TFunction, value?: string | null) => {
  switch (String(value || "").toLowerCase()) {
    case "wallet_topup":
      return t("eWallet.linkedEntity.walletTopUp");
    case "job":
      return t("eWallet.linkedEntity.job");
    default:
      return value ? value.replace(/_/g, " ") : "-";
  }
};

export const getPayoutStatusClasses = (status: PayoutRequest["status"]) => {
  switch (status) {
    case "requested":
      return "bg-brand/10 text-brand";
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

export const getTransactionStatusClasses = (status?: string) => {
  switch (status) {
    case "PAID":
    case "COMPLETED":
      return "bg-[#DCFCE7] text-[#15803D]";
    case "FUNDS_RESERVED":
    case "REQUESTED":
    case "APPROVED":
    case "PROCESSING":
    case "PENDING":
      return "bg-brand/10 text-brand";
    case "REJECTED":
    case "FAILED":
      return "bg-[#FEE2E2] text-[#B91C1C]";
    case "CANCELLED":
      return "bg-[#F3F4F6] text-[#6B7280]";
    default:
      return "bg-[#F3F4F6] text-[#6B7280]";
  }
};
