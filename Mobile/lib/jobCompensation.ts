import { formatCurrency } from './formatters';

export function formatMinimumPay(value: unknown, fallback = 'Not set') {
  const amount = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(amount) && amount > 0
    ? `${formatCurrency(amount, { maximumFractionDigits: 0 })} minimum`
    : fallback;
}
