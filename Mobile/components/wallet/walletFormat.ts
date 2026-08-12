export const php = (value: unknown) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
}).format(Number.isFinite(Number(value)) ? Number(value) : 0);
