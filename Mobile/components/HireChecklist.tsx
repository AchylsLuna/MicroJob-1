import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import ScrollView from './ui/SmoothScrollView';
import { tokens } from '../theme/tokens';
import { walletRequest } from '../lib/lifecycleApi';
import { apiRequest, asList } from '../lib/api';
import AsyncStorage from '../lib/storage';
import { API_URL } from '../config';

export function HireChecklistDialog({ title, description, warning, onConfirm, onClose }: { title: string; description?: string; warning?: string; onConfirm: (checklist: string[]) => Promise<void>; onClose: () => void }) {
  const { t } = useTranslation('common');
  const [enabled, setEnabled] = useState(false);
  const [rows, setRows] = useState([{ id: 0, description: '' }]);
  const sequence = useRef(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  return <Modal visible transparent onRequestClose={() => { if (!busy) onClose(); }}>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.dialog} accessibilityViewIsModal><ScrollView keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{title}</Text>{description ? <Text style={styles.text}>{description}</Text> : null}<Text style={styles.warning}>{warning || t('hireChecklist.hireWarning')}</Text>
      <View style={styles.row}><Switch value={enabled} disabled={busy} onValueChange={setEnabled} accessibilityLabel={t('hireChecklist.include')} /><Text style={[styles.text, styles.description]}>{t('hireChecklist.include')}</Text></View>
      {enabled ? <View>
        <Text style={styles.text}>{t('hireChecklist.hint')}</Text>
        <View style={styles.row}><Text style={styles.done}>{t('hireChecklist.done')}</Text><Text style={[styles.text, styles.description]}>{t('hireChecklist.description')}</Text></View>
        {rows.map((row, index) => <View style={styles.row} key={row.id}>
          <View style={styles.check}><Ionicons name="square-outline" color={tokens.colors.textMuted} size={22} /></View>
          <TextInput multiline maxLength={500} editable={!busy} value={row.description} onChangeText={(value) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, description: value } : item))} accessibilityLabel={t('hireChecklist.descriptionRow', { number: index + 1 })} style={[styles.input, styles.description]} />
          <TouchableOpacity accessibilityRole="button" disabled={busy} accessibilityLabel={t('hireChecklist.removeRow')} style={styles.check} onPress={() => setRows((current) => current.filter((item) => item.id !== row.id))}><Ionicons name="trash-outline" size={20} color={tokens.colors.textMuted} /></TouchableOpacity>
        </View>)}
        <TouchableOpacity accessibilityRole="button" disabled={busy || rows.length >= 20} style={styles.button} onPress={() => setRows((current) => [...current, { id: sequence.current++, description: '' }])}><Ionicons name="add" size={20} color={tokens.colors.white} /><Text style={styles.buttonText}>{t('hireChecklist.addRow')}</Text></TouchableOpacity>
      </View> : null}
      {error ? <Text accessibilityRole="alert" style={styles.text}>{error}</Text> : null}
      <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.button} onPress={async () => {
        if (lock.current) return;
        const checklist = enabled ? rows.map((row) => row.description.trim()).filter(Boolean) : [];
        if (enabled && !checklist.length) { setError(t('hireChecklist.empty')); return; }
        lock.current = true; setBusy(true); setError('');
        try { await onConfirm(checklist); onClose(); }
        catch (caught: any) { setError(caught.message); }
        finally { lock.current = false; setBusy(false); }
      }}><Text style={styles.buttonText}>{t('hireChecklist.confirmHire')}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.cancel} onPress={onClose}><Text style={styles.text}>{t('lifecycle.cancelCompletion')}</Text></TouchableOpacity>
    </ScrollView></View></KeyboardAvoidingView>
  </Modal>;
}

export function ChecklistTable({ items }: { items: string[] }) {
  const { t } = useTranslation('common');
  if (!items.length) return <Text style={styles.text}>{t('hireChecklist.none')}</Text>;
  return <View><View style={styles.row}><Text style={styles.done}>#</Text><Text style={[styles.text, styles.description]}>{t('hireChecklist.description')}</Text></View>{items.map((description, index) => <View style={styles.row} key={index}><Text style={styles.done}>{index + 1}</Text><Text style={[styles.text, styles.description]}>{description}</Text></View>)}</View>;
}

