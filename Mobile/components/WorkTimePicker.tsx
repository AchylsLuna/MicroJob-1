import React, { useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { tokens } from '../theme/tokens';
import { formatWorkTime } from '../lib/workTime';
import WorkTimeSummary from './WorkTimeSummary';

type TimeField = 'workStartTime' | 'workEndTime';
export default function WorkTimePicker({ start, end, rate, disabled, onChange }: { start: string; end: string; rate?: unknown; disabled?: boolean; onChange: (field: TimeField, time: string) => void }) {
  const { t } = useTranslation('common');
  const [field, setField] = useState<TimeField | null>(null);
  const value = new Date();
  const selected = field === 'workStartTime' ? start || '08:00' : end || '17:00';
  value.setHours(Number(selected.slice(0, 2)), Number(selected.slice(3)), 0, 0);
  const changed = (event: DateTimePickerEvent, next?: Date) => {
    if (Platform.OS !== 'ios') setField(null);
    if (field && next && event.type !== 'dismissed') onChange(field, `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`);
  };
  const picker = field ? <DateTimePicker value={value} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={changed} /> : null;
  return <View style={styles.section}>
    <Text style={styles.title}>{t('workTime.title')}</Text>
    <View style={styles.row}>{([['workStartTime', start, 'start'], ['workEndTime', end, 'end']] as const).map(([key, time, label]) => <TouchableOpacity key={key} accessibilityRole="button" accessibilityLabel={t(`workTime.${label}`)} disabled={disabled} style={[styles.button, disabled && styles.disabled]} onPress={() => setField(key)}><Text style={styles.text}>{t(`workTime.${label}`)}</Text><Text style={styles.title}>{time ? formatWorkTime(time) : t('workTime.select')}</Text></TouchableOpacity>)}</View>
    <Text style={styles.text}>{t('workTime.hint')}</Text>
    <WorkTimeSummary start={start} end={end} rate={rate} />
    {Platform.OS === 'ios' ? <Modal visible={Boolean(field)} transparent onRequestClose={() => setField(null)}><View style={styles.overlay}><View style={styles.dialog}>{picker}<TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => { if (field) onChange(field, selected); setField(null); }}><Text style={styles.title}>{t('workTime.done')}</Text></TouchableOpacity></View></View></Modal> : picker}
  </View>;
}
const styles = StyleSheet.create({ section: { gap: 10, marginVertical: 12 }, row: { flexDirection: 'row', gap: 12 }, button: { flexGrow: 1, minHeight: 48, padding: 12, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12 }, text: { fontSize: 12, color: tokens.colors.textMuted }, title: { color: tokens.colors.text, fontWeight: '700' }, disabled: { opacity: 0.5 }, overlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: tokens.colors.brandDark }, dialog: { padding: 16, borderRadius: 16, backgroundColor: tokens.colors.surface } });
