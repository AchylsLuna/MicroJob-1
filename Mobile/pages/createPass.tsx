import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import AuthScreenLayout from '../components/auth/AuthScreenLayout';
import AuthStepCard from '../components/auth/AuthStepCard';
import { AuthButton, AuthField, AuthProgress, PasswordChecklist } from '../components/auth/AuthControls';
import { AUTH_COLORS } from '../theme/authTheme';
import { isStrongPassword } from '../lib/passwordPolicy';

type Props = {
  onBackToLogin?: () => void;
  verifiedCode?: string;
  onReset?: (payload: { code: string; password: string; confirm: string }) => void | Promise<void>;
};

export default function CreatePass({ onBackToLogin, onReset, verifiedCode = '' }: Props) {
  const [code, setCode] = useState(() => String(verifiedCode || '').replace(/\D/g, '').slice(0, 6));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<{ code?: string; password?: string; confirm?: string }>({});
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation('auth');

  useEffect(() => {
    setCode(String(verifiedCode || '').replace(/\D/g, '').slice(0, 6));
  }, [verifiedCode]);

  const submit = async () => {
    const next: typeof errors = {};
    if (!/^\d{6}$/.test(code)) next.code = t('createPass.errors.codeInvalid');
    if (!isStrongPassword(password)) next.password = t('createPass.errors.passwordWeak');
    if (!confirm || confirm !== password) next.confirm = t('createPass.errors.confirmMismatch');
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    try { await onReset?.({ code, password, confirm }); }
    finally { setLoading(false); }
  };

  return <AuthScreenLayout title={t('createPass.title')} subtitle={t('createPass.subtitle')} onBack={onBackToLogin}>
    <AuthProgress step={3} />
    <AuthStepCard step={3} title={t('createPass.cardTitle')} subtitle={t('createPass.cardSubtitle')} style={styles.card}>
      {!verifiedCode ? <AuthField label={t('createPass.codeLabel')} icon="hash" placeholder={t('createPass.codePlaceholder')} value={code} onChangeText={(value) => { setCode(value.replace(/\D/g, '').slice(0, 6)); setErrors((current) => ({ ...current, code: undefined })); }} error={errors.code} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode" /> : null}
      <AuthField label={t('createPass.passwordLabel')} icon="lock" placeholder={t('createPass.passwordPlaceholder')} value={password} onChangeText={(value) => { setPassword(value); setErrors((current) => ({ ...current, password: undefined })); }} error={errors.password} secure revealed={showPassword} onToggleReveal={() => setShowPassword((value) => !value)} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" />
      <AuthField label={t('createPass.confirmPasswordLabel')} icon="lock" placeholder={t('createPass.confirmPasswordPlaceholder')} value={confirm} onChangeText={(value) => { setConfirm(value); setErrors((current) => ({ ...current, confirm: undefined })); }} error={errors.confirm} secure revealed={showConfirm} onToggleReveal={() => setShowConfirm((value) => !value)} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" />
      <PasswordChecklist password={password} confirm={confirm} />
      <AuthButton label={t('createPass.submit')} onPress={submit} loading={loading} />
      <TouchableOpacity style={styles.cancel} onPress={onBackToLogin} accessibilityRole="button"><Text style={styles.cancelText}>{t('createPass.cancel')}</Text></TouchableOpacity>
    </AuthStepCard>
  </AuthScreenLayout>;
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  cancelText: { color: AUTH_COLORS.primary, fontSize: 14, fontWeight: '700' },
});
