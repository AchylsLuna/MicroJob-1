export function formatMinimumPay(value: unknown, fallback = "Pay not specified") {
  const amount = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) && amount > 0
    ? `₱${amount.toLocaleString("en-PH")} minimum`
    : fallback;
}
