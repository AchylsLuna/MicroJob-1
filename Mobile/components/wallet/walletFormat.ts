import { formatCurrency } from '../../lib/formatters';

export const php = (value: unknown) => formatCurrency(value, { maximumFractionDigits: 2 });
