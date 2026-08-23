import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../config';
import ScrollView from '../components/ui/SmoothScrollView';
import CanvasBackButton from '../components/ui/CanvasBackButton';
import MicroJobsLogo from '../components/auth/MicroJobsLogo';
import AsyncStorage from '../lib/storage';
import { apiRequest, asObject } from '../lib/api';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AUTH_COLORS, clamp, getAuthMetrics } from '../theme/authTheme';
import { useToast } from '../contexts/ToastContext';
import { isValidEmail, normalizeEmail } from '../lib/authValidation';

export default function SignIn({
  onBack,
  onNavigateToSignUp,
  onNavigateToForgot,
  onNavigateToVerify,
  onLogin,
}: {
  onBack: () => void;
  onNavigateToSignUp?: () => void;
  onNavigateToForgot?: () => void;
  onNavigateToVerify?: (params?: { mode?: 'emailVerification' | 'loginOtp'; email?: string; otpToken?: string }) => void;
  onLogin?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight, fontScale } = useWindowDimensions();
  const metrics = getAuthMetrics(screenWidth, screenHeight, fontScale);
  const horizontalPadding = metrics.horizontalPadding;
  const topPadding = Math.max(insets.top, 10) + clamp(screenHeight * 0.04, metrics.compactHeight ? 10 : 18, 28);
  const cardMaxWidth = Math.min(metrics.contentMaxWidth, screenWidth - horizontalPadding * 2);
  const cardRadius = clamp(screenWidth * 0.085, 26, 32);
  const cardVerticalPadding = clamp(screenHeight * 0.032, 22, 28);
  const cardHorizontalPadding = clamp(screenWidth * 0.065, 22, 28);
  const backButtonSize = 44;
  const titleFontSize = clamp(screenWidth * 0.07, 26, 30);
  const subtitleFontSize = clamp(screenWidth * 0.038, 14, 15);
  const fieldHeight = clamp(screenHeight * 0.068, 50, 56);
  const fieldRadius = clamp(fieldHeight * 0.24, 12, 14);
  const fieldIconSize = clamp(screenWidth * 0.049, 18, 20);
  const inputFontSize = clamp(screenWidth * 0.04, 14, 15);
  const buttonHeight = clamp(screenHeight * 0.068, 50, 56);
  const buttonRadius = clamp(buttonHeight * 0.23, 12, 14);
  const buttonFontSize = clamp(screenWidth * 0.043, 15, 16);
  const helperFontSize = clamp(screenWidth * 0.039, 13, 14);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; mfa?: string }>({});
  const toast = useToast();
  const { t } = useTranslation('auth');

  const continueAfterPrimaryAuth = async (token: string, user: any, refreshToken?: string) => {
    if (!token || !user) {
      throw new Error('Invalid login response.');
    }

    await completeLogin(token, user, refreshToken);
  };

  const completeLogin = async (token: string, user: any, refreshToken?: string) => {
    await AsyncStorage.setItem('auth_token', token);
    if (refreshToken) await AsyncStorage.setItem('auth_refresh_token', refreshToken);
    if (user) {
      await AsyncStorage.setItem('auth_user', JSON.stringify(user));
    }
    await AsyncStorage.setItem('has_onboarded', 'true');
    setRequiresMfa(false);
    setMfaToken('');
    setMfaCode('');
    toast.success(t('signIn.toast.loginSuccess'));
    onLogin?.();
  };

  const handleSignIn = async () => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setErrors({ email: t('signIn.errors.emailRequired') });
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setErrors({ email: t('signIn.errors.emailInvalid') });
      return;
    }

    if (!password) {
      setErrors({ password: t('signIn.errors.passwordRequired') });
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const result = await apiRequest(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailOrUsername: normalizedEmail,
          password,
          requireOtp: true,
        }),
      }, t('signIn.toast.signInFailed'));

      const responseData = asObject<any>(result.data) || {};
      const responseRaw = asObject<any>(result.raw) || {};
      const token = responseData?.token || responseRaw?.token;
      const user = responseData?.user || responseRaw?.user;
      const refreshToken = responseData?.refreshToken || responseRaw?.refreshToken;
      const nextMfaRequired = Boolean(responseData?.mfaRequired || responseRaw?.mfaRequired);
      const nextMfaToken = responseData?.mfaToken || responseRaw?.mfaToken;
      const nextOtpRequired = Boolean(responseData?.otpRequired || responseRaw?.otpRequired);
      const nextOtpToken = responseData?.otpToken || responseRaw?.otpToken;

      if (result.ok && nextMfaRequired && nextMfaToken) {
        setRequiresMfa(true);
        setMfaToken(nextMfaToken);
        setMfaCode('');
        toast.info(t('signIn.toast.mfaChallenge'));
      } else if (result.ok && nextOtpRequired && nextOtpToken) {
        onNavigateToVerify?.({ mode: 'loginOtp', email: normalizedEmail, otpToken: nextOtpToken });
      } else if (result.ok && token) {
        await continueAfterPrimaryAuth(token, user, refreshToken);
      } else {
        const serverMessage = result.message || t('signIn.toast.signInFailed');
        if (result.status === 401 && /verify your email/i.test(serverMessage)) {
          await AsyncStorage.setItem('pending_verification_email', normalizedEmail);
          toast.info(serverMessage);
          onNavigateToVerify?.();
        } else if (result.status === 401 && /invalid credentials/i.test(serverMessage)) {
          toast.error(t('signIn.toast.invalidCredentials'));
        } else if (result.status === 0) {
          toast.error(serverMessage);
        } else {
          toast.error(t('signIn.toast.httpError', { message: serverMessage, status: result.status }));
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error?.message || t('signIn.toast.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!requiresMfa || !mfaToken) {
      toast.error(t('signIn.toast.startSignInFirst'));
      return;
    }
    if (!mfaCode.trim()) {
      setErrors({ mfa: t('signIn.errors.mfaCodeRequired') });
      return;
    }

    setIsLoading(true);
    try {
      const result = await apiRequest(`${API_URL}/auth/login/mfa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mfaToken,
          code: mfaCode.trim(),
        }),
      }, t('signIn.toast.mfaVerifyFailed'));

      const responseData = asObject<any>(result.data) || {};
      const responseRaw = asObject<any>(result.raw) || {};
      const token = responseData?.token || responseRaw?.token;
      const user = responseData?.user || responseRaw?.user;
      const refreshToken = responseData?.refreshToken || responseRaw?.refreshToken;

      if (result.ok && token) {
        await continueAfterPrimaryAuth(token, user, refreshToken);
        return;
      }

      toast.error(t('signIn.toast.httpError', { message: result.message || t('signIn.toast.invalidMfaCode'), status: result.status }));
    } catch (error) {
      toast.error(t('signIn.toast.mfaNetworkError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 24}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingTop: topPadding,
            paddingBottom: 24 + Math.max(insets.bottom, 10),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        showsVerticalScrollIndicator={false}
      >
        <CanvasBackButton
          style={{ width: backButtonSize, height: backButtonSize, borderRadius: clamp(backButtonSize * 0.29, 14, 16), marginBottom: 24 }}
          onPress={onBack}
          lightSurface
        />

        <View style={styles.logoWrap}><MicroJobsLogo /></View>

        <View
          style={[
            styles.card,
            {
              maxWidth: cardMaxWidth,
              borderRadius: cardRadius,
              paddingTop: cardVerticalPadding,
              paddingBottom: cardVerticalPadding,
              paddingHorizontal: cardHorizontalPadding,
            },
          ]}
        >
          <Text

            style={[styles.title, { fontSize: titleFontSize, lineHeight: Math.round(titleFontSize * 1.16) }]}
          >
            {t('signIn.title')}
          </Text>
          <Text

            style={[styles.subtitle, { fontSize: subtitleFontSize, lineHeight: Math.round(subtitleFontSize * 1.45) }]}
          >
            {t('signIn.subtitle')}
          </Text>

          <View style={[styles.inputContainer, { minHeight: fieldHeight, borderRadius: fieldRadius }]}>
            <Feather name="at-sign" size={fieldIconSize} color={AUTH_COLORS.textMuted} />
            <TextInput
              style={[styles.input, { fontSize: inputFontSize }]}
              placeholder={t('signIn.emailPlaceholder')}
              placeholderTextColor={AUTH_COLORS.placeholderLight}
              value={email}
              onChangeText={(value) => { setEmail(value); setErrors((current) => ({ ...current, email: undefined })); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
            />
          </View>

          {errors.email ? <Text style={styles.inlineError}>{errors.email}</Text> : null}

          <View style={[styles.inputContainer, { minHeight: fieldHeight, borderRadius: fieldRadius }]}>
            <Feather name="lock" size={fieldIconSize} color={AUTH_COLORS.textMuted} />
            <TextInput
              style={[styles.input, { fontSize: inputFontSize }]}
              placeholder={t('signIn.passwordPlaceholder')}
              placeholderTextColor={AUTH_COLORS.placeholderLight}
              value={password}
              onChangeText={(value) => { setPassword(value); setErrors((current) => ({ ...current, password: undefined })); }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              autoComplete="password"
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((prev) => !prev)}>
              <Feather name={showPassword ? 'eye-off' : 'eye'} size={fieldIconSize + 2} color={AUTH_COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={styles.inlineError}>{errors.password}</Text> : null}

          {requiresMfa ? (
            <>
              <View style={[styles.inputContainer, { minHeight: fieldHeight, borderRadius: fieldRadius }]}>
                <Feather name="shield" size={fieldIconSize} color={AUTH_COLORS.textMuted} />
                <TextInput
                  style={[styles.input, { fontSize: inputFontSize }]}
                  placeholder={t('signIn.mfaPlaceholder')}
                  placeholderTextColor={AUTH_COLORS.placeholderLight}
                  value={mfaCode}
                  onChangeText={(value) => { setMfaCode(value); setErrors((current) => ({ ...current, mfa: undefined })); }}
                  autoCapitalize="characters"
                />
              </View>
              {errors.mfa ? <Text style={styles.inlineError}>{errors.mfa}</Text> : null}
              <Text style={[styles.mfaHelpText, { fontSize: clamp(inputFontSize * 0.72, 12, 13) }]}>
                {t('signIn.mfaHelpText')}
              </Text>
            </>
          ) : (
            <TouchableOpacity style={styles.forgotButton} onPress={onNavigateToForgot}>
              <Text style={[styles.forgotText, { fontSize: helperFontSize }]}>
                {t('signIn.forgotPassword')}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              { minHeight: buttonHeight, borderRadius: buttonRadius },
              isLoading && styles.buttonDisabled,
            ]}
            onPress={requiresMfa ? handleVerifyMfa : handleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.primaryButtonText, { fontSize: buttonFontSize }]}>
                {requiresMfa ? t('signIn.submitVerifyMfa') : t('signIn.submitSignIn')}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.bottomRow}>
            <Text style={[styles.bottomText, { fontSize: helperFontSize }]}>
              {t('signIn.noAccount')}
            </Text>
            <TouchableOpacity onPress={onNavigateToSignUp}>
              <Text style={[styles.bottomLink, { fontSize: helperFontSize }]}>
                {t('signIn.signUpLink')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AUTH_COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: AUTH_COLORS.cardLight,
    borderRadius: 28,
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 28,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: AUTH_COLORS.cardBorder,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  logoWrap: { alignItems: 'center', marginBottom: 22 },
  title: {
    textAlign: 'center',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    marginBottom: 28,
    fontWeight: '400',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.inputLight,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputLightBorder,
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    marginBottom: 12,
    paddingVertical: 2,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: AUTH_COLORS.inputTextLight,
    fontWeight: '400',
    minHeight: 48,
    paddingVertical: 10,
  },
  inlineError: { color: AUTH_COLORS.danger, fontSize: 12, marginTop: -7, marginBottom: 10, fontWeight: '500' },
  eyeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mfaHelpText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 10,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  forgotText: {
    color: AUTH_COLORS.linkAccent,
    fontSize: 13,
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: AUTH_COLORS.primary,
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: AUTH_COLORS.primary,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryButtonText: {
    color: AUTH_COLORS.primaryText,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  bottomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    flexShrink: 1,
  },
  bottomLink: {
    color: AUTH_COLORS.linkAccent,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
});
