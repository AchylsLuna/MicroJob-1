import { useCallback, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '../lib/storage';
import { API_URL } from '../config';
import { GOOGLE_CLIENT_ID } from '../config';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, ResponseType, useAuthRequest } from 'expo-auth-session';
import { apiRequest } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import AuthScreenLayout from '../components/auth/AuthScreenLayout';
import AuthStepCard from '../components/auth/AuthStepCard';
import { AuthButton, AuthField, GoogleAuthButton, PasswordChecklist } from '../components/auth/AuthControls';
import { AUTH_COLORS } from '../theme/authTheme';
import {
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
  parseFullName,
} from '../lib/authValidation';
import { isStrongPassword } from '../lib/passwordPolicy';

type Role = 'hire' | 'work' | 'both';
type Props = { onBack: () => void; onNavigateToSignIn: () => void; onNavigateToVerify: (email: string) => void };
type Errors = Partial<Record<'fullName' | 'email' | 'phone' | 'password' | 'confirm', string>>;

export default function SignUp({ onBack, onNavigateToSignIn, onNavigateToVerify }: Props) {
  WebBrowser.maybeCompleteAuthSession();
  const [googleRequest, , promptGoogle] = useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    responseType: ResponseType.IdToken,
    scopes: ['openid', 'profile', 'email'],
    redirectUri: makeRedirectUri({ scheme: 'microjobs' }),
  }, { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' });
  const { t } = useTranslation('auth');
  const roles = useMemo<Array<{ value: Role; title: string; subtitle: string; icon: keyof typeof Feather.glyphMap }>>(() => [
    { value: 'work', title: t('signUp.roles.work.title'), subtitle: t('signUp.roles.work.subtitle'), icon: 'user' },
    { value: 'hire', title: t('signUp.roles.hire.title'), subtitle: t('signUp.roles.hire.subtitle'), icon: 'briefcase' },
    { value: 'both', title: t('signUp.roles.both.title'), subtitle: t('signUp.roles.both.subtitle'), icon: 'users' },
  ], [t]);
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('work');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const getRegistrationAlert = (status: number, message?: string) => {
    const normalizedMessage = String(message || '').toLowerCase();
    if (status === 0) return t('signUp.toast.networkError');
    if (status === 409 && /email/.test(normalizedMessage)) return t('signUp.toast.emailAlreadyRegistered');
    if (status === 409 && /phone/.test(normalizedMessage)) return t('signUp.toast.phoneAlreadyRegistered');
    if (status === 409) return t('signUp.toast.accountAlreadyRegistered');
    if (/password/.test(normalizedMessage)) return t('signUp.errors.passwordWeak');
    if (/email/.test(normalizedMessage)) return t('signUp.errors.emailInvalid');
    return t('signUp.toast.accountCreationFailed');
  };

  const progress = useMemo(() => Math.round((step / 3) * 100), [step]);
  const progressWidth = `${progress}%` as `${number}%`;
  const goBack = () => step > 1 ? setStep((value) => value - 1) : onBack();
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step <= 1) return false;
      setStep((value) => value - 1);
      return true;
    });
    return () => subscription.remove();
  }, [step]));

  const validateIdentity = () => {
    const next: Errors = {};
    if (!parseFullName(fullName)) next.fullName = t('signUp.errors.fullNameInvalid');
    if (!isValidEmail(email)) next.email = t('signUp.errors.emailInvalid');
    if (!isValidPhone(normalizePhone(phone))) next.phone = t('signUp.errors.phoneInvalid');
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const hasMissingField = !fullName.trim() || !email.trim() || !phone.trim();
      toast.error(hasMissingField ? t('signUp.toast.requiredFields') : Object.values(next)[0]);
    }
    return Object.keys(next).length === 0;
  };
  const continueFromIdentity = () => { if (validateIdentity()) setStep(2); };

  const submit = async () => {
    const next: Errors = {};
    if (!password) next.password = t('signUp.errors.passwordRequired');
    else if (!isStrongPassword(password)) next.password = t('signUp.errors.passwordWeak');
    if (!confirm) next.confirm = t('signUp.errors.confirmRequired');
    else if (password !== confirm) next.confirm = t('signUp.errors.confirmMismatch');
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error(!password || !confirm ? t('signUp.toast.requiredFields') : Object.values(next)[0]);
      return;
    }
    const name = parseFullName(fullName);
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);
    if (!name || !isValidPhone(normalizedPhone)) { setStep(1); validateIdentity(); return; }
    setLoading(true);
    try {
      const result = await apiRequest(`${API_URL}/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name.normalized, firstName: name.firstName, lastName: name.lastName, email: normalizedEmail, phoneNumber: normalizedPhone, password, role }),
      }, t('signUp.toast.registrationFailedFallback'));
      if (!result.ok) { toast.error(getRegistrationAlert(result.status, result.message)); return; }
      await AsyncStorage.setItem('pending_verification_email', normalizedEmail);
      toast.success(t('signUp.toast.accountCreated'));
      onNavigateToVerify(normalizedEmail);
    } catch { toast.error(t('signUp.toast.networkError')); }
    finally { setLoading(false); }
  };

  const handleGoogleSignUp = async () => {
    if (!GOOGLE_CLIENT_ID || !googleRequest) {
      toast.error('Google sign-up is not configured.');
      return;
    }
    const result = await promptGoogle();
    if (result.type !== 'success' || !result.params?.id_token) return;
    setLoading(true);
    try {
      const response = await apiRequest(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: result.params.id_token, role }),
      }, 'Google sign-up failed.');
      const data = (response.data || response.raw) as any;
      if (!response.ok || !data?.token || !data?.user) throw new Error(response.message);
      await AsyncStorage.setItem('auth_token', data.token);
      if (data.refreshToken) await AsyncStorage.setItem('auth_refresh_token', data.refreshToken);
      await AsyncStorage.setItem('auth_user', JSON.stringify(data.user));
      toast.success(t('signUp.toast.accountCreated'));
      onNavigateToSignIn();
    } catch (error: any) {
      toast.error(error?.message || 'Google sign-up failed.');
    } finally {
      setLoading(false);
    }
  };

  return <AuthScreenLayout
    title={t('signUp.title')}
    subtitle={step === 1 ? t('signUp.subtitleStep1') : step === 2 ? t('signUp.subtitleStep2') : t('signUp.subtitleStep3')}
    onBack={goBack}
  >
    <View style={styles.progressHeader}><Text style={styles.stepText}>{t('signUp.progressStep', { step })}</Text><Text style={styles.percent}>{progress}%</Text></View>
    <View style={styles.progressTrack}><View style={[styles.progressFill, { width: progressWidth }]} /></View>
    <AuthStepCard step={step} title={step === 1 ? t('signUp.stepTitleDetails') : step === 2 ? t('signUp.stepTitleRole') : t('signUp.stepTitlePassword')} style={styles.card}>
      {step === 1 ? <>
        <AuthField label={t('signUp.fullNameLabel')} icon="user" placeholder={t('signUp.fullNamePlaceholder')} value={fullName} onChangeText={(v) => { setFullName(v); setErrors((e) => ({ ...e, fullName: undefined })); }} error={errors.fullName} autoComplete="name" textContentType="name" returnKeyType="next" />
        <AuthField label={t('signUp.emailLabel')} icon="mail" placeholder={t('signUp.emailPlaceholder')} value={email} onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: undefined })); }} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="next" />
        <AuthField label={t('signUp.phoneLabel')} icon="phone" placeholder={t('signUp.phonePlaceholder')} value={phone} onChangeText={(v) => { setPhone(v.replace(/\D/g, '').slice(0, 12)); setErrors((e) => ({ ...e, phone: undefined })); }} error={errors.phone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
        <AuthButton label={t('signUp.continue')} onPress={continueFromIdentity} />
      </> : null}
      {step === 2 ? <>
        {roles.map((item) => <TouchableOpacity key={item.value} style={[styles.role, role === item.value && styles.roleSelected]} onPress={() => setRole(item.value)} accessibilityRole="radio" accessibilityState={{ checked: role === item.value }}>
          <View style={[styles.roleIcon, role === item.value && styles.roleIconSelected]}><Feather name={item.icon} size={22} color={role === item.value ? '#fff' : AUTH_COLORS.primary} /></View>
          <View style={styles.roleCopy}><Text style={styles.roleTitle}>{item.title}</Text><Text style={styles.roleSubtitle}>{item.subtitle}</Text></View>
          <Feather name={role === item.value ? 'check-circle' : 'circle'} size={22} color={role === item.value ? AUTH_COLORS.primary : AUTH_COLORS.textTertiary} />
        </TouchableOpacity>)}
        <AuthButton label={t('signUp.continue')} onPress={() => setStep(3)} />
      </> : null}
      {step === 3 ? <>
        <AuthField label={t('signUp.passwordLabel')} icon="lock" placeholder={t('signUp.passwordPlaceholder')} value={password} onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }} error={errors.password} secure revealed={showPassword} onToggleReveal={() => setShowPassword(!showPassword)} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
        <AuthField label={t('signUp.confirmPasswordLabel')} icon="lock" placeholder={t('signUp.confirmPasswordPlaceholder')} value={confirm} onChangeText={(v) => { setConfirm(v); setErrors((e) => ({ ...e, confirm: undefined })); }} error={errors.confirm} secure revealed={showConfirm} onToggleReveal={() => setShowConfirm(!showConfirm)} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
        <PasswordChecklist password={password} confirm={confirm} />
        <AuthButton label={t('signUp.createAccount')} onPress={submit} loading={loading} />
      </> : null}
    </AuthStepCard>
    <View style={styles.googleSection}>
      <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>or continue with</Text><View style={styles.dividerLine} /></View>
      <GoogleAuthButton onPress={handleGoogleSignUp} loading={loading} disabled={!googleRequest} />
    </View>
    <View style={styles.signInRow}>
      <Text style={styles.muted}>{t('signUp.alreadyHaveAccount')}</Text>
      <TouchableOpacity
        style={styles.signInLinkTap}
        onPress={onNavigateToSignIn}
        accessibilityRole="button"
        accessibilityLabel={t('signUp.signInLinkA11y')}
      ><Text style={styles.link}>{t('signUp.signInLink')}</Text></TouchableOpacity>
    </View>
  </AuthScreenLayout>;
}

const styles = StyleSheet.create({
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  stepText: { color: AUTH_COLORS.onBlueMuted, fontSize: 13, fontWeight: '700' },
  percent: { color: AUTH_COLORS.onBlue, fontSize: 13, fontWeight: '800' },
  progressTrack: { height: 7, backgroundColor: AUTH_COLORS.blueControlSurface, borderRadius: 4, marginBottom: 18, overflow: 'hidden' },
  progressFill: { height: 7, backgroundColor: AUTH_COLORS.primary, borderRadius: 4 },
  card: { marginBottom: 18 },
  googleSection: { marginBottom: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: AUTH_COLORS.cardBorder },
  dividerText: { color: AUTH_COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  role: { minHeight: 76, borderWidth: 1, borderColor: AUTH_COLORS.cardBorder, borderRadius: 14, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  roleSelected: { borderColor: AUTH_COLORS.primary, backgroundColor: '#EFF6FF' },
  roleIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EAF1FB', alignItems: 'center', justifyContent: 'center' },
  roleIconSelected: { backgroundColor: AUTH_COLORS.primary },
  roleCopy: { flex: 1, minWidth: 0, marginHorizontal: 12 }, roleTitle: { fontWeight: '700', color: AUTH_COLORS.textPrimary, fontSize: 15, flexShrink: 1 }, roleSubtitle: { color: AUTH_COLORS.textSecondary, fontSize: 12, marginTop: 3, flexShrink: 1 },
  signInRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', minHeight: 56, backgroundColor: AUTH_COLORS.blueControlSurface, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  signInLinkTap: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  muted: { color: AUTH_COLORS.onBlueMuted, fontSize: 14, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  link: { color: AUTH_COLORS.onBlue, fontWeight: '800', fontSize: 14, textDecorationLine: 'underline', textAlign: 'center', flexShrink: 1 },
});
