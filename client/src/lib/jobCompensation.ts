import i18n from '../i18n';
import { formatCurrency } from "./formatters";

export const getManilaDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export function getMinimumJobPay(jobType: string): number {
  if (jobType.trim() === "Recruiting") return 480;
  return ["Short-term", "Side hustle"].includes(jobType.trim()) ? 50 : 0;
}

export function formatMinimumPay(value: unknown, fallback = "Pay not specified", paymentMode?: string) {
  const amount = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  if (paymentMode === 'daily' && Number.isFinite(amount) && amount > 0) return i18n.t('lifecycle.dailyRate', { ns: 'common', amount: amount.toLocaleString('en-PH') });
  return Number.isFinite(amount) && amount > 0
    ? `${formatCurrency(amount, { maximumFractionDigits: 0 })} minimum`
    : fallback;
}
