import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScrollView from '../../components/ui/SmoothScrollView';
import { API_URL } from '../../config';
import { apiRequest, asList, asObject } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import { useToast } from '../../contexts/ToastContext';

type Props = { onBack?: () => void; isEmployer?: boolean };
type Dispute = {
  id?: string;
  _id?: string;
  ticketId?: string;
  subject?: string;
  investigationStatus?: string;
  settlementStatus?: string;
  paymentStatus?: string;
  workerClaim?: string;
  employerResponse?: string;
  disputedAmount?: number;
  outstandingAmount?: number;
  messages?: { message?: string; createdAt?: string; sender?: { firstName?: string; lastName?: string } }[];
};

const idOf = (item: Dispute) => String(item.id || item._id || '');

export default function FinancialDisputes({ onBack, isEmployer = false }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<Dispute[]>([]);
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [appeal, setAppeal] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiRequest(`${API_URL}/financial-disputes`);
    if (!result.ok) toast.error(result.message || 'Unable to load financial disputes.');
    const list = asList<Dispute>(result.raw, ['disputes']);
    setItems(list);
    setSelected((current) => list.find((item) => idOf(item) === idOf(current || {})) || list[0] || null);
    setLoading(false);
  }, [toast]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const update = async (path: string, body: Record<string, unknown>, success: string) => {
    if (!selected || busy) return;
    setBusy(true);
    const result = await apiRequest(`${API_URL}/financial-disputes/${idOf(selected)}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!result.ok) return toast.error(result.message || 'Unable to update the dispute.');
    const updated = asObject<Dispute>(result.data, ['dispute']) || asObject<Dispute>(result.raw, ['dispute']);
    if (updated) {
      setSelected(updated);
      setItems((current) => current.map((item) => idOf(item) === idOf(updated) ? updated : item));
    }
    toast.success(success);
  };

  const sendMessage = async () => {
    const value = message.trim();
    if (!value) return;
    await update('/messages', { message: value, visibleToParties: true }, 'Message added.');
    setMessage('');
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button"><Text style={styles.back}>Back</Text></TouchableOpacity>
        <Text style={styles.title}>Financial disputes</Text>
        <TouchableOpacity onPress={() => void load()} accessibilityRole="button"><Text style={styles.refresh}>Refresh</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator color={tokens.colors.brand} /> : null}
        {!loading && items.length === 0 ? <Text style={styles.empty}>No financial disputes yet.</Text> : null}
        <View style={styles.list}>
          {items.map((item) => (
            <TouchableOpacity key={idOf(item)} style={[styles.card, selected && idOf(selected) === idOf(item) && styles.selectedCard]} onPress={() => setSelected(item)}>
              <Text style={styles.cardTitle}>{item.ticketId || item.subject || 'Financial dispute'}</Text>
              <Text style={styles.muted}>{item.investigationStatus || 'Pending'} · {item.paymentStatus || item.settlementStatus || 'Under review'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {selected ? (
          <View style={styles.detail}>
            <Text style={styles.sectionTitle}>{selected.subject || selected.ticketId || 'Dispute details'}</Text>
            <Text style={styles.muted}>Disputed: PHP {Number(selected.disputedAmount || 0).toLocaleString()} · Outstanding: PHP {Number(selected.outstandingAmount || 0).toLocaleString()}</Text>
            <Text style={styles.label}>Worker claim</Text><Text style={styles.body}>{selected.workerClaim || 'No claim provided.'}</Text>
            {selected.employerResponse ? <><Text style={styles.label}>Employer response</Text><Text style={styles.body}>{selected.employerResponse}</Text></> : null}
            {(selected.messages || []).map((item, index) => <Text key={`${index}:${item.createdAt}`} style={styles.message}>{item.sender?.firstName || 'Participant'}: {item.message}</Text>)}
            <TextInput value={message} onChangeText={setMessage} placeholder="Add a message" style={styles.input} multiline />
            <TouchableOpacity style={styles.primary} onPress={() => void sendMessage()} disabled={busy}><Text style={styles.primaryText}>Send message</Text></TouchableOpacity>
            {isEmployer ? (
              <>
                <TextInput value={response} onChangeText={setResponse} placeholder="Employer response" style={styles.input} multiline />
                <TouchableOpacity style={styles.secondary} onPress={() => void update('/employer-response', { response: response.trim() }, 'Response submitted.')} disabled={busy || !response.trim()}><Text style={styles.secondaryText}>Submit employer response</Text></TouchableOpacity>
              </>
            ) : null}
            {!isEmployer && selected.investigationStatus === 'RESOLVED' && !selected.settlementStatus?.includes('PAID') ? (
              <>
                <TextInput value={appeal} onChangeText={setAppeal} placeholder="Appeal reason" style={styles.input} multiline />
                <TouchableOpacity style={styles.secondary} onPress={() => void update('/appeal', { reason: appeal.trim() }, 'Appeal submitted.')} disabled={busy || !appeal.trim()}><Text style={styles.secondaryText}>Submit appeal</Text></TouchableOpacity>
              </>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.signedInCanvas },
  header: { paddingTop: 52, paddingHorizontal: 18, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: tokens.colors.surface },
  title: { color: tokens.colors.text, fontSize: 18, fontWeight: '800' },
  back: { color: tokens.colors.brand, fontWeight: '700' },
  refresh: { color: tokens.colors.brand, fontWeight: '700' },
  content: { padding: 18, paddingBottom: 36 },
  list: { gap: 10 },
  card: { padding: 15, borderRadius: 14, backgroundColor: tokens.colors.surface, borderWidth: 1, borderColor: tokens.colors.border },
  selectedCard: { borderColor: tokens.colors.brand },
  cardTitle: { color: tokens.colors.text, fontWeight: '800' },
  muted: { color: tokens.colors.textSubtle, marginTop: 5, fontSize: 12 },
  empty: { color: tokens.colors.textSubtle, textAlign: 'center', marginVertical: 30 },
  detail: { marginTop: 18, padding: 16, borderRadius: 16, backgroundColor: tokens.colors.surface },
  sectionTitle: { color: tokens.colors.text, fontSize: 17, fontWeight: '800' },
  label: { color: tokens.colors.text, fontWeight: '800', marginTop: 16 },
  body: { color: tokens.colors.text, marginTop: 5, lineHeight: 20 },
  message: { color: tokens.colors.text, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: tokens.colors.border },
  input: { minHeight: 48, marginTop: 12, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12, padding: 12, color: tokens.colors.text, backgroundColor: tokens.colors.background },
  primary: { marginTop: 10, padding: 13, borderRadius: 12, backgroundColor: tokens.colors.brand, alignItems: 'center' },
  primaryText: { color: tokens.colors.white, fontWeight: '800' },
  secondary: { marginTop: 10, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.brand, alignItems: 'center' },
  secondaryText: { color: tokens.colors.brand, fontWeight: '800' },
});
