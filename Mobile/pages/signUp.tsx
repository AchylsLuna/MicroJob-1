import { useCallback, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '../lib/storage';
import { API_URL } from '../config';
import { apiRequest } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import AuthScreenLayout from '../components/auth/AuthScreenLayout';
import AuthStepCard from '../components/auth/AuthStepCard';
import { AuthButton, AuthField, PasswordChecklist } from '../components/auth/AuthControls';
import { AUTH_COLORS } from '../theme/authTheme';

type Role = 'hire' | 'work' | 'both';
type Props = { onBack: () => void; onNavigateToSignIn: () => void; onNavigateToVerify: (email: string) => void };
type Errors = Partial<Record<'fullName' | 'email' | 'phone' | 'password' | 'confirm', string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const strongPassword = (value: string) => value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  return null;
};
const parseName = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, ' ');
  const [firstName, ...rest] = normalized.split(' ');
  const lastName = rest.join(' ');
  return firstName && lastName ? { normalized, firstName, lastName } : null;
};

const roles: Array<{ value: Role; title: string; subtitle: string; icon: keyof typeof Feather.glyphMap }> = [
  { value: 'work', title: 'Find work', subtitle: 'Browse and complete local jobs', icon: 'user' },
  { value: 'hire', title: 'Hire people', subtitle: 'Post jobs and manage applicants', icon: 'briefcase' },
  { value: 'both', title: 'Both', subtitle: 'Work and hire from one account', icon: 'users' },
];

