export function offerResponseStatus(offer: { status?: string; expiresAt?: string | null } | null | undefined, now = Date.now()) {
  return offer?.status === 'pending' && offer.expiresAt && new Date(offer.expiresAt).getTime() <= now ? 'expired' : offer?.status;
}
