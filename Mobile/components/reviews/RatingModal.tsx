import React, { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import { apiRequest } from '../../lib/api';
import { tokens } from '../../theme/tokens';

export type MobileRatingTarget = {
  applicationId: string;
  name: string;
  jobTitle: string;
  roleLabel: 'worker' | 'employer';
};

export default function RatingModal({
  target,
  onClose,
  onSubmitted,
}: {
  target: MobileRatingTarget | null;
  onClose: () => void;
  onSubmitted: () => void | Promise<void>;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    if (submitting) return;
    setRating(0);
    setComment('');
    setError('');
    onClose();
  };

  const submit = async () => {
    if (!target || !rating) {
      setError('Choose a rating from 1 to 5 stars.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const trimmedComment = comment.trim();
      const result = await apiRequest(`${API_URL}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          applicationId: target.applicationId,
          rating,
          ...(trimmedComment ? { comment: trimmedComment } : {}),
        }),
      }, 'Failed to submit review.');
      if (!result.ok) throw new Error(result.message || 'Failed to submit review.');
      await onSubmitted();
      setRating(0);
      setComment('');
      setError('');
      onClose();
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={Boolean(target)} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headingCopy}>
              <Text style={styles.title}>Rate {target?.roleLabel}</Text>
              <Text style={styles.subtitle}>{target?.name} · {target?.jobTitle}</Text>
            </View>
            <TouchableOpacity onPress={close} style={styles.closeButton} accessibilityLabel="Close rating dialog">
              <Ionicons name="close" size={20} color={tokens.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Overall rating</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <TouchableOpacity key={value} onPress={() => setRating(value)} style={styles.starButton} accessibilityLabel={`${value} stars`}>
                <Ionicons name={value <= rating ? 'star' : 'star-outline'} size={34} color={value <= rating ? '#F59E0B' : '#CBD5E1'} />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Written comment <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.input}
            value={comment}
            onChangeText={(value) => setComment(value.slice(0, 2000))}
            placeholder="Optional: share something about your experience."
            placeholderTextColor={tokens.colors.textSubtle}
            multiline
            maxLength={2000}
            textAlignVertical="top"
          />
          <Text style={styles.counter}>{comment.length}/2000</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={close} disabled={submitting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitButton, (!rating || submitting) && styles.disabled]} onPress={submit} disabled={!rating || submitting}>
              {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Submit rating</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: tokens.colors.surface, borderRadius: 22, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headingCopy: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: tokens.colors.text },
  subtitle: { marginTop: 4, fontSize: 13, color: tokens.colors.textMuted },
  closeButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.surfaceMuted },
  label: { marginTop: 18, fontSize: 13, fontWeight: '700', color: tokens.colors.text },
  optional: { fontWeight: '400', color: tokens.colors.textSubtle },
  stars: { flexDirection: 'row', gap: 4, marginTop: 8 },
  starButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 120, marginTop: 8, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 14, padding: 12, color: tokens.colors.text, fontSize: 14 },
  counter: { marginTop: 4, textAlign: 'right', fontSize: 11, color: tokens.colors.textSubtle },
  error: { marginTop: 8, fontSize: 12, color: tokens.colors.danger },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelButton: { minHeight: 46, justifyContent: 'center', borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12, paddingHorizontal: 16 },
  cancelText: { color: tokens.colors.text, fontSize: 13, fontWeight: '700' },
  submitButton: { minHeight: 46, minWidth: 130, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingHorizontal: 16, backgroundColor: tokens.colors.brand },
  submitText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.5 },
});
