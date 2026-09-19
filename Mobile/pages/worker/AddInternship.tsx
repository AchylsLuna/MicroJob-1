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

export type InternshipDraft = {
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string | null;
  current: boolean;
  description: string;
};

type AddInternshipProps = {
  visible: boolean;
  onClose?: () => void;
  onAdd?: (data: InternshipDraft) => Promise<void> | void;
  initialValue?: InternshipDraft | null;
};

const initialDraft: InternshipDraft = {
  title: '',
  company: '',
  location: '',
  startDate: '',
  endDate: '',
  current: false,
  description: '',
};

const isValidMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value.trim());

/**
 * Deliberately mirrors AddExperience.tsx line for line -- an internship carries
 * the same field set as work experience, so the add/edit UX should feel identical
 * rather than introduce a second pattern for the same shape of data.
 */
export default function AddInternship({ visible, onClose, onAdd, initialValue }: AddInternshipProps) {
  const { t } = useTranslation('worker');
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<InternshipDraft>(initialDraft);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(initialValue ? { ...initialValue } : initialDraft);
      setError('');
    }
  }, [visible, initialValue]);

  const updateDraft = <K extends keyof InternshipDraft>(key: K, value: InternshipDraft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    if (error) setError('');
  };

  const handleAddInternship = async () => {
    if (!draft.title.trim() || !draft.company.trim()) {
      setError(t('addInternship.errors.titleCompanyRequired'));
      return;
    }
    if (!isValidMonth(draft.startDate)) {
      setError(t('addInternship.errors.invalidStartDate'));
      return;
    }
    if (!draft.current && (!draft.endDate || !isValidMonth(draft.endDate))) {
      setError(t('addInternship.errors.invalidEndDate'));
      return;
    }
    if (draft.endDate && draft.endDate < draft.startDate) {
      setError(t('addInternship.errors.endBeforeStart'));
      return;
    }
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (draft.startDate > currentMonth || (!draft.current && String(draft.endDate) > currentMonth)) {
      setError(t('addInternship.errors.futureDates'));
      return;
    }
    if (
      draft.title.trim().length > PROFILE_LIMITS.internshipTitle ||
      draft.company.trim().length > PROFILE_LIMITS.internshipCompany ||
      draft.location.trim().length > PROFILE_LIMITS.internshipLocation ||
      draft.description.trim().length > PROFILE_LIMITS.internshipDescription
    ) {
      setError(t('addInternship.errors.fieldTooLong'));
      return;
    }

    setIsSaving(true);
    try {
      await onAdd?.({
        ...draft,
        title: draft.title.trim(),
        company: draft.company.trim(),
        location: draft.location.trim(),
        endDate: draft.current ? null : draft.endDate,
        description: draft.description.trim(),
      });
      onClose?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('addInternship.errors.saveFailed'));
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
        <View style={[styles.modal, { paddingBottom: 24 + Math.max(insets.bottom, 8) }]} accessibilityViewIsModal accessibilityLabel={initialValue ? t('addInternship.modalTitle.edit') : t('addInternship.modalTitle.add')}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.modalTitle} accessibilityRole="header">{initialValue ? t('addInternship.modalTitle.edit') : t('addInternship.modalTitle.add')}</Text>
              <Text style={styles.modalSubtitle}>{initialValue ? t('addInternship.modalSubtitle.edit') : t('addInternship.modalSubtitle.add')}</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('addInternship.close')}>
              <Text style={styles.closeText}>{t('addInternship.close')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Field label={t('addInternship.fields.title')} value={draft.title} onChangeText={(value) => updateDraft('title', value)} placeholder={t('addInternship.fields.titlePlaceholder')} maxLength={PROFILE_LIMITS.internshipTitle} />
            <Field label={t('addInternship.fields.company')} value={draft.company} onChangeText={(value) => updateDraft('company', value)} placeholder={t('addInternship.fields.companyPlaceholder')} maxLength={PROFILE_LIMITS.internshipCompany} />
            <Field label={t('addInternship.fields.location')} value={draft.location} onChangeText={(value) => updateDraft('location', value)} placeholder={t('addInternship.fields.locationPlaceholder')} maxLength={PROFILE_LIMITS.internshipLocation} />

            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Field label={t('addInternship.fields.startDate')} value={draft.startDate} onChangeText={(value) => updateDraft('startDate', value)} placeholder={t('addInternship.fields.datePlaceholder')} keyboardType="numbers-and-punctuation" maxLength={7} />
              </View>
              <View style={styles.dateField}>
                <Field label={t('addInternship.fields.endDate')} value={draft.endDate || ''} onChangeText={(value) => updateDraft('endDate', value)} placeholder={t('addInternship.fields.datePlaceholder')} keyboardType="numbers-and-punctuation" maxLength={7} editable={!draft.current} />
              </View>
            </View>

            <View style={styles.currentRow}>
              <Text style={styles.currentLabel}>{t('addInternship.current.label')}</Text>
              <Switch
                value={draft.current}
                onValueChange={(value) => setDraft((previous) => ({ ...previous, current: value, endDate: value ? '' : previous.endDate }))}
                accessibilityLabel={t('addInternship.current.label')}
                accessibilityRole="switch"
                accessibilityState={{ checked: draft.current }}
                trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
                thumbColor={draft.current ? '#1C4D8D' : tokens.colors.background}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('addInternship.description.label')}</Text>
              <TextInput
                style={[styles.input, styles.descriptionInput]}
                value={draft.description}
                onChangeText={(value) => updateDraft('description', value)}
                placeholder={t('addInternship.description.placeholder')}
                placeholderTextColor="#94A3B8"
                maxLength={PROFILE_LIMITS.internshipDescription}
                multiline
                textAlignVertical="top"
                accessibilityLabel={t('addInternship.description.accessibilityLabel')}
              />
              <Text style={styles.characterCount}>{t('addInternship.characterCount', { count: draft.description.length, max: PROFILE_LIMITS.internshipDescription })}</Text>
            </View>

            {error ? <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="assertive">{error}</Text> : null}

            <TouchableOpacity style={[styles.addButton, isSaving && styles.addButtonDisabled]} onPress={handleAddInternship} disabled={isSaving} accessibilityRole="button" accessibilityLabel={initialValue ? t('addInternship.save.update') : t('addInternship.save.save')} accessibilityState={{ disabled: isSaving, busy: isSaving }}>
              {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.addButtonText}>{initialValue ? t('addInternship.save.update') : t('addInternship.save.save')}</Text>}
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
  descriptionInput: { minHeight: 96, paddingTop: 13, paddingBottom: 13 },
  characterCount: { alignSelf: 'flex-end', color: '#64748B', fontSize: 12, marginTop: 5 },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateField: { flex: 1 },
  currentRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, backgroundColor: tokens.colors.contentMuted, paddingHorizontal: 14 },
  currentLabel: { fontSize: 14, fontWeight: '600', color: '#334155' },
  errorText: { color: '#B91C1C', fontSize: 13, lineHeight: 18, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12 },
  addButton: { minHeight: 50, backgroundColor: tokens.colors.brand, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  addButtonDisabled: { opacity: 0.65 },
  addButtonText: { color: tokens.colors.surface, fontSize: 15, fontWeight: '800' },
});
