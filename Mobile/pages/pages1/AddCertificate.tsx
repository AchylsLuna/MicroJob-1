import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import ScrollView from '../../components/ui/SmoothScrollView';
import { PROFILE_LIMITS } from '../../lib/profileValidation';
import { tokens } from '../../theme/tokens';

export type CertificateDraft = {
  name: string;
  issuer: string;
  issueDate: string;
  /** null means "does not expire", distinct from "left blank by mistake". */
  expiryDate: string | null;
  credentialId: string;
  credentialUrl: string;
};

type AddCertificateProps = {
  visible: boolean;
  onClose?: () => void;
  onAdd?: (data: CertificateDraft) => Promise<void> | void;
  initialValue?: CertificateDraft | null;
};

const initialDraft: CertificateDraft = {
  name: '',
  issuer: '',
  issueDate: '',
  expiryDate: '',
  credentialId: '',
  credentialUrl: '',
};

const isValidMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value.trim());

const isValidCredentialUrl = (value: string) => {
  const raw = value.trim();
  if (!raw) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return false;
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && isLocal);
  } catch {
    return false;
  }
};

export default function AddCertificate({ visible, onClose, onAdd, initialValue }: AddCertificateProps) {
  const { t } = useTranslation('worker');
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<CertificateDraft>(initialDraft);
  const [neverExpires, setNeverExpires] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      const next = initialValue ? { ...initialValue } : initialDraft;
      setDraft(next);
      setNeverExpires(Boolean(initialValue) && !initialValue?.expiryDate);
      setError('');
    }
  }, [visible, initialValue]);

  const updateDraft = <K extends keyof CertificateDraft>(key: K, value: CertificateDraft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    if (error) setError('');
  };

  const handleAddCertificate = async () => {
    if (!draft.name.trim() || !draft.issuer.trim()) {
      setError(t('addCertificate.errors.nameIssuerRequired'));
      return;
    }
    if (!isValidMonth(draft.issueDate)) {
      setError(t('addCertificate.errors.invalidIssueDate'));
      return;
    }
    if (!neverExpires && draft.expiryDate && !isValidMonth(draft.expiryDate)) {
      setError(t('addCertificate.errors.invalidExpiryDate'));
      return;
    }
    if (!neverExpires && draft.expiryDate && draft.expiryDate < draft.issueDate) {
      setError(t('addCertificate.errors.expiryBeforeIssue'));
      return;
    }
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (draft.issueDate > currentMonth) {
      setError(t('addCertificate.errors.futureIssueDate'));
      return;
    }
    if (
      draft.name.trim().length > PROFILE_LIMITS.certificateName ||
      draft.issuer.trim().length > PROFILE_LIMITS.certificateIssuer ||
      draft.credentialId.trim().length > PROFILE_LIMITS.certificateCredentialId ||
      draft.credentialUrl.trim().length > PROFILE_LIMITS.certificateCredentialUrl
    ) {
      setError(t('addCertificate.errors.fieldTooLong'));
      return;
    }
    if (!isValidCredentialUrl(draft.credentialUrl)) {
      setError(t('addCertificate.errors.invalidCredentialUrl'));
      return;
    }

    setIsSaving(true);
    try {
      await onAdd?.({
        ...draft,
        name: draft.name.trim(),
        issuer: draft.issuer.trim(),
        credentialId: draft.credentialId.trim(),
        credentialUrl: draft.credentialUrl.trim(),
        expiryDate: neverExpires ? null : draft.expiryDate,
      });
      onClose?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('addCertificate.errors.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 12 : 0}
      >
        <View style={styles.overlay} accessible={false} />
        <View style={[styles.modal, { paddingBottom: 24 + Math.max(insets.bottom, 8) }]} accessibilityViewIsModal accessibilityLabel={initialValue ? t('addCertificate.modalTitle.edit') : t('addCertificate.modalTitle.add')}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.modalTitle} accessibilityRole="header">{initialValue ? t('addCertificate.modalTitle.edit') : t('addCertificate.modalTitle.add')}</Text>
              <Text style={styles.modalSubtitle}>{initialValue ? t('addCertificate.modalSubtitle.edit') : t('addCertificate.modalSubtitle.add')}</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('addCertificate.close')}>
              <Text style={styles.closeText}>{t('addCertificate.close')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Field label={t('addCertificate.fields.name')} value={draft.name} onChangeText={(value) => updateDraft('name', value)} placeholder={t('addCertificate.fields.namePlaceholder')} maxLength={PROFILE_LIMITS.certificateName} />
            <Field label={t('addCertificate.fields.issuer')} value={draft.issuer} onChangeText={(value) => updateDraft('issuer', value)} placeholder={t('addCertificate.fields.issuerPlaceholder')} maxLength={PROFILE_LIMITS.certificateIssuer} />

            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Field label={t('addCertificate.fields.issueDate')} value={draft.issueDate} onChangeText={(value) => updateDraft('issueDate', value)} placeholder={t('addCertificate.fields.datePlaceholder')} keyboardType="numbers-and-punctuation" maxLength={7} />
              </View>
              <View style={styles.dateField}>
                <Field label={t('addCertificate.fields.expiryDate')} value={draft.expiryDate || ''} onChangeText={(value) => updateDraft('expiryDate', value)} placeholder={t('addCertificate.fields.datePlaceholder')} keyboardType="numbers-and-punctuation" maxLength={7} editable={!neverExpires} />
              </View>
            </View>

            <View style={styles.currentRow}>
              <Text style={styles.currentLabel}>{t('addCertificate.noExpiry.label')}</Text>
              <Switch
                value={neverExpires}
                onValueChange={(value) => { setNeverExpires(value); if (value) updateDraft('expiryDate', ''); }}
                accessibilityLabel={t('addCertificate.noExpiry.label')}
                accessibilityRole="switch"
                accessibilityState={{ checked: neverExpires }}
                trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
                thumbColor={neverExpires ? '#1C4D8D' : tokens.colors.background}
              />
            </View>

            <Field label={t('addCertificate.fields.credentialId')} value={draft.credentialId} onChangeText={(value) => updateDraft('credentialId', value)} placeholder={t('addCertificate.fields.credentialIdPlaceholder')} maxLength={PROFILE_LIMITS.certificateCredentialId} />
            <Field label={t('addCertificate.fields.credentialUrl')} value={draft.credentialUrl} onChangeText={(value) => updateDraft('credentialUrl', value)} placeholder={t('addCertificate.fields.credentialUrlPlaceholder')} maxLength={PROFILE_LIMITS.certificateCredentialUrl} keyboardType="url" autoCapitalize="none" autoCorrect={false} />

            {error ? <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="assertive">{error}</Text> : null}

            <TouchableOpacity style={[styles.addButton, isSaving && styles.addButtonDisabled]} onPress={handleAddCertificate} disabled={isSaving} accessibilityRole="button" accessibilityLabel={initialValue ? t('addCertificate.save.update') : t('addCertificate.save.save')} accessibilityState={{ disabled: isSaving, busy: isSaving }}>
              {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.addButtonText}>{initialValue ? t('addCertificate.save.update') : t('addCertificate.save.save')}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & { label: string };

function Field({ label, style, ...props }: FieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, style]} placeholderTextColor="#94A3B8" accessibilityLabel={props.accessibilityLabel || label.replace(' *', '')} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  overlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.55)' },
  modal: { backgroundColor: tokens.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 22, maxHeight: '92%' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  modalSubtitle: { marginTop: 4, fontSize: 13, color: '#64748B', maxWidth: 270 },
  closeText: { fontSize: 14, fontWeight: '700', color: tokens.colors.brand, paddingVertical: 3 },
  scroll: { gap: 15, paddingBottom: 8 },
  fieldGroup: { gap: 7 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155' },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingHorizontal: 14, color: '#0F172A', backgroundColor: tokens.colors.surface, fontSize: 15 },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateField: { flex: 1 },
  currentRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, backgroundColor: tokens.colors.contentMuted, paddingHorizontal: 14 },
  currentLabel: { fontSize: 14, fontWeight: '600', color: '#334155' },
  errorText: { color: '#B91C1C', fontSize: 13, lineHeight: 18, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12 },
  addButton: { minHeight: 50, backgroundColor: tokens.colors.brand, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  addButtonDisabled: { opacity: 0.65 },
  addButtonText: { color: tokens.colors.surface, fontSize: 15, fontWeight: '800' },
});
