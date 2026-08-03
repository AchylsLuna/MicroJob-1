import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PROFILE_LIMITS } from '../../lib/profileValidation';
import { tokens } from '../../theme/tokens';

export type ExperienceDraft = {
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string | null;
  current: boolean;
  description: string;
};

type AddExperienceProps = {
  visible: boolean;
  onClose?: () => void;
  onAdd?: (data: ExperienceDraft) => Promise<void> | void;
  initialValue?: ExperienceDraft | null;
};

const initialDraft: ExperienceDraft = {
  title: '',
  company: '',
  location: '',
  startDate: '',
  endDate: '',
  current: false,
  description: '',
};

const isValidMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value.trim());

export default function AddExperience({ visible, onClose, onAdd, initialValue }: AddExperienceProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<ExperienceDraft>(initialDraft);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(initialValue ? { ...initialValue } : initialDraft);
      setError('');
    }
  }, [visible, initialValue]);

  const updateDraft = <K extends keyof ExperienceDraft>(key: K, value: ExperienceDraft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    if (error) setError('');
  };

  const handleAddExperience = async () => {
    if (!draft.title.trim() || !draft.company.trim()) {
      setError('Job title and company or client are required.');
      return;
    }
    if (!isValidMonth(draft.startDate)) {
      setError('Enter the start date as YYYY-MM.');
      return;
    }
    if (!draft.current && (!draft.endDate || !isValidMonth(draft.endDate))) {
      setError('Enter the end date as YYYY-MM or mark this as your current role.');
      return;
    }
    if (draft.endDate && draft.endDate < draft.startDate) {
      setError('End date cannot be before start date.');
      return;
    }
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (draft.startDate > currentMonth || (!draft.current && String(draft.endDate) > currentMonth)) {
      setError('Work experience dates cannot be in the future.');
      return;
    }
    if (
      draft.title.trim().length > PROFILE_LIMITS.experienceTitle ||
      draft.company.trim().length > PROFILE_LIMITS.experienceCompany ||
      draft.location.trim().length > PROFILE_LIMITS.experienceLocation ||
      draft.description.trim().length > PROFILE_LIMITS.experienceDescription
    ) {
      setError('One or more fields exceed the allowed length.');
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
      setError(saveError instanceof Error ? saveError.message : 'Could not save work experience.');
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
        <View style={[styles.modal, { paddingBottom: 24 + Math.max(insets.bottom, 8) }]} accessibilityViewIsModal accessibilityLabel={initialValue ? 'Edit work experience' : 'Add work experience'}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.modalTitle} accessibilityRole="header">{initialValue ? 'Edit work experience' : 'Add work experience'}</Text>
              <Text style={styles.modalSubtitle}>{initialValue ? 'Keep this role accurate and up to date.' : 'Add a job, client project, or self-employment role.'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close add experience">
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Field label="Job title *" value={draft.title} onChangeText={(value) => updateDraft('title', value)} placeholder="e.g., Math tutor" maxLength={PROFILE_LIMITS.experienceTitle} />
            <Field label="Company or client *" value={draft.company} onChangeText={(value) => updateDraft('company', value)} placeholder="e.g., Self-employed" maxLength={PROFILE_LIMITS.experienceCompany} />
            <Field label="Location" value={draft.location} onChangeText={(value) => updateDraft('location', value)} placeholder="City or Remote" maxLength={PROFILE_LIMITS.experienceLocation} />

            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Field label="Start date *" value={draft.startDate} onChangeText={(value) => updateDraft('startDate', value)} placeholder="YYYY-MM" keyboardType="numbers-and-punctuation" maxLength={7} />
              </View>
              <View style={styles.dateField}>
                <Field label="End date *" value={draft.endDate || ''} onChangeText={(value) => updateDraft('endDate', value)} placeholder="YYYY-MM" keyboardType="numbers-and-punctuation" maxLength={7} editable={!draft.current} />
              </View>
            </View>

            <View style={styles.currentRow}>
              <Text style={styles.currentLabel}>I currently work here</Text>
              <Switch
                value={draft.current}
                onValueChange={(value) => setDraft((previous) => ({ ...previous, current: value, endDate: value ? '' : previous.endDate }))}
                accessibilityLabel="I currently work here"
                accessibilityRole="switch"
                accessibilityState={{ checked: draft.current }}
                trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
                thumbColor={draft.current ? '#1C4D8D' : tokens.colors.background}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.descriptionInput]}
                value={draft.description}
                onChangeText={(value) => updateDraft('description', value)}
                placeholder="Describe your responsibilities and results"
                placeholderTextColor="#94A3B8"
                maxLength={PROFILE_LIMITS.experienceDescription}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Experience description"
              />
              <Text style={styles.characterCount}>{draft.description.length}/{PROFILE_LIMITS.experienceDescription}</Text>
            </View>

            {error ? <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="assertive">{error}</Text> : null}

            <TouchableOpacity style={[styles.addButton, isSaving && styles.addButtonDisabled]} onPress={handleAddExperience} disabled={isSaving} accessibilityRole="button" accessibilityLabel={initialValue ? 'Update experience' : 'Save experience'} accessibilityState={{ disabled: isSaving, busy: isSaving }}>
              {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.addButtonText}>{initialValue ? 'Update experience' : 'Save experience'}</Text>}
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
  currentRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, backgroundColor: tokens.colors.background, paddingHorizontal: 14 },
  currentLabel: { fontSize: 14, fontWeight: '600', color: '#334155' },
  errorText: { color: '#B91C1C', fontSize: 13, lineHeight: 18, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12 },
  addButton: { minHeight: 50, backgroundColor: tokens.colors.brand, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  addButtonDisabled: { opacity: 0.65 },
  addButtonText: { color: tokens.colors.surface, fontSize: 15, fontWeight: '800' },
});
