import { useEffect, useState } from 'react';

export function useOfferExpiry(offers: Array<{ status?: string; expiresAt?: string | null } | null | undefined>) {
  const [revision, setRevision] = useState(0);
  const now = Date.now();
  const next = offers.reduce((earliest, offer) => {
    const at = offer?.status === 'pending' && offer.expiresAt ? new Date(offer.expiresAt).getTime() : NaN;
    return at > now ? Math.min(earliest, at) : earliest;
  }, Infinity);
  useEffect(() => {
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(() => setRevision((value) => value + 1), Math.min(Math.max(0, next - Date.now()) + 10, 2147483647));
    return () => clearTimeout(timer);
  }, [next, revision]);
}
