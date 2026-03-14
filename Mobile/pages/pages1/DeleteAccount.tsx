import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppHeader from '../../components/AppHeader';
import { API_URL } from '../../config';
import { apiRequest, asList } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import { useToast } from '../../contexts/ToastContext';

type DeletionBlocker = {
  code: string;
  message: string;
  count: number;
};

type DeleteAccountProps = {
  onBack?: () => void;
  onDeleted?: () => Promise<void> | void;
};

export default function DeleteAccount({ onBack, onDeleted }: DeleteAccountProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [blockers, setBlockers] = useState<DeletionBlocker[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const handleDeleteAccount = async () => {
    if (!currentPassword) {
      setErrorMessage('Enter your current password to continue.');
      return;
    }
    if (confirmText.trim().toUpperCase() !== 'DELETE') {
      setErrorMessage('Type DELETE exactly to confirm this action.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setBlockers([]);

    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/auth/me/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          currentPassword,
          confirm: confirmText.trim().toUpperCase(),
        }),
      }, 'Failed to delete account.');

      if (!result.ok) {
        const nextBlockers = asList<DeletionBlocker>(result.raw, ['blockers']);
        if (nextBlockers.length > 0) {
          setBlockers(nextBlockers);
        }
        throw new Error(result.message || 'Failed to delete account.');
      }

      setCurrentPassword('');
      setConfirmText('');
      toast.success('Account deleted. Signing out...');
      setTimeout(() => {
        void onDeleted?.();
      }, 500);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to delete account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Delete Account" subtitle="Soft delete with blocker checks" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Before you continue</Text>
          <Text style={styles.warningBody}>
            Deletion is only allowed when balances are zero, payout requests are resolved, and active jobs or applications are closed.
          </Text>
          <View style={styles.warningList}>
            <Text style={styles.warningItem}>Current sessions are revoked after deletion.</Text>
            <Text style={styles.warningItem}>Personal identifiers are anonymized for audit retention.</Text>
            <Text style={styles.warningItem}>Saved jobs and push devices are removed automatically.</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Confirm account deletion</Text>
          <Text style={styles.cardSubtitle}>Enter your password and type DELETE to confirm.</Text>

          <Text style={styles.label}>Current Password</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Current password"
            placeholderTextColor={tokens.colors.textSubtle}
            secureTextEntry
            autoCapitalize="none"
          />

          <Text style={styles.label}>Confirmation</Text>
          <TextInput
            style={styles.input}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="Type DELETE"
            placeholderTextColor={tokens.colors.textSubtle}
            autoCapitalize="characters"
          />

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <TouchableOpacity
            style={[styles.dangerButton, isSubmitting && styles.dangerButtonDisabled]}
            onPress={handleDeleteAccount}
            disabled={isSubmitting}
          >
            {isSubmitting ? <ActivityIndicator color={tokens.colors.white} /> : <Text style={styles.dangerButtonText}>Delete My Account</Text>}
          </TouchableOpacity>
        </View>

        {blockers.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Resolve these blockers first</Text>
            <Text style={styles.cardSubtitle}>The backend rejected deletion until the following conditions are cleared.</Text>
            <View style={styles.blockerList}>
              {blockers.map((blocker) => (
                <View key={blocker.code} style={styles.blockerRow}>
                  <View style={styles.blockerCount}>
                    <Text style={styles.blockerCountText}>{blocker.count}</Text>
                  </View>
                  <View style={styles.blockerContent}>
                    <Text style={styles.blockerTitle}>{blocker.code.replace(/_/g, ' ')}</Text>
                    <Text style={styles.blockerMessage}>{blocker.message}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
    gap: 16,
  },
  warningCard: {
    backgroundColor: '#1F2937',
    borderRadius: 22,
    padding: 18,
    ...tokens.shadow.card,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: tokens.colors.white,
  },
  warningBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#D1D5DB',
  },
  warningList: {
    marginTop: 14,
    gap: 8,
  },
  warningItem: {
    color: '#F9FAFB',
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    ...tokens.shadow.card,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: tokens.colors.textMuted,
  },
  label: {
    marginTop: 14,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: tokens.colors.text,
    fontSize: 14,
  },
  errorText: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 17,
    color: '#B91C1C',
  },
  dangerButton: {
    marginTop: 18,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.danger,
  },
  dangerButtonDisabled: {
    opacity: 0.7,
  },
  dangerButtonText: {
    color: tokens.colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  blockerList: {
    marginTop: 14,
    gap: 12,
  },
  blockerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  blockerCount: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FCA5A5',
  },
  blockerCountText: {
    color: '#7F1D1D',
    fontSize: 12,
    fontWeight: '800',
  },
  blockerContent: {
    flex: 1,
  },
  blockerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B',
    textTransform: 'capitalize',
  },
  blockerMessage: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: '#7F1D1D',
  },
});
