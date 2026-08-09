import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../../components/AppHeader';
import ScrollView from '../../components/ui/SmoothScrollView';
import { tokens } from '../../theme/tokens';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { PasswordChecklist } from '../../components/auth/AuthControls';

export default function ChangePassword({ onBack }: { onBack?: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const toast = useToast();

  const getAuthHeader = async () => {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Please sign in again to continue.');
    }
    return { Authorization: `Bearer ${token}` };
  };

  const handleRequestOtp = async () => {
    if (!currentPassword) {
      toast.error('Enter your current password first.');
      return;
    }

    setIsSubmitting(true);
    try {
      const headers = await getAuthHeader();
      const result = await apiRequest(
        `${API_URL}/auth/password-change/request`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ currentPassword }),
        },
        'Failed to request OTP.'
      );

      if (!result.ok) {
        throw new Error(result.message || 'Failed to request OTP.');
      }

      setOtpRequested(true);
      toast.success('Check your email for the password change OTP code.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to request OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = () => {
    setFieldError('');
    if (!currentPassword || !otpCode || !newPassword || !confirmPassword) {
      toast.error('Complete all fields to continue.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFieldError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      toast.error('New password must be different from your current password.');
      return;
    }
    const strong = newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /\d/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword);
    if (!strong) {
      setFieldError('Your new password does not meet all requirements.');
      return;
    }

    const submit = async () => {
      setIsSubmitting(true);
      try {
        const headers = await getAuthHeader();
        const result = await apiRequest(
          `${API_URL}/auth/password-change/confirm`,
          {
            method: 'POST',
            headers: {
              ...headers,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              currentPassword,
              code: otpCode.trim(),
              newPassword,
            }),
          },
          'Failed to change password.'
        );

        if (!result.ok) {
          throw new Error(result.message || 'Failed to change password.');
        }

        toast.success('Your password has been updated.');
        onBack?.();
      } catch (error: any) {
        toast.error(error?.message || 'Failed to change password.');
      } finally {
        setIsSubmitting(false);
      }
    };

    submit();
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Change Password" subtitle="Update your account credentials" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.label}>Current Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputFlex]}
              secureTextEntry={!showCurrentPassword}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setShowCurrentPassword((prev) => !prev)}>
              <Ionicons name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748b" />
            </TouchableOpacity>
          </View>

          {!otpRequested ? (
            <TouchableOpacity style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]} onPress={handleRequestOtp} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color={tokens.colors.white} /> : <Text style={styles.primaryButtonText}>Send OTP</Text>}
            </TouchableOpacity>
          ) : null}

          {otpRequested ? (
            <>
              <Text style={styles.otpHint}>Enter the OTP sent to your email to continue.</Text>

              <Text style={styles.label}>OTP Code</Text>
              <TextInput
                style={styles.input}
                value={otpCode}
                onChangeText={(value) => setOtpCode(value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                keyboardType="number-pad"
                maxLength={6}
              />

              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  secureTextEntry={!showNewPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowNewPassword((prev) => !prev)}>
                  <Ionicons name={showNewPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter new password"
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowConfirmPassword((prev) => !prev)}>
                  <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              <PasswordChecklist password={newPassword} confirm={confirmPassword} />
              {fieldError ? <Text style={styles.fieldError}>{fieldError}</Text> : null}

              <TouchableOpacity style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]} onPress={handleSave} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color={tokens.colors.white} /> : <Text style={styles.primaryButtonText}>Update Password</Text>}
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 112 },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.lg,
    padding: 16,
    ...tokens.shadow.card,
  },
  label: { fontSize: 13, color: '#374151', fontWeight: '600', marginTop: 8, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: tokens.colors.white,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputFlex: {
    flex: 1,
  },
  eyeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  primaryButton: {
    backgroundColor: tokens.colors.brand,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: { color: tokens.colors.white, fontWeight: '700', fontSize: 14 },
  otpHint: {
    marginTop: 14,
    fontSize: 12,
    color: '#475569',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  fieldError: { color: tokens.colors.danger, fontSize: 12, marginBottom: 4, fontWeight: '600' },
});
