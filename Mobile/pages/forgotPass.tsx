import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AuthScreenLayout from '../components/auth/AuthScreenLayout';
import AuthStepCard from '../components/auth/AuthStepCard';
import { AuthButton, AuthField, AuthProgress } from '../components/auth/AuthControls';
import { AUTH_COLORS } from '../theme/authTheme';
import { useToast } from '../contexts/ToastContext';

type Props = { onBack?: () => void; onSendReset?: (email: string) => void | Promise<void> };
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPass({ onBack, onSendReset }: Props) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const submit = async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) { setError('Enter your email address.'); return; }
    if (!EMAIL_REGEX.test(normalized)) { setError('Enter a valid email address.'); return; }
    setError(''); setLoading(true);
    try { await onSendReset?.(normalized); }
    catch (requestError: any) { toast.error(requestError?.message || 'Unable to send the verification code.'); }
    finally { setLoading(false); }
  };

  return <AuthScreenLayout title="Reset password" subtitle="Recover your account in three quick steps." onBack={onBack}>
    <AuthProgress step={1} />
    <AuthStepCard step={1} title="Recovery email" subtitle="Use the email connected to your MicroJobs account." style={styles.card}>
      <View style={styles.iconWrap}><View style={styles.icon}><Feather name="mail" size={24} color={AUTH_COLORS.primary} /></View></View>
      <AuthField label="Email address" icon="mail" placeholder="you@example.com" value={email} onChangeText={(value) => { setEmail(value); setError(''); }} error={error} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" returnKeyType="send" onSubmitEditing={submit} />
      <AuthButton label="Send verification code" onPress={submit} loading={loading} />
      <Text style={styles.help}>We will send a 6-digit code. For your security, the message does not reveal whether an account exists.</Text>
    </AuthStepCard>
  </AuthScreenLayout>;
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  iconWrap: { alignItems: 'center', marginBottom: 16 },
  icon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#EAF1FB', alignItems: 'center', justifyContent: 'center' },
  help: { marginTop: 14, color: AUTH_COLORS.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
