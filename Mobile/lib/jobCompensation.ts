import { formatCurrency } from './formatters';

export function getMinimumJobPay(jobType: string): number {
  if (jobType.trim() === 'Recruiting') return 480;
  return ['Short-term', 'Side hustle'].includes(jobType.trim()) ? 50 : 0;
}

export function formatMinimumPay(value: unknown, fallback = 'Not set') {
  const amount = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(amount) && amount > 0
    ? `${formatCurrency(amount, { maximumFractionDigits: 0 })} minimum`
    : fallback;
}
