import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import AuthScreenLayout from '../components/auth/AuthScreenLayout';
import AuthStepCard from '../components/auth/AuthStepCard';
import { AuthButton, AuthField, AuthProgress, PasswordChecklist } from '../components/auth/AuthControls';
import { AUTH_COLORS } from '../theme/authTheme';

type Props = {
  onBackToLogin?: () => void;
  verifiedCode?: string;
  onReset?: (payload: { code: string; password: string; confirm: string }) => void | Promise<void>;
};

const isStrong = (value: string) => value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

export default function CreatePass({ onBackToLogin, onReset, verifiedCode = '' }: Props) {
  const [code, setCode] = useState(verifiedCode);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<{ code?: string; password?: string; confirm?: string }>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const next: typeof errors = {};
    if (!/^\d{6}$/.test(code)) next.code = 'Enter the complete 6-digit reset code.';
    if (!isStrong(password)) next.password = 'Your password does not meet all requirements.';
    if (!confirm || confirm !== password) next.confirm = 'Passwords must match.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    try { await onReset?.({ code, password, confirm }); }
    finally { setLoading(false); }
  };

  return <AuthScreenLayout title="Create new password" subtitle="Choose a strong password you have not used before." onBack={onBackToLogin}>
    <AuthProgress step={3} />
    <AuthStepCard step={3} title="Secure your account" subtitle="Your new password will sign out other active sessions." style={styles.card}>
      {!verifiedCode ? <AuthField label="Reset code" icon="hash" placeholder="6-digit code" value={code} onChangeText={(value) => { setCode(value.replace(/\D/g, '').slice(0, 6)); setErrors((current) => ({ ...current, code: undefined })); }} error={errors.code} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode" /> : null}
      <AuthField label="New password" icon="lock" placeholder="Enter a strong password" value={password} onChangeText={(value) => { setPassword(value); setErrors((current) => ({ ...current, password: undefined })); }} error={errors.password} secure revealed={showPassword} onToggleReveal={() => setShowPassword((value) => !value)} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" />
      <AuthField label="Confirm password" icon="lock" placeholder="Enter it again" value={confirm} onChangeText={(value) => { setConfirm(value); setErrors((current) => ({ ...current, confirm: undefined })); }} error={errors.confirm} secure revealed={showConfirm} onToggleReveal={() => setShowConfirm((value) => !value)} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" />
      <PasswordChecklist password={password} confirm={confirm} />
      <AuthButton label="Change password" onPress={submit} loading={loading} />
      <TouchableOpacity style={styles.cancel} onPress={onBackToLogin} accessibilityRole="button"><Text style={styles.cancelText}>Cancel and return</Text></TouchableOpacity>
    </AuthStepCard>
  </AuthScreenLayout>;
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  cancelText: { color: AUTH_COLORS.primary, fontSize: 14, fontWeight: '700' },
});