export default function SignUp({ onBack, onNavigateToSignIn, onNavigateToVerify }: Props) {
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
    if (!parseName(fullName)) next.fullName = 'Enter your first and last name.';
    if (!EMAIL_REGEX.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!normalizePhone(phone)) next.phone = 'Use a valid Philippine mobile number (09XXXXXXXXX).';
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const continueFromIdentity = () => { if (validateIdentity()) setStep(2); };

  const submit = async () => {
    const next: Errors = {};
    if (!strongPassword(password)) next.password = 'Your password does not meet all requirements.';
    if (!confirm || password !== confirm) next.confirm = 'Passwords must match.';
    setErrors(next);
    if (Object.keys(next).length) return;
    const name = parseName(fullName);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizePhone(phone);
    if (!name || !normalizedPhone) { setStep(1); validateIdentity(); return; }
    setLoading(true);
    try {
      const result = await apiRequest(`${API_URL}/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name.normalized, firstName: name.firstName, lastName: name.lastName, email: normalizedEmail, phoneNumber: normalizedPhone, password, role }),
      }, 'Registration failed.');
      if (!result.ok) { toast.error(`${result.message || 'Registration failed.'} (HTTP ${result.status})`); return; }
      await AsyncStorage.setItem('pending_verification_email', normalizedEmail);
      toast.success('Account created. Verify your email to continue.');
      onNavigateToVerify(normalizedEmail);
    } catch (error: any) { toast.error(error?.message || 'Unable to create your account.'); }
    finally { setLoading(false); }
  };

  return <AuthScreenLayout
    title="Create account"
    subtitle={step === 1 ? 'Start with your contact details.' : step === 2 ? 'Tell us how you will use MicroJob.' : 'Secure your new account.'}
    onBack={goBack}
  >
    <View style={styles.progressHeader}><Text style={styles.stepText}>Step {step} of 3</Text><Text style={styles.percent}>{progress}%</Text></View>
    <View style={styles.progressTrack}><View style={[styles.progressFill, { width: progressWidth }]} /></View>
    <AuthStepCard step={step} title={step === 1 ? 'Your details' : step === 2 ? 'Choose your role' : 'Create a password'} style={styles.card}>
      {step === 1 ? <>
        <AuthField label="Full name" icon="user" placeholder="Juan Dela Cruz" value={fullName} onChangeText={(v) => { setFullName(v); setErrors((e) => ({ ...e, fullName: undefined })); }} error={errors.fullName} autoComplete="name" textContentType="name" returnKeyType="next" />
        <AuthField label="Email address" icon="mail" placeholder="you@example.com" value={email} onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: undefined })); }} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="next" />
        <AuthField label="Mobile number" icon="phone" placeholder="09XXXXXXXXX" value={phone} onChangeText={(v) => { setPhone(v.replace(/\D/g, '').slice(0, 12)); setErrors((e) => ({ ...e, phone: undefined })); }} error={errors.phone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
        <AuthButton label="Continue" onPress={continueFromIdentity} />
      </> : null}
      {step === 2 ? <>
        {roles.map((item) => <TouchableOpacity key={item.value} style={[styles.role, role === item.value && styles.roleSelected]} onPress={() => setRole(item.value)} accessibilityRole="radio" accessibilityState={{ checked: role === item.value }}>
          <View style={[styles.roleIcon, role === item.value && styles.roleIconSelected]}><Feather name={item.icon} size={22} color={role === item.value ? '#fff' : AUTH_COLORS.primary} /></View>
          <View style={styles.roleCopy}><Text style={styles.roleTitle}>{item.title}</Text><Text style={styles.roleSubtitle}>{item.subtitle}</Text></View>
          <Feather name={role === item.value ? 'check-circle' : 'circle'} size={22} color={role === item.value ? AUTH_COLORS.primary : AUTH_COLORS.textTertiary} />
        </TouchableOpacity>)}
        <AuthButton label="Continue" onPress={() => setStep(3)} />
      </> : null}
      {step === 3 ? <>
        <AuthField label="Password" icon="lock" placeholder="Create a strong password" value={password} onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }} error={errors.password} secure revealed={showPassword} onToggleReveal={() => setShowPassword(!showPassword)} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
        <AuthField label="Confirm password" icon="lock" placeholder="Enter it again" value={confirm} onChangeText={(v) => { setConfirm(v); setErrors((e) => ({ ...e, confirm: undefined })); }} error={errors.confirm} secure revealed={showConfirm} onToggleReveal={() => setShowConfirm(!showConfirm)} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
        <PasswordChecklist password={password} confirm={confirm} />
        <AuthButton label="Create account" onPress={submit} loading={loading} />
      </> : null}
    </AuthStepCard>
    <View style={styles.signInRow}>
      <Text style={styles.muted}>Already have an account?</Text>
      <TouchableOpacity
        style={styles.signInLinkTap}
        onPress={onNavigateToSignIn}
        accessibilityRole="button"
        accessibilityLabel="Sign in to an existing account"
      ><Text style={styles.link}>Sign in</Text></TouchableOpacity>
    </View>
  </AuthScreenLayout>;
}

const styles = StyleSheet.create({
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  stepText: { color: AUTH_COLORS.onBlueMuted, fontSize: 13, fontWeight: '700' },
  percent: { color: AUTH_COLORS.onBlue, fontSize: 13, fontWeight: '800' },
  progressTrack: { height: 7, backgroundColor: AUTH_COLORS.blueControlSurface, borderRadius: 4, marginBottom: 18, overflow: 'hidden' },
  progressFill: { height: 7, backgroundColor: AUTH_COLORS.onBlue, borderRadius: 4 },
  card: { marginBottom: 18 },
  role: { minHeight: 76, borderWidth: 1, borderColor: AUTH_COLORS.cardBorder, borderRadius: 14, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  roleSelected: { borderColor: AUTH_COLORS.primary, backgroundColor: '#EFF6FF' },
  roleIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EAF1FB', alignItems: 'center', justifyContent: 'center' },
  roleIconSelected: { backgroundColor: AUTH_COLORS.primary },
  roleCopy: { flex: 1, marginHorizontal: 12 }, roleTitle: { fontWeight: '700', color: AUTH_COLORS.textPrimary, fontSize: 15 }, roleSubtitle: { color: AUTH_COLORS.textSecondary, fontSize: 12, marginTop: 3 },
  signInRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', minHeight: 56, backgroundColor: AUTH_COLORS.blueControlSurface, borderRadius: 14, paddingLeft: 14, paddingRight: 6 },
  signInLinkTap: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  muted: { color: AUTH_COLORS.onBlueMuted, fontSize: 14, fontWeight: '600' },
  link: { color: AUTH_COLORS.onBlue, fontWeight: '800', fontSize: 14, textDecorationLine: 'underline' },
});
