// Keep partial decimals while editing; commas are display-only.
export function formatWithdrawalAmount(value: string): string | null {
  const raw = value.replace(/,/g, '');
  if (!/^\d*(\.\d{0,2})?$/.test(raw)) return null;
  if (!raw) return '';
  const [whole, fraction] = raw.split('.');
  const grouped = (whole.replace(/^0+(?=\d)/, '') || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}
