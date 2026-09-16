// Shared storage key for an in-flight external checkout (GCash/Xendit top-up).
// EmployerEWallet writes it before opening the checkout URL and clears it once
// the top-up is confirmed; AppSessionContext reads it to recognize a
// foreground-resume from that checkout as real activity rather than idle
// abandonment, so a >15-minute payment hop doesn't trigger an idle logout.
export const PENDING_TOPUP_STORAGE_KEY = 'pending_topup_checkout_employer';
