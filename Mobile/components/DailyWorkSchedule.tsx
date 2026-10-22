import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { tokens } from '../theme/tokens';
import WorkTimeSummary from './WorkTimeSummary';

export default function DailyWorkSchedule({ dates, rate, payments, start, end }: { dates: string[]; rate: number; start?: string | null; end?: string | null; payments?: { workDate: string; paidAt?: string; submittedAt?: string }[] }) {
  const { t } = useTranslation('common');
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>{t('lifecycle.workSchedule')}</Text>
    <Text style={styles.text}>{t('lifecycle.dailyRate', { amount: rate })}</Text>
    <WorkTimeSummary start={start} end={end} rate={rate} />
    <Text style={styles.text}>{t('lifecycle.dailyDates')}</Text>
    {dates.map((date) => {
      const day = payments?.find((item) => item.workDate === date);
      return <View key={date} style={styles.row}><Text style={styles.text}>{date}</Text>{payments && <Text style={styles.text}>{t(day?.paidAt ? 'lifecycle.dailyPaid' : day?.submittedAt ? 'lifecycle.dailyAwaiting' : 'lifecycle.dailyScheduled')}</Text>}</View>;
    })}
  </View>;
}
const styles = StyleSheet.create({ card: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12, padding: 14, gap: 8, marginVertical: 12 }, title: { color: tokens.colors.text, fontWeight: '700' }, text: { color: tokens.colors.text, flexShrink: 1 }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: tokens.colors.border } });
