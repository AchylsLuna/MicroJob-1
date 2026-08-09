import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '../../lib/storage';
import AppHeader from '../../components/AppHeader';
import ScrollView from '../../components/ui/SmoothScrollView';
import { tokens } from '../../theme/tokens';
import { API_URL } from '../../config';
import { apiRequest, asObject } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

type MFAStatus = {
  enabled: boolean;
  method: string | null;
  backupCodesRemaining: number;
  hasPendingSetup: boolean;
};

const defaultStatus: MFAStatus = {
  enabled: false,
  method: null,
  backupCodesRemaining: 0,
  hasPendingSetup: false,
};

export default function MFA({ onBack }: { onBack?: () => void }) {
  const [status, setStatus] = useState<MFAStatus>(defaultStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const toast = useToast();

  const authHeaders = async () => {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Not authenticated. Please sign in again.');
    }
    return { Authorization: `Bearer ${token}` };
  };

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const headers = await authHeaders();
      const result = await apiRequest(`${API_URL}/auth/mfa/status`, { headers }, 'Failed to load MFA status.');
      if (!result.ok) {
        throw new Error(result.message || 'Failed to load MFA status.');
      }
      const payload = asObject<any>(result.data) || asObject<any>(result.raw) || {};
      setStatus({
        enabled: Boolean(payload.enabled),
        method: payload.method || null,
        backupCodesRemaining: Number(payload.backupCodesRemaining || 0),
        hasPendingSetup: Boolean(payload.hasPendingSetup),
      });
      if (!payload.hasPendingSetup) {
        setSecret('');
        setOtpauthUrl('');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Unable to load MFA status.');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleSetup = async () => {
    setIsSubmitting(true);
    try {
      const headers = await authHeaders();
      const result = await apiRequest(
        `${API_URL}/auth/mfa/setup`,
        { method: 'POST', headers },
        'Failed to start MFA setup.'
      );
      if (!result.ok) {
        throw new Error(result.message || 'Failed to start MFA setup.');
      }
      const payload = asObject<any>(result.data) || asObject<any>(result.raw) || {};
      setSecret(payload.secret || '');
      setOtpauthUrl(payload.otpauthUrl || '');
      setBackupCodes([]);
      setCode('');
      toast.info('Use the secret key in your authenticator app, then enter your code below.');
      await loadStatus();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to start MFA setup.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnable = async () => {
    if (!code.trim()) {
      toast.error('Enter the verification code from your authenticator app.');
      return;
    }

    setIsSubmitting(true);
    try {
      const headers = await authHeaders();
      const result = await apiRequest(
        `${API_URL}/auth/mfa/enable`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code: code.trim() }),
        },
        'Failed to enable MFA.'
      );
      if (!result.ok) {
        throw new Error(result.message || 'Failed to enable MFA.');
      }
      const payload = asObject<any>(result.data) || asObject<any>(result.raw) || {};
      setBackupCodes(Array.isArray(payload.backupCodes) ? payload.backupCodes : []);
      setCode('');
      setSecret('');
      setOtpauthUrl('');
      toast.success('MFA enabled successfully.');
      await loadStatus();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to enable MFA.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisable = async () => {
    if (!code.trim()) {
      toast.error('Enter your current authenticator or backup code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const headers = await authHeaders();
      const result = await apiRequest(
        `${API_URL}/auth/mfa/disable`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code: code.trim() }),
        },
        'Failed to disable MFA.'
      );
      if (!result.ok) {
        throw new Error(result.message || 'Failed to disable MFA.');
      }
      setCode('');
      setBackupCodes([]);
      setSecret('');
      setOtpauthUrl('');
      toast.success('MFA disabled.');
      await loadStatus();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to disable MFA.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegenerateCodes = async () => {
    if (!code.trim()) {
      toast.error('Enter your current authenticator or backup code first.');
      return;
    }

    setIsSubmitting(true);
    try {
      const headers = await authHeaders();
      const result = await apiRequest(
        `${API_URL}/auth/mfa/backup-codes/regenerate`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code: code.trim() }),
        },
        'Failed to regenerate backup codes.'
      );
      if (!result.ok) {
        throw new Error(result.message || 'Failed to regenerate backup codes.');
      }
      const payload = asObject<any>(result.data) || asObject<any>(result.raw) || {};
      setBackupCodes(Array.isArray(payload.backupCodes) ? payload.backupCodes : []);
      setCode('');
      toast.success('Backup codes regenerated.');
      await loadStatus();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to regenerate backup codes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Two-Factor Auth" subtitle="Extra account protection" onBack={onBack} />

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={tokens.colors.brand} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>MFA Status</Text>
            <Text style={styles.sectionSubtitle}>
              {status.enabled ? 'Enabled' : 'Not enabled'} {status.method ? `(${status.method})` : ''}
            </Text>
            <Text style={styles.sectionSubtitle}>
              Backup codes remaining: {status.backupCodesRemaining}
            </Text>
            {!status.enabled ? (
              <TouchableOpacity
                style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
                onPress={handleSetup}
                disabled={isSubmitting}
              >
                <Text style={styles.primaryButtonText}>
                  {status.hasPendingSetup ? 'Regenerate Setup Secret' : 'Start MFA Setup'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.dangerButton, isSubmitting && styles.buttonDisabled]}
                onPress={handleDisable}
                disabled={isSubmitting}
              >
                <Text style={styles.dangerButtonText}>Disable MFA</Text>
              </TouchableOpacity>
            )}
          </View>

          {(status.hasPendingSetup || secret) && !status.enabled ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Authenticator Setup</Text>
              <Text style={styles.sectionSubtitle}>
                Add this secret key in Google Authenticator / Microsoft Authenticator.
              </Text>
              <Text selectable style={styles.secretText}>{secret || 'Secret key loading...'}</Text>
              {otpauthUrl ? <Text style={styles.urlHint}>URI: {otpauthUrl}</Text> : null}
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Verification</Text>
            <Text style={styles.sectionSubtitle}>
              Enter authenticator code (or backup code) for enable/disable/regenerate actions.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="123456 or AAAA-BBBB"
              placeholderTextColor={tokens.colors.textSubtle}
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
            />
            {!status.enabled ? (
              <TouchableOpacity
                style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
                onPress={handleEnable}
                disabled={isSubmitting}
              >
                <Text style={styles.primaryButtonText}>Enable MFA</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.secondaryButton, isSubmitting && styles.buttonDisabled]}
                onPress={handleRegenerateCodes}
                disabled={isSubmitting}
              >
                <Text style={styles.secondaryButtonText}>Regenerate Backup Codes</Text>
              </TouchableOpacity>
            )}
          </View>

          {backupCodes.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Backup Codes</Text>
              <Text style={styles.sectionSubtitle}>Store these somewhere safe. Each code works once.</Text>
              <View style={styles.codesBox}>
                {backupCodes.map((backupCode) => (
                  <Text key={backupCode} style={styles.codeText}>{backupCode}</Text>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 112 },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.lg,
    padding: 16,
    marginBottom: 16,
    ...tokens.shadow.card,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: tokens.colors.text, marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: tokens.colors.textMuted, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#d9e0ea',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: tokens.colors.text,
    marginBottom: 12,
    backgroundColor: '#f8fafc',
  },
  primaryButton: {
    backgroundColor: tokens.colors.brand,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: tokens.colors.white, fontSize: 14, fontWeight: '700' },
  secondaryButton: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#1e3a8a', fontSize: 14, fontWeight: '700' },
  dangerButton: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerButtonText: { color: '#b91c1c', fontSize: 14, fontWeight: '700' },
  buttonDisabled: {
    opacity: 0.6,
  },
  secretText: {
    fontSize: 16,
    letterSpacing: 0.8,
    color: '#0f172a',
    fontWeight: '700',
    marginBottom: 8,
  },
  urlHint: {
    fontSize: 11,
    color: '#64748b',
  },
  codesBox: {
    marginTop: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  codeText: {
    fontSize: 12,
    color: tokens.colors.text,
    fontWeight: '700',
    marginBottom: 6,
  },
});
