import React from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../lib/formatters';
import { tokens } from '../theme/tokens';

import { offerResponseStatus } from '../lib/offerResponse';
import { useOfferExpiry } from '../hooks/useOfferExpiry';

export default function OfferResponseDeadline({ offer }: { offer?: { status?: string; expiresAt?: string | null } | null }) {
  const { t } = useTranslation('common');
  useOfferExpiry([offer]);
  if (offerResponseStatus(offer) === 'expired') return <Text accessibilityLiveRegion="polite" style={{ color: tokens.colors.text, marginVertical: 8 }}>{t('offerResponse.expired')}</Text>;
  if (offer?.status !== 'pending' || !offer.expiresAt) return null;
  return <Text style={{ color: tokens.colors.text, marginVertical: 8 }}>{t('offerResponse.respondBy', { date: formatDateTime(offer.expiresAt, { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) })}</Text>;
}
