import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import AppHeader from '../../components/AppHeader';
import { tokens } from '../../theme/tokens';

const backupCodesSeed = ['A7X9-B2Q1', 'F5K3-9L1P', 'D4M8-7R2T', 'H9J2-0W4Z'];

export default function MFA({ onBack }: { onBack?: () => void }) {
  const [enabled, setEnabled] = useState(false);
  const [method, setMethod] = useState<'Authenticator' | 'SMS' | 'Email'>('Authenticator');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    Alert.alert('Two-Factor Authentication', next ? 'MFA enabled.' : 'MFA disabled.');
  };

  const handleGenerateCodes = () => {
    setBackupCodes(backupCodesSeed);
    Alert.alert('Backup Codes', 'New backup codes generated.');
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Two-Factor Auth" subtitle="Extra account protection" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>MFA Status</Text>
          <Text style={styles.sectionSubtitle}>Protect your account with an extra layer of security.</Text>
          <TouchableOpacity style={[styles.toggle, enabled && styles.toggleActive]} onPress={handleToggle}>
            <Text style={[styles.toggleText, enabled && styles.toggleTextActive]}>
              {enabled ? 'Enabled' : 'Enable MFA'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Authentication Method</Text>
          <Text style={styles.sectionSubtitle}>Choose how you want to receive verification codes.</Text>
          <View style={styles.methodRow}>
            {['Authenticator', 'SMS', 'Email'].map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.methodChip, method === option && styles.methodChipActive]}
                onPress={() => setMethod(option as 'Authenticator' | 'SMS' | 'Email')}
              >
                <Text style={[styles.methodText, method === option && styles.methodTextActive]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {enabled && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Use {method} as your primary verification method. Setup instructions will appear in your account.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Backup Codes</Text>
          <Text style={styles.sectionSubtitle}>Use these if you lose access to your device.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleGenerateCodes}>
            <Text style={styles.primaryButtonText}>Generate Backup Codes</Text>
          </TouchableOpacity>
          {backupCodes.length > 0 && (
            <View style={styles.codesBox}>
              {backupCodes.map((code) => (
                <Text key={code} style={styles.codeText}>{code}</Text>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 100 },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.lg,
    padding: 16,
    marginBottom: 16,
    ...tokens.shadow.card,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: tokens.colors.text, marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: tokens.colors.textMuted, marginBottom: 12 },
  toggle: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: tokens.colors.brand },
  toggleText: { color: tokens.colors.textMuted, fontWeight: '600' },
  toggleTextActive: { color: tokens.colors.white },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  methodChipActive: { backgroundColor: tokens.colors.brand },
  methodText: { fontSize: 12, color: tokens.colors.textMuted, fontWeight: '600' },
  methodTextActive: { color: tokens.colors.white },
  infoBox: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  infoText: { fontSize: 12, color: '#1e3a8a' },
  primaryButton: {
    backgroundColor: tokens.colors.brand,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: tokens.colors.white, fontSize: 14, fontWeight: '600' },
  codesBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  codeText: { fontSize: 12, color: '#111827', fontWeight: '600', marginBottom: 6 },
});
