import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScrollView from '../../components/ui/SmoothScrollView';
import EmployerNavigation from '../../components/employerNavigation';
import { API_URL } from '../../config';
import { apiRequest, asList } from '../../lib/api';
import { tokens } from '../../theme/tokens';

type Props = { onBack?: () => void; activeTab?: string; onTabPress?: (tab: string) => void };
type HistoryItem = { _id: string; title: string; status?: string; description?: string; location?: string; jobType?: string; amountHeld?: number; amountPaid?: number };

export default function EmployerJobHistory({ onBack, activeTab = 'Profile', onTabPress }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiRequest(`${API_URL}/jobs/history`);
    if (result.ok) setItems(asList<HistoryItem>(result.raw, ['jobs', 'history']));
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {onBack ? <TouchableOpacity onPress={onBack} accessibilityRole="button"><Text style={styles.back}>Back</Text></TouchableOpacity> : null}
        <Text style={styles.title}>Job history</Text>
        <Text style={styles.subtitle}>Review completed and closed jobs, payments, and applications.</Text>
        {loading ? <ActivityIndicator color={tokens.colors.brand} /> : null}
        {!loading && items.length === 0 ? <Text style={styles.empty}>No job history yet.</Text> : null}
        {items.map((item) => (
          <TouchableOpacity key={item._id} style={styles.card} onPress={() => setSelected(selected?._id === item._id ? null : item)}>
            <View style={styles.row}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.status}>{item.status || 'Closed'}</Text></View>
            <Text style={styles.muted}>{item.location || 'No location'} · Held PHP {Number(item.amountHeld || 0).toLocaleString()} · Paid PHP {Number(item.amountPaid || 0).toLocaleString()}</Text>
            {selected?._id === item._id ? <Text style={styles.detail}>{item.description || 'No description available.'}</Text> : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
      <EmployerNavigation activeTab={activeTab} onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.signedInCanvas },
  content: { padding: 18, paddingTop: 55, paddingBottom: 110 },
  title: { color: tokens.colors.text, fontSize: 26, fontWeight: '900' },
  back: { color: tokens.colors.brand, fontWeight: '700', marginBottom: 14 },
  subtitle: { color: tokens.colors.textSubtle, marginTop: 6, marginBottom: 18 },
  empty: { color: tokens.colors.textSubtle, textAlign: 'center', marginTop: 30 },
  card: { backgroundColor: tokens.colors.surface, borderRadius: 15, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: tokens.colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cardTitle: { color: tokens.colors.text, fontWeight: '800', flex: 1 },
  status: { color: tokens.colors.brand, fontWeight: '800', fontSize: 12 },
  muted: { color: tokens.colors.textSubtle, marginTop: 7, fontSize: 12 },
  detail: { color: tokens.colors.text, marginTop: 12, lineHeight: 20 },
});
