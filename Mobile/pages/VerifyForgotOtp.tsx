import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { API_URL } from '../config';
import { apiRequest } from '../lib/api';

type Props = {
  email: string;
  onVerified?: (email: string, code: string) => void;
  onBack?: () => void;
};

export default function VerifyForgotOtp({ email, onVerified, onBack }: Props) {
  const [code, setCode] = useState(Array(6).fill(''));
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const inputs = useRef<TextInput[]>([]);
  const hasSentRef = useRef(false);

  const handleChange = (val: string, idx: number) => {
    const digit = val.slice(-1);
    const next = [...code];
    next[idx] = digit;
    setCode(next);
    if (digit && idx < 5) inputs.current[idx + 1]?.focus();
  };

  useEffect(() => {
    if (!email || hasSentRef.current) return;
    hasSentRef.current = true;
    // Auto-send OTP when component mounts
  }, [email]);

  useEffect(() => {
    if (!canResend && timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev: number) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer, canResend]);

  const sendOtp = async () => {
    if (!email) {
      setErrorMessage('Missing email. Please try again.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const result = await apiRequest(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }, 'Failed to send reset code.');

      if (!result.ok) {
        throw new Error(`${result.message || 'Failed to send reset code.'} (HTTP ${result.status})`);
      }

      setTimer(30);
      setCanResend(false);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to send reset code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    const otpCode = code.join('');
    if (otpCode.length !== 6) {
      Alert.alert('Error', 'Please enter the complete 6-digit code.');
      return;
    }

    if (!email) {
      Alert.alert('Error', 'Missing email. Please try again.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const result = await apiRequest(`${API_URL}/auth/verify-reset-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode }),
      }, 'Verification failed.');

      if (!result.ok) {
        throw new Error(`${result.message || 'Verification failed.'} (HTTP ${result.status})`);
      }

      // Pass email and code to parent for the next step (create new password)
      onVerified?.(email, otpCode);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.card}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.iconWrap}>
          <View style={styles.icon}>
            <Text style={styles.iconText}>🔐</Text>
          </View>
        </View>

        <Text style={styles.title}>Verify Reset Code</Text>
        <Text style={styles.subtitle}>We've sent a 6-digit code to</Text>
        <Text style={styles.email}>{email || 'your email'}</Text>

        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}

        <View style={styles.codeRow}>
          {code.map((c: string, i: number) => (
            <View key={i} style={{ width: 44 }}>
              <TextInput
                ref={(r: TextInput | null) => {
                  if (r) inputs.current[i] = r;
                }}
                style={styles.codeBox}
                value={c}
                onChangeText={(v: string) => handleChange(v, i)}
                keyboardType="number-pad"
                maxLength={1}
                returnKeyType="next"
              />
            </View>
          ))}
        </View>

        <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleVerify} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify Code</Text>}
        </TouchableOpacity>

        <View style={styles.resendRow}>
          <Text style={styles.resendText}>Didn't receive the code? </Text>
          {canResend ? (
            <TouchableOpacity onPress={sendOtp} disabled={isLoading}>
              <Text style={styles.resendLink}>Resend Code</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.resendLink}>Resend Code (0:{timer.toString().padStart(2, '0')})</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const CARD_MAX_WIDTH = 360;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a2847',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  iconWrap: {
    marginBottom: 20,
    shadowColor: '#d88cf7',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#0a2847',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 34,
    color: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  email: {
    fontSize: 13,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  codeBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f2f2f2',
    textAlign: 'center',
    fontSize: 18,
    color: '#111',
  },
  button: {
    width: '100%',
    backgroundColor: '#0a2847',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendText: {
    fontSize: 13,
    color: '#666',
  },
  resendLink: {
    fontSize: 13,
    color: '#0a5ac7',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  errorText: {
    marginTop: 8,
    marginBottom: 12,
    color: '#b91c1c',
    fontSize: 12,
    textAlign: 'center',
  },
  backBtn: {
    position: 'absolute',
    top: 12,
    left: 12,
    padding: 8,
    zIndex: 1,
  },
  backIcon: {
    fontSize: 20,
    color: '#111',
  },
});
