import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import { apiRequest, asObject } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import { isValidProfilePhone, normalizeProfilePhone } from '../../lib/profileValidation';

type Props = {
  savedPhone: string;
  draftPhone: string;
  onVerified?: () => Promise<void> | void;
};

const RESEND_SECONDS = 60;

const safeError = (status: number, message: string, fallback: string) => {
  if (status === 0) return 'Unable to connect. Check your internet connection and try again.';
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 429) return 'Too many attempts. Please wait before trying again.';
  if (status >= 500) return fallback;
  return message && !/https?:\/\//i.test(message) ? message : fallback;
};

export default function PhoneVerificationCard({ savedPhone, draftPhone, onVerified }: Props) {
  const [verified, setVerified] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState<'send' | 'confirm' | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [expiresInSec, setExpiresInSec] = useState(300);
  const [devCode, setDevCode] = useState('');
  const mountedRef = useRef(true);
  const requestRef = useRef(false);

  const normalizedSaved = normalizeProfilePhone(savedPhone);
  const normalizedDraft = normalizeProfilePhone(draftPhone);
  const hasSavedPhone = isValidProfilePhone(normalizedSaved);
  const needsSave = normalizedDraft !== normalizedSaved;

  const authHeaders = useCallback(async () => {
    const token = await AsyncStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : null;
  }, []);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const result = await apiRequest(`${API_URL}/auth/verification/status`, { headers }, 'Failed to check phone verification.');
      if (!mountedRef.current) return;
      if (!result.ok) {
        setError(safeError(result.status, result.message, 'Failed to check phone verification.'));
        return;
      }
      const payload = asObject<any>(result.data) || asObject<any>(result.raw) || {};
      const phoneStep = Array.isArray(payload.steps) ? payload.steps.find((step: any) => step?.id === 'phone') : null;
      setVerified(phoneStep?.status === 'complete');
    } finally {
      if (mountedRef.current) setStatusLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    mountedRef.current = true;
    void loadStatus();
    return () => {
      mountedRef.current = false;
      requestRef.current = false;
    };
  }, [loadStatus, normalizedSaved]);

  useEffect(() => {
    if (!needsSave) return;
    setCodeSent(false);
    setCode('');
    setError('');
    setDevCode('');
  }, [needsSave, normalizedDraft]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const sendCode = async () => {
    if (requestRef.current || busyAction || needsSave || !hasSavedPhone || verified) return;
    requestRef.current = true;
    setBusyAction('send');
    setError('');
    try {
      const headers = await authHeaders();
      if (!headers) {
        setError('Your session has expired. Please sign in again.');
        return;
      }
      const result = await apiRequest(
        `${API_URL}/auth/verification/phone`,
        { method: 'POST', headers },
        'Failed to send verification code.',
      );
      if (!result.ok) {
        setError(safeError(result.status, result.message, 'Failed to send verification code.'));
        return;
      }
      const payload = asObject<any>(result.data) || asObject<any>(result.raw) || {};
      if (payload.verified) {
        setVerified(true);
        await onVerified?.();
        return;
      }
      setCodeSent(true);
      setMaskedPhone(String(payload.phoneMasked || normalizedSaved));
      setExpiresInSec(Number(payload.expiresInSec) || 300);
      setSecondsLeft(RESEND_SECONDS);
      setDevCode(typeof __DEV__ !== 'undefined' && __DEV__ ? String(payload.devCode || '') : '');
    } finally {
      requestRef.current = false;
      if (mountedRef.current) setBusyAction(null);
    }
  };

  const confirmCode = async () => {
    if (requestRef.current || busyAction || code.length !== 6) return;
    requestRef.current = true;
    setBusyAction('confirm');
    setError('');
    try {
      const headers = await authHeaders();
      if (!headers) {
        setError('Your session has expired. Please sign in again.');
        return;
      }
      const result = await apiRequest(
        `${API_URL}/auth/verification/phone/confirm`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        },
        'Failed to verify phone number.',
      );
      if (!result.ok) {
        setError(safeError(result.status, result.message, 'The code could not be verified.'));
        return;
      }
      setVerified(true);
      setCodeSent(false);
      setCode('');
      setSecondsLeft(0);
      setDevCode('');
      await onVerified?.();
    } finally {
      requestRef.current = false;
      if (mountedRef.current) setBusyAction(null);
    }
  };

  const statusText = needsSave
    ? 'Save number first'
    : verified
      ? 'Verified'
      : hasSavedPhone
        ? 'Not verified'
        : 'Add a phone number';

  return (
    <View style={styles.card} accessibilityLabel={`Phone verification: ${statusText}`}>
      <View style={styles.headingRow}>
        <View style={[styles.icon, verified && styles.iconVerified]}>
          <Ionicons name={verified ? 'checkmark-circle' : 'shield-checkmark-outline'} size={21} color={verified ? '#08785A' : tokens.colors.brand} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Phone verification</Text>
          <Text style={[styles.status, verified && styles.statusVerified]}>{statusLoading ? 'Checking status…' : statusText}</Text>
        </View>
        {!verified && !statusLoading ? (
          <TouchableOpacity
            style={[styles.sendButton, (needsSave || !hasSavedPhone || Boolean(busyAction) || secondsLeft > 0) && styles.disabled]}
            onPress={sendCode}
            disabled={needsSave || !hasSavedPhone || Boolean(busyAction) || secondsLeft > 0}
            accessibilityRole="button"
            accessibilityLabel={codeSent ? 'Resend verification code' : 'Send verification code'}
          >
            {busyAction === 'send' ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
              <Text style={styles.sendText}>{codeSent ? (secondsLeft > 0 ? `Resend ${secondsLeft}s` : 'Resend') : 'Send code'}</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      {needsSave ? <Text style={styles.help}>Save your new number before requesting a verification code.</Text> : null}
      {codeSent && !verified ? (
        <View style={styles.otpArea}>
          <Text style={styles.help}>Enter the 6-digit code sent to {maskedPhone}. It expires in {Math.max(1, Math.round(expiresInSec / 60))} minutes.</Text>
          <View style={styles.otpRow}>
            <TextInput
              style={styles.otpInput}
              value={code}
              onChangeText={(value) => { setCode(value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor="#94A3B8"
              accessibilityLabel="Six digit phone verification code"
            />
            <TouchableOpacity
              style={[styles.confirmButton, (code.length !== 6 || Boolean(busyAction)) && styles.disabled]}
              onPress={confirmCode}
              disabled={code.length !== 6 || Boolean(busyAction)}
              accessibilityRole="button"
              accessibilityLabel="Confirm phone verification code"
            >
              {busyAction === 'confirm' ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.sendText}>Verify</Text>}
            </TouchableOpacity>
          </View>
          {devCode ? <Text style={styles.devCode}>Development code: {devCode}</Text> : null}
        </View>
      ) : null}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 10, padding: 14, borderRadius: 16, backgroundColor: tokens.colors.cardSoft },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  iconVerified: { backgroundColor: '#DDF7ED' },
  headingCopy: { flex: 1, minWidth: 0 },
  title: { color: tokens.colors.text, fontSize: 15, fontWeight: '800' },
  status: { marginTop: 2, color: '#6B7280', fontSize: 12, fontWeight: '600' },
  statusVerified: { color: '#08785A' },
  sendButton: { minHeight: 44, minWidth: 92, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.brand },
  confirmButton: { minHeight: 52, minWidth: 86, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.brand },
  disabled: { opacity: 0.45 },
  sendText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  help: { marginTop: 10, color: '#526071', fontSize: 12, lineHeight: 18 },
  otpArea: { marginTop: 2 },
  otpRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  otpInput: { flex: 1, minHeight: 52, borderRadius: 14, paddingHorizontal: 16, backgroundColor: '#FFFFFF', color: tokens.colors.text, fontSize: 20, fontWeight: '800', letterSpacing: 8, textAlign: 'center' },
  error: { marginTop: 10, color: '#A11B1B', fontSize: 12, lineHeight: 17 },
  devCode: { marginTop: 8, color: '#7C3AED', fontSize: 12, fontWeight: '700' },
});
