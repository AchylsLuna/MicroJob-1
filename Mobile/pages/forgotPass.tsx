import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import AuthScreenLayout from '../components/auth/AuthScreenLayout';
import AuthStepCard from '../components/auth/AuthStepCard';
import { AuthButton, AuthField, AuthProgress } from '../components/auth/AuthControls';
import { AUTH_COLORS } from '../theme/authTheme';
import { useToast } from '../contexts/ToastContext';
import { isValidEmail, normalizeEmail } from '../lib/authValidation';

type Props = { onBack?: () => void; onSendReset?: (email: string) => void | Promise<void> };
export default function ForgotPass({ onBack, onSendReset }: Props) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const { t } = useTranslation('auth');

  const submit = async () => {
    const normalized = normalizeEmail(email);
    if (!normalized) { setError(t('forgotPass.errors.emailRequired')); return; }
    if (!isValidEmail(normalized)) { setError(t('forgotPass.errors.emailInvalid')); return; }
    setError(''); setLoading(true);
    try { await onSendReset?.(normalized); }
    catch (requestError: any) { toast.error(requestError?.message || t('forgotPass.toast.sendFailed')); }
    finally { setLoading(false); }
  };

  return <AuthScreenLayout title={t('forgotPass.title')} subtitle={t('forgotPass.subtitle')} onBack={onBack}>
    <AuthProgress step={1} />
    <AuthStepCard step={1} title={t('forgotPass.cardTitle')} subtitle={t('forgotPass.cardSubtitle')} style={styles.card}>
      <View style={styles.iconWrap}><View style={styles.icon}><Feather name="mail" size={24} color={AUTH_COLORS.primary} /></View></View>
      <AuthField label={t('forgotPass.emailLabel')} icon="mail" placeholder={t('forgotPass.emailPlaceholder')} value={email} onChangeText={(value) => { setEmail(value); setError(''); }} error={error} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" returnKeyType="send" onSubmitEditing={submit} />
      <AuthButton label={t('forgotPass.submit')} onPress={submit} loading={loading} />
      <Text style={styles.help}>{t('forgotPass.help')}</Text>
    </AuthStepCard>
  </AuthScreenLayout>;
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  iconWrap: { alignItems: 'center', marginBottom: 16 },
  icon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#EAF1FB', alignItems: 'center', justifyContent: 'center' },
  help: { marginTop: 14, color: AUTH_COLORS.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
