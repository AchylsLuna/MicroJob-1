import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '../../lib/storage';
import { uploadFile } from '../../lib/uploadFile';
import { walletRequest } from '../../lib/lifecycleApi';
import CompletionEvidence from '../../components/CompletionEvidence';
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
  displayStatus?: string;
  caseStatus?: string;
  active?: boolean;
  closedAt?: string | null;
  evidenceDueAt?: string;
  evidence?: any[];
  appealSubmittedAt?: string;
  settlementStatus?: string;
  paymentStatus?: string;
  workerClaim?: string;
  employerResponse?: string;
  disputedAmount?: number;
  outstandingAmount?: number;
  messages?: { body?: string; createdAt?: string; author?: { firstName?: string; lastName?: string } }[];
};

const idOf = (item: Dispute) => String(item.id || item._id || '');

export default function FinancialDisputes({ onBack, isEmployer = false }: Props) {
  const { t } = useTranslation('common');
  const [evidenceStatement, setEvidenceStatement] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [noEvidence, setNoEvidence] = useState(false);
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

  const submitEvidence = async () => {
    if (!selected || busy || (!evidenceFile && !evidenceStatement.trim() && !noEvidence)) return;
    setBusy(true);
    try {
      if (evidenceFile) {
        if ((evidenceFile.size || 0) > 5 * 1024 * 1024) throw new Error(t('lifecycle.evidenceTooLarge'));
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) throw new Error(t('lifecycle.signInRequired'));
        const result = await uploadFile({ url: `${API_URL}/financial-disputes/${idOf(selected)}/evidence`, fileUri: evidenceFile.uri, fieldName: 'evidence', mimeType: evidenceFile.mimeType || 'application/octet-stream', token, parameters: { statement: evidenceStatement, evidenceType: 'OTHER' } });
        if (!result.ok) { let error = t('lifecycle.submissionFailed'); try { error = JSON.parse(result.body).message || error; } catch { /* Keep fallback. */ } throw new Error(error); }
      } else await walletRequest(`/financial-disputes/${idOf(selected)}/evidence`, { statement: evidenceStatement, noEvidence });
      setEvidenceFile(null); setEvidenceStatement(''); setNoEvidence(false); await load();
    } catch (error: any) { toast.error(error.message); }
    finally { setBusy(false); }
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
              <Text style={styles.muted}>{item.caseStatus ? t(`financialWorkflow.states.${item.caseStatus}`) : (item.displayStatus || item.investigationStatus) || 'Pending'} · {item.paymentStatus || item.settlementStatus || 'Under review'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {selected ? (
          <View style={styles.detail}>
            <Text style={styles.sectionTitle}>{selected.subject || selected.ticketId || 'Dispute details'}</Text>
            <Text style={styles.muted}>Disputed: PHP {Number(selected.disputedAmount || 0).toLocaleString()} · Outstanding: PHP {Number(selected.outstandingAmount || 0).toLocaleString()}</Text>
            <Text style={styles.label}>Worker claim</Text><Text style={styles.body}>{selected.workerClaim || 'No claim provided.'}</Text>
            {selected.employerResponse ? <><Text style={styles.label}>Employer response</Text><Text style={styles.body}>{selected.employerResponse}</Text></> : null}
            <CompletionEvidence items={selected.evidence} />
            {selected.evidenceDueAt && <Text style={styles.muted}>{t('financialWorkflow.evidenceDue', { date: new Date(selected.evidenceDueAt).toLocaleString() })}</Text>}
            {selected.active !== false && <>
              <TextInput accessibilityLabel={t('financialWorkflow.evidenceStatement')} placeholder={t('financialWorkflow.evidenceStatement')} value={evidenceStatement} onChangeText={setEvidenceStatement} maxLength={4000} style={styles.input} multiline />
              <TouchableOpacity accessibilityRole="button" style={styles.secondary} disabled={busy} onPress={() => void DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], copyToCacheDirectory: true }).then((result) => { if (!result.canceled) { setEvidenceFile(result.assets[0]); setNoEvidence(false); } })}><Text style={styles.secondaryText}>{evidenceFile?.name || t('financialWorkflow.chooseFile')}</Text></TouchableOpacity>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}><Switch accessibilityLabel={t('financialWorkflow.noEvidence')} value={noEvidence} disabled={busy} onValueChange={(value) => { setNoEvidence(value); if (value) setEvidenceFile(null); }} /><Text style={styles.body}>{t('financialWorkflow.noEvidence')}</Text></View>
              <TouchableOpacity accessibilityRole="button" style={styles.primary} disabled={busy} onPress={() => void submitEvidence()}><Text style={styles.primaryText}>{t('financialWorkflow.sendEvidence')}</Text></TouchableOpacity>
            </>}
            {(selected.messages || []).map((item, index) => <Text key={`${index}:${item.createdAt}`} style={styles.message}>{item.author?.firstName || 'Participant'}: {item.body}</Text>)}
            <TextInput value={message} onChangeText={setMessage} placeholder="Add a message" style={styles.input} multiline />
            <TouchableOpacity style={styles.primary} onPress={() => void sendMessage()} disabled={busy}><Text style={styles.primaryText}>Send message</Text></TouchableOpacity>
            {isEmployer ? (
              <>
                <TextInput value={response} onChangeText={setResponse} placeholder="Employer response" style={styles.input} multiline />
                <TouchableOpacity style={styles.secondary} onPress={() => void update('/employer-response', { response: response.trim() }, 'Response submitted.')} disabled={busy || !response.trim()}><Text style={styles.secondaryText}>Submit employer response</Text></TouchableOpacity>
              </>
            ) : null}
            {selected.investigationStatus === 'RESOLVED' && !selected.appealSubmittedAt && !selected.closedAt ? (
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
