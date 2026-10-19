import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import ScrollView from '../../components/ui/SmoothScrollView';
import EmployerNavigation from '../../components/employerNavigation';
import DailyWorkSchedule from '../../components/DailyWorkSchedule';
import EmployerApplications from './EmployerApplications';
import { API_URL } from '../../config';
import { apiRequest, asList } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { tokens } from '../../theme/tokens';

type Props = {
  onBack?: () => void;
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  onMessageWorker?: (payload: { workerId: string; workerName?: string; jobId: string }) => void;
};
type HistoryItem = {
  _id: string; title: string; status: string; description?: string; location?: string; jobType?: string;
  amountHeld: number; amountPaid: number; salary?: number; deadline?: string;
  skills?: string[]; requirements?: string[]; responsibilities?: string[];
  paymentMode?: string; workDates?: string[]; workStartTime?: string; workEndTime?: string;
};
const PAGE_SIZE = 10;

export default function EmployerJobHistory({ onBack, activeTab = 'Profile', onTabPress, onMessageWorker }: Props) {
  const { t } = useTranslation('employer');
  const { t: tc } = useTranslation('common');
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const request = useRef(0);
  const load = useCallback(async () => {
    const requestId = ++request.current;
    setLoading(true); setError('');
    try {
      const result = await apiRequest(`${API_URL}/jobs/history`, {}, t('jobHistory.loadFailed'));
      if (!result.ok) throw new Error(result.message || t('jobHistory.loadFailed'));
      if (requestId === request.current) { setItems(asList<HistoryItem>(result.raw, ['jobs', 'history'])); setPage(1); }
    } catch (caught: any) { if (requestId === request.current) setError(caught.message || t('jobHistory.loadFailed')); }
    finally { if (requestId === request.current) setLoading(false); }
  }, [t]);
  useFocusEffect(useCallback(() => { void load(); return () => { request.current += 1; }; }, [load]));
  const selected = items.find((item) => item._id === selectedId);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const statusLabel = (status: string) => t(`jobHistory.statuses.${status}`, { defaultValue: status });

  if (selected) return <EmployerApplications key={selected._id} historyJobId={selected._id} activeTab={activeTab} onTabPress={onTabPress} onMessageWorker={onMessageWorker} onBack={() => { setSelectedId(null); void load(); }} onHistoryChange={() => void load()} historyDetails={<View style={styles.card}>
    <Text accessibilityRole="header" style={styles.cardTitle}>{selected.title}</Text>
    <Text style={styles.status}>{statusLabel(selected.status)}</Text>
    <Text style={styles.detail}>{selected.description || tc('lifecycle.descriptionUnavailable')}</Text>
    {[
      ['location', selected.location || '—'], ['jobType', selected.jobType || '—'],
      ['deadline', selected.deadline ? formatDate(selected.deadline) : '—'], ['minimumPay', formatCurrency(selected.salary || 0)],
      ['amountHeld', formatCurrency(selected.amountHeld)], ['amountPaid', formatCurrency(selected.amountPaid)],
    ].map(([label, value]) => <View key={label} style={styles.row}><Text style={styles.muted}>{t(`jobHistory.${label}`)}</Text><Text style={styles.value}>{value}</Text></View>)}
    {selected.paymentMode === 'daily' && <DailyWorkSchedule dates={selected.workDates || []} rate={selected.salary || 0} start={selected.workStartTime} end={selected.workEndTime} />}
    {(['skills', 'requirements', 'responsibilities'] as const).map((key) => selected[key]?.length ? <View key={key}><Text style={styles.cardTitle}>{t(`jobHistory.${key}`)}</Text>{selected[key]?.map((value, index) => <Text key={`${key}-${index}`} style={styles.detail}>• {value}</Text>)}</View> : null)}
  </View>} />;

  return <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={tokens.colors.brand} />}>
      {onBack && <TouchableOpacity style={styles.button} onPress={onBack} accessibilityRole="button"><Text style={styles.buttonText}>{tc('wallet.back')}</Text></TouchableOpacity>}
      <Text accessibilityRole="header" style={styles.title}>{t('jobHistory.title')}</Text>
      <Text style={styles.subtitle}>{t('jobHistory.subtitle')}</Text>
      <Text style={styles.muted}>{t('jobHistory.moneyNote')}</Text>
      <TouchableOpacity style={styles.button} disabled={loading} accessibilityRole="button" onPress={() => void load()}><Text style={styles.buttonText}>{t('jobHistory.refresh')}</Text></TouchableOpacity>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator accessibilityLabel={t('jobHistory.loading')} color={tokens.colors.brand} /> : null}
      {!loading && !error && !items.length ? <Text style={styles.empty}>{t('jobHistory.empty')}</Text> : null}
      {!loading && !error && items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((item) => <TouchableOpacity key={item._id} style={styles.card} accessibilityRole="button" accessibilityLabel={t('jobHistory.viewDetailsFor', { title: item.title })} onPress={() => setSelectedId(item._id)}>
        <View style={styles.row}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.status}>{statusLabel(item.status)}</Text></View>
        <Text style={styles.muted}>{t('jobHistory.amountHeld')}: {formatCurrency(item.amountHeld)}</Text>
        <Text style={styles.muted}>{t('jobHistory.amountPaid')}: {formatCurrency(item.amountPaid)}</Text>
        <Text style={styles.link}>{t('jobHistory.viewDetails')}</Text>
      </TouchableOpacity>)}
      {!loading && !error && items.length > PAGE_SIZE && <View>
        <Text accessibilityLiveRegion="polite" style={styles.muted}>{t('jobHistory.pagination.showing', { from: (currentPage - 1) * PAGE_SIZE + 1, to: Math.min(currentPage * PAGE_SIZE, items.length), total: items.length })}</Text>
        <View style={styles.row}><TouchableOpacity accessibilityRole="button" disabled={currentPage === 1} style={styles.button} onPress={() => setPage(currentPage - 1)}><Text style={styles.buttonText}>{t('jobHistory.pagination.previous')}</Text></TouchableOpacity><Text style={styles.muted}>{currentPage} / {pageCount}</Text><TouchableOpacity accessibilityRole="button" disabled={currentPage === pageCount} style={styles.button} onPress={() => setPage(currentPage + 1)}><Text style={styles.buttonText}>{t('jobHistory.pagination.next')}</Text></TouchableOpacity></View>
      </View>}
    </ScrollView>
    <EmployerNavigation activeTab={activeTab} onTabPress={onTabPress} />
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.signedInCanvas }, content: { padding: 18, paddingTop: 55, paddingBottom: 110 },
  title: { color: tokens.colors.text, fontSize: 26, fontWeight: '900' }, subtitle: { color: tokens.colors.textSubtle, marginVertical: 12 },
  empty: { color: tokens.colors.textSubtle, textAlign: 'center', marginTop: 30 }, error: { color: tokens.colors.danger, paddingVertical: 12 },
  card: { backgroundColor: tokens.colors.surface, borderRadius: 15, padding: 15, marginVertical: 10, borderWidth: 1, borderColor: tokens.colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardTitle: { color: tokens.colors.text, fontWeight: '800', flexShrink: 1 }, status: { color: tokens.colors.brand, fontWeight: '800', fontSize: 12 },
  muted: { color: tokens.colors.textSubtle, marginVertical: 7, fontSize: 12, flexShrink: 1 }, value: { color: tokens.colors.text, flexShrink: 1 },
  detail: { color: tokens.colors.text, marginVertical: 8, lineHeight: 20 }, link: { color: tokens.colors.brand, fontWeight: '700', paddingTop: 12 },
  button: { minHeight: 44, padding: 12, justifyContent: 'center' }, buttonText: { color: tokens.colors.brand, fontWeight: '700' },
});
