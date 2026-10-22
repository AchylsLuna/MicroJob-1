import { useTranslation } from 'react-i18next';
import { formatDate } from '../lib/formatters';

import { offerResponseStatus } from '../lib/offerResponse';
import { useOfferExpiry } from '../hooks/useOfferExpiry';

export function OfferResponseDeadline({ offer }: { offer?: { status?: string; expiresAt?: string | null } | null }) {
  const { t } = useTranslation('common');
  useOfferExpiry([offer]);
  if (offerResponseStatus(offer) === 'expired') return <p role="status" className="text-sm text-amber-800">{t('offerResponse.expired')}</p>;
  if (offer?.status !== 'pending' || !offer.expiresAt) return null;
  return <p className="text-sm text-slate-600">{t('offerResponse.respondBy', { date: formatDate(offer.expiresAt, { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) })}</p>;
}
