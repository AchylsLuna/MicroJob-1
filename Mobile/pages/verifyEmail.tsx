import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '../lib/storage';
import { Feather } from '@expo/vector-icons';
import { API_URL } from '../config';
import { apiRequest, asObject } from '../lib/api';
import AuthScreenLayout from '../components/auth/AuthScreenLayout';
import AuthStepCard from '../components/auth/AuthStepCard';
import { AuthProgress } from '../components/auth/AuthControls';
import { AUTH_COLORS, clamp } from '../theme/authTheme';
import { useToast } from '../contexts/ToastContext';
import { isValidEmail, normalizeEmail } from '../lib/authValidation';

const TIMER_SECONDS = 30;
const formatSeconds = (value: number) => `0:${Math.max(value, 0).toString().padStart(2, '0')}`;

type Props = {
  email?: string;
  mode?: 'emailVerification' | 'loginOtp' | 'passwordReset';
  otpToken?: string;
  onVerified?: (code?: string) => void;
  onBack?: () => void;
};

export default function VerifyEmail({ email: emailProp, mode = 'emailVerification', otpToken: initialOtpToken = '', onVerified, onBack }: Props) {
  const sendOtpRef = useRef<() => Promise<void>>(async () => undefined);
  const { width: screenWidth, height: screenHeight, fontScale } = useWindowDimensions();
  const [code, setCode] = useState(Array(6).fill(''));
  const [email, setEmail] = useState(emailProp || '');
  const [timer, setTimer] = useState(TIMER_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [otpToken, setOtpToken] = useState(initialOtpToken);
  const toast = useToast();
  const inputs = useRef<Array<TextInput | null>>([]);
  const hasSentRef = useRef(false);

  const horizontalPadding = clamp(screenWidth * 0.05, screenWidth < 360 ? 12 : 16, 24);
  const contentWidth = Math.min(460, screenWidth - horizontalPadding * 2);
  const estimatedCardPadding = clamp(screenWidth * 0.052, 18, 24) * 2;
  const codeAreaWidth = Math.max(220, contentWidth - estimatedCardPadding);
  const otpColumns = fontScale >= 1.5 ? 3 : 6;
  const codeGap = clamp(screenWidth * 0.012, 4, 8);
  const codeCellWidth = clamp(
    (codeAreaWidth - codeGap * (otpColumns - 1)) / otpColumns,
    40,
    otpColumns === 3 ? 80 : 52,
  );
  const codeCellHeight = clamp(screenHeight * 0.066, 46, 54);
  const codeFontSize = clamp(screenWidth * 0.054, 18, 22);
  const buttonHeight = clamp(screenHeight * 0.068, 52, 56);
  const buttonRadius = clamp(buttonHeight * 0.24, 12, 14);
  const buttonFontSize = clamp(screenWidth * 0.043, 15, 17);
  const helperFontSize = clamp(screenWidth * 0.04, 14, 16);
  const statusFontSize = clamp(screenWidth * 0.035, 12, 14);
  const pillRadius = clamp(screenWidth * 0.045, 14, 18);
  const progressHeight = clamp(screenHeight * 0.0065, 4, 6);
  const timerProgress = canResend ? 100 : ((TIMER_SECONDS - timer) / TIMER_SECONDS) * 100;
  const formattedTimer = formatSeconds(timer);

  const commitDigits = (rawValue: string, startIndex: number) => {
    const digits = rawValue.replace(/\D/g, '');
    const next = [...code];

    if (!digits) {
      next[startIndex] = '';
      setCode(next);
      return;
    }

    let cursor = startIndex;
    for (const digit of digits) {
      if (cursor > 5) break;
      next[cursor] = digit;
      cursor += 1;
    }

    setCode(next);
    const firstEmpty = next.findIndex((item) => !item);

    if (firstEmpty >= 0) {
      inputs.current[firstEmpty]?.focus();
      return;
    }

    Keyboard.dismiss();
  };

  const handleChange = (val: string, idx: number) => {
    setErrorMessage('');
    commitDigits(val, idx);
  };

  useEffect(() => {
    const focusTimeout = setTimeout(() => {
      inputs.current[0]?.focus();
      setFocusedIndex(0);
    }, 160);

    return () => clearTimeout(focusTimeout);
  }, []);

  useEffect(() => {
    const loadEmail = async () => {
      if (emailProp) {
        setEmail(emailProp);
        return;
      }
      if (mode === 'loginOtp') {
        setEmail('');
        return;
      }
      const storedEmail = await AsyncStorage.getItem('pending_verification_email');
      setEmail(storedEmail || '');
    };

    loadEmail();
  }, [emailProp, mode]);

  useEffect(() => {
    setOtpToken(initialOtpToken || '');
  }, [initialOtpToken]);

  useEffect(() => {
    if (mode === 'loginOtp') {
      setTimer(TIMER_SECONDS);
      setCanResend(false);
      return;
    }
    if (!email || hasSentRef.current) return;
    const maybeAutoSend = async () => {
      const skipSend = await AsyncStorage.getItem('pending_verification_skip_send');
      if (skipSend === '1') {
        await AsyncStorage.removeItem('pending_verification_skip_send');
        hasSentRef.current = true;
        return;
      }
      hasSentRef.current = true;
      void sendOtpRef.current();
    };
    maybeAutoSend();
  }, [email, mode]);

  useEffect(() => {
    if (!canResend && timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => {
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

  const sendOtp = useCallback(async () => {
    if (mode === 'loginOtp') {
      if (!otpToken) {
        setErrorMessage('Your login verification session expired. Please sign in again.');
        return;
      }

      setIsLoading(true);
      setErrorMessage('');
      try {
        const result = await apiRequest(
          `${API_URL}/auth/login/otp/resend`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ otpToken }),
          },
          'Failed to resend OTP.',
        );

        if (!result.ok) {
          throw new Error(`${result.message || 'Failed to resend OTP.'} (HTTP ${result.status})`);
        }

        const dataPayload = asObject<any>(result.data) || {};
        const rawPayload = asObject<any>(result.raw) || {};
        const renewedToken = dataPayload?.otpToken || rawPayload?.otpToken;
        if (renewedToken) {
          setOtpToken(String(renewedToken));
        }

        setTimer(TIMER_SECONDS);
        setCanResend(false);
        setCode(Array(6).fill(''));
        setFocusedIndex(0);
        inputs.current[0]?.focus();
      } catch (error: any) {
        setErrorMessage(error?.message || 'Failed to resend OTP.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      setErrorMessage('Missing or invalid email. Please sign up again.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const result = await apiRequest(
        mode === 'passwordReset' ? `${API_URL}/auth/password-reset/request` : `${API_URL}/auth/otp/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail }),
        },
        'Failed to send OTP.',
      );

      if (!result.ok) {
        throw new Error(`${result.message || 'Failed to send OTP.'} (HTTP ${result.status})`);
      }

      setTimer(TIMER_SECONDS);
      setCanResend(false);
      setCode(Array(6).fill(''));
      setFocusedIndex(0);
      inputs.current[0]?.focus();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to send OTP.');
    } finally {
      setIsLoading(false);
    }
  }, [email, mode, otpToken]);
  sendOtpRef.current = sendOtp;

  const handleVerify = async () => {
    const otpCode = code.join('');
    if (otpCode.length !== 6) {
      toast.error('Please enter the complete 6-digit code.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      let result;
      if (mode === 'loginOtp') {
        if (!otpToken) {
          throw new Error('Your login verification session expired. Please sign in again.');
        }
        result = await apiRequest(
          `${API_URL}/auth/login/otp/verify`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ otpToken, code: otpCode }),
          },
          'Verification failed.',
        );
      } else if (mode === 'passwordReset') {
        const normalizedEmail = normalizeEmail(email);
        result = await apiRequest(
          `${API_URL}/auth/password-reset/verify`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: normalizedEmail, code: otpCode }) },
          'Reset-code verification failed.',
        );
      } else {
        const normalizedEmail = normalizeEmail(email);
        if (!isValidEmail(normalizedEmail)) {
          toast.error('Missing or invalid email. Please sign in again.');
          setIsLoading(false);
          return;
        }

        result = await apiRequest(
          `${API_URL}/auth/otp/verify`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: normalizedEmail, code: otpCode }),
          },
          'Verification failed.',
        );
      }

      if (!result.ok) {
        throw new Error(`${result.message || 'Verification failed.'} (HTTP ${result.status})`);
      }

      const dataPayload = asObject<any>(result.data) || {};
      const rawPayload = asObject<any>(result.raw) || {};
      const token = dataPayload?.token || rawPayload?.token;
      const user = dataPayload?.user || rawPayload?.user;

      if (token && user) {
        await AsyncStorage.setItem('auth_token', token);
        await AsyncStorage.setItem('auth_user', JSON.stringify(user));
        await AsyncStorage.setItem('has_onboarded', 'true');
      }
      if (mode === 'emailVerification') {
        await AsyncStorage.removeItem('pending_verification_email');
        toast.success('Email verified successfully.');
      } else if (mode === 'loginOtp') {
        toast.success('Login verified successfully.');
      } else {
        toast.success('Reset code verified.');
      }
      onVerified?.(mode === 'passwordReset' ? otpCode : undefined);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthScreenLayout
      title={mode === 'loginOtp' ? 'Verify login' : mode === 'passwordReset' ? 'Check your email' : 'Verify email'}
      subtitle={mode === 'loginOtp' ? 'Enter the 6-digit login code sent to your email.' : mode === 'passwordReset' ? 'Enter the 6-digit reset code we sent you.' : 'Enter the 6-digit code sent to your inbox.'}
      onBack={onBack}
      centered
    >
      {mode === 'passwordReset' ? <AuthProgress step={2} /> : null}
      <View style={[styles.emailPill, { borderRadius: pillRadius }]}>
        <Text style={[styles.emailPillText, { fontSize: helperFontSize }]}>
          {email || 'your email address'}
        </Text>
      </View>

      <AuthStepCard
        step={1}
        title="Verification Code"
        subtitle={mode === 'loginOtp' ? 'Use the login OTP from your email.' : 'Use the OTP from your email.'}
        style={styles.primaryCard}
      >
        {errorMessage ? (
          <Text style={[styles.errorText, { fontSize: clamp(helperFontSize * 0.95, 13, 14) }]}>
            {errorMessage}
          </Text>
        ) : null}

        <View style={styles.timerWrap}>
          <View style={[styles.progressTrack, { height: progressHeight, borderRadius: progressHeight }]}>
            <View
              style={[
                styles.progressFill,
                {
                  height: progressHeight,
                  borderRadius: progressHeight,
                  width: `${Math.max(0, Math.min(timerProgress, 100))}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.timerMetaText, { fontSize: statusFontSize }]}>
            {canResend ? 'You can request a new code now.' : `Resend available in ${formattedTimer}`}
          </Text>
        </View>

        <View style={[styles.codeRow, { gap: codeGap }]}>
          {code.map((value, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputs.current[index] = ref;
              }}

              style={[
                styles.codeBox,
                { width: codeCellWidth, minHeight: codeCellHeight, fontSize: codeFontSize, borderRadius: codeCellHeight * 0.22 },
                focusedIndex === index ? styles.codeBoxFocused : null,
                value ? styles.codeBoxFilled : null,
              ]}
              value={value}
              onChangeText={(nextValue) => handleChange(nextValue, index)}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex((prev) => (prev === index ? -1 : prev))}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
                  inputs.current[index - 1]?.focus();
                }
              }}
              keyboardType="number-pad"
              maxLength={6}
              returnKeyType={index === 5 ? 'done' : 'next'}
              textAlign="center"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              accessibilityLabel={`Verification code digit ${index + 1}`}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, { minHeight: buttonHeight, borderRadius: buttonRadius }, isLoading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={AUTH_COLORS.primaryText} />
          ) : (
            <Text style={[styles.buttonText, { fontSize: buttonFontSize }]}>
              Verify Code
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.resendButton,
            { borderRadius: clamp(buttonRadius * 0.8, 12, 14) },
            (!canResend || isLoading) && styles.resendButtonDisabled,
          ]}
          onPress={sendOtp}
          disabled={!canResend || isLoading}
        >
          <Feather name="refresh-cw" size={clamp(helperFontSize + 1, 14, 16)} color={AUTH_COLORS.linkLight} />
          <Text style={[styles.resendButtonText, { fontSize: helperFontSize }]}>
            {canResend ? 'Resend Code' : `Resend in ${formattedTimer}`}
          </Text>
        </TouchableOpacity>
      </AuthStepCard>

    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  primaryCard: {
    marginBottom: 12,
  },
  emailPill: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputDarkBorder,
    backgroundColor: AUTH_COLORS.inputDark,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
    maxWidth: '100%',
  },
  emailPillText: {
    color: AUTH_COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
    flexShrink: 1,
  },
  errorText: {
    marginBottom: 12,
    color: '#991B1B',
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  timerWrap: {
    marginBottom: 14,
  },
  progressTrack: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    backgroundColor: AUTH_COLORS.primary,
  },
  timerMetaText: {
    color: AUTH_COLORS.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  codeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  codeBox: {
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputDarkBorder,
    backgroundColor: AUTH_COLORS.inputDark,
    textAlign: 'center',
    color: AUTH_COLORS.textPrimary,
    fontWeight: '700',
    paddingVertical: 8,
  },
  codeBoxFocused: {
    borderColor: AUTH_COLORS.primary,
    backgroundColor: 'rgba(28,77,141,0.16)',
  },
  codeBoxFilled: {
    borderColor: AUTH_COLORS.cardBorderActive,
  },
  button: {
    backgroundColor: AUTH_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: AUTH_COLORS.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  buttonText: {
    color: AUTH_COLORS.primaryText,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  resendButton: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputDarkBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  resendButtonDisabled: {
    opacity: 0.65,
  },
  resendButtonText: {
    color: AUTH_COLORS.linkLight,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
});
