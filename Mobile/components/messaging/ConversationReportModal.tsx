import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import { apiRequest } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import { useToast } from '../../contexts/ToastContext';

const reasons = ['abuse', 'scam', 'threats', 'other'] as const;
type Reason = typeof reasons[number];

export function ConversationReportModal({ userId, name, jobId, onClose }: { userId: string; name: string; jobId?: string; onClose: () => void }) {
  const { t } = useTranslation('employer');
  const toast = useToast();
  const [reason, setReason] = useState<Reason | ''>('');
  const [details, setDetails] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const close = () => { if (!pending) onClose(); };

  const submit = async () => {
    if (!reason || pending) return;
    setPending(true);
    setError('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/messages/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ otherUserId: userId, jobId: jobId || null, category: reason, details: details.trim() }),
      }, t('chatScreen.report.failed'));
      if (!result.ok) throw new Error(result.message || t('chatScreen.report.failed'));
      toast.success(t((result.data as { alreadyPending?: boolean })?.alreadyPending ? 'chatScreen.report.alreadyPending' : 'chatScreen.report.success'));
      onClose();
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : t('chatScreen.report.failed'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.overlay} keyboardShouldPersistTaps="handled">
          <View style={styles.card} accessibilityViewIsModal>
            <Text style={styles.title} accessibilityRole="header">{t('chatScreen.report.title', { name })}</Text>
            <Text style={styles.copy}>{t('chatScreen.report.description')}</Text>
            <Text style={styles.label}>{t('chatScreen.report.reason')}</Text>
            {reasons.map((value) => (
              <TouchableOpacity key={value} disabled={pending} onPress={() => setReason(value)} style={styles.option} accessibilityRole="radio" accessibilityState={{ checked: value === reason, disabled: pending }} accessibilityLabel={t(`chatScreen.report.reasons.${value}`)}>
                <Ionicons name={value === reason ? 'radio-button-on' : 'radio-button-off'} size={22} color={tokens.colors.brand} />
                <Text style={styles.optionCopy}>{t(`chatScreen.report.reasons.${value}`)}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.label}>{t('chatScreen.report.details')}</Text>
            <TextInput value={details} onChangeText={setDetails} editable={!pending} multiline maxLength={1500} textAlignVertical="top" accessibilityLabel={t('chatScreen.report.details')} style={styles.input} />
            <Text style={styles.notice}>{t('chatScreen.report.evidenceNotice')}</Text>
            {error ? <Text style={styles.error} accessibilityLiveRegion="assertive">{error}</Text> : null}
            <View style={styles.actions}>
              <TouchableOpacity onPress={close} disabled={pending} style={styles.cancel} accessibilityRole="button" accessibilityState={{ disabled: pending }}><Text style={styles.optionCopy}>{t('chatScreen.report.cancel')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => void submit()} disabled={!reason || pending} style={[styles.submit, (!reason || pending) && styles.disabled]} accessibilityRole="button" accessibilityLabel={t('chatScreen.report.submit')} accessibilityState={{ disabled: !reason || pending, busy: pending }}>
                {pending ? <ActivityIndicator color={tokens.colors.onBrand} /> : <Text style={styles.submitCopy}>{t('chatScreen.report.submit')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.58)' },
  overlay: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: tokens.spacing.lg },
  card: { width: '100%', maxWidth: 480, borderRadius: tokens.radius.card, padding: tokens.spacing.lg, backgroundColor: tokens.colors.surface },
  title: { fontSize: tokens.typography.h3, fontWeight: '700', color: tokens.colors.text },
  copy: { marginTop: tokens.spacing.sm, color: tokens.colors.textMuted, lineHeight: 21 },
  label: { marginTop: tokens.spacing.lg, marginBottom: tokens.spacing.xs, fontWeight: '700', color: tokens.colors.text },
  option: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, minHeight: 44, paddingVertical: tokens.spacing.xs },
  optionCopy: { flexShrink: 1, color: tokens.colors.text, fontSize: tokens.typography.body },
  input: { minHeight: 88, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.radius.sm, padding: tokens.spacing.sm, color: tokens.colors.text },
  notice: { marginTop: tokens.spacing.md, borderRadius: tokens.radius.sm, padding: tokens.spacing.sm, backgroundColor: tokens.colors.warningSoft, color: tokens.colors.text, lineHeight: 20 },
  error: { marginTop: tokens.spacing.sm, color: tokens.colors.danger },
  actions: { marginTop: tokens.spacing.lg, flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm, justifyContent: 'flex-end' },
  cancel: { minHeight: 44, justifyContent: 'center', paddingHorizontal: tokens.spacing.md },
  submit: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: tokens.spacing.md, borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.brand },
  submitCopy: { color: tokens.colors.onBrand, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