export function HiredWorkerChecklists({ jobId }: { jobId: string }) {
  const { t } = useTranslation('common');
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void (async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const result = await apiRequest(`${API_URL}/applications/employer?jobId=${encodeURIComponent(jobId)}&includeHidden=true`, { headers: { Authorization: `Bearer ${token}` } });
        if (!result.ok) throw new Error(result.message);
        if (active) setWorkers(asList<any>(result.data || result.raw).filter((item) => ['Hired', 'Accepted'].includes(item.status)));
      } catch (caught: any) { if (active) setError(caught.message); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [jobId]);
  return <View><Text style={styles.title}>{t('hireChecklist.hiredWorkers')}</Text>
    {loading ? <Text style={styles.text}>{t('hireChecklist.loading')}</Text> : workers.length === 0 ? <Text style={styles.text}>{t('hireChecklist.noWorkers')}</Text> : workers.map((worker) => <View key={worker._id} style={styles.worker}>
      <Text style={styles.title}>{`${worker.applicant?.firstName || ''} ${worker.applicant?.lastName || ''}`.trim() || t('hireChecklist.worker')}</Text>
      {worker.hireChecklist?.length ? <View><View style={styles.row}><Text style={styles.done}>{t('hireChecklist.done')}</Text><Text style={[styles.text, styles.description]}>{t('hireChecklist.description')}</Text></View>{worker.hireChecklist.map((item: any, index: number) => <View style={styles.row} key={item._id}>
        <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: item.completed, disabled: busy }} accessibilityLabel={t('hireChecklist.doneRow', { number: index + 1 })} disabled={busy} style={styles.check} onPress={async () => {
          if (lock.current) return;
          lock.current = true; setBusy(true); setError('');
          try { const result = await walletRequest(`/applications/${worker._id}/checklist/${item._id}`, { completed: !item.completed }, 'PATCH'); setWorkers((current) => current.map((entry) => entry._id === worker._id ? { ...entry, hireChecklist: result.checklist } : entry)); }
          catch (caught: any) { setError(caught.message); }
          finally { lock.current = false; setBusy(false); }
        }}><Ionicons name={item.completed ? 'checkbox' : 'square-outline'} size={23} color={tokens.colors.brand} /></TouchableOpacity><Text style={[styles.text, styles.description]}>{item.description}</Text>
      </View>)}</View> : <Text style={styles.text}>{t('hireChecklist.none')}</Text>}
    </View>)}
    {error ? <Text accessibilityRole="alert" style={styles.text}>{error}</Text> : null}
    <Text style={styles.text}>{t('hireChecklist.trackingOnly')}</Text>
  </View>;
}
const styles = StyleSheet.create({ title: { color: tokens.colors.text, fontWeight: '700', marginVertical: 8 }, text: { color: tokens.colors.text, marginVertical: 7 }, warning: { color: tokens.colors.text, backgroundColor: tokens.colors.warningSoft, padding: 12, borderRadius: tokens.radius.sm, marginVertical: 8 }, overlay: { flex: 1, justifyContent: 'center', backgroundColor: tokens.colors.brandDark, padding: 20 }, dialog: { maxHeight: '90%', backgroundColor: tokens.colors.surface, padding: 18, borderRadius: tokens.radius.card }, row: { flexDirection: 'row', alignItems: 'flex-start', borderBottomWidth: 1, borderColor: tokens.colors.border, paddingVertical: 6 }, done: { width: 48, color: tokens.colors.text, paddingTop: 8 }, check: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, description: { flex: 1, minWidth: 0 }, input: { color: tokens.colors.text, minHeight: 50, padding: 10, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.radius.sm }, button: { minHeight: 44, padding: 12, backgroundColor: tokens.colors.brand, borderRadius: tokens.radius.sm, marginVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, buttonText: { color: tokens.colors.white, fontWeight: '700' }, cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, worker: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.radius.sm, padding: 10, marginVertical: 8 } });
