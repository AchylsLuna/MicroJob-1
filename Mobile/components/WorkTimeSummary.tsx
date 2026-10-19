import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatWorkTime, getHourlyPay, getWorkMinutes } from '../lib/workTime';
import { formatCurrency } from '../lib/formatters';
import { tokens } from '../theme/tokens';

export default function WorkTimeSummary({ start, end, rate }: { start?: string | null; end?: string | null; rate?: unknown }) {
  const { t } = useTranslation('common');
  const minutes = getWorkMinutes(start, end);
  if (!minutes || !start || !end) return null;
  const hourly = getHourlyPay(rate, minutes);
  return <View style={styles.summary}>
    <Text style={styles.text}>{formatWorkTime(start)}–{formatWorkTime(end)}{end < start ? ` ${t('workTime.nextDay')}` : ''} · {t('workTime.duration', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })}</Text>
    {hourly !== null && <Text style={[styles.text, styles.amount]}>{t('workTime.hourly', { amount: formatCurrency(hourly, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}</Text>}
  </View>;
}
const styles = StyleSheet.create({ summary: { gap: 4, marginTop: 6 }, text: { fontSize: 13, color: tokens.colors.text }, amount: { fontWeight: '700' } });
