import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AuthScreenLayout from '../components/auth/AuthScreenLayout';
import AuthStepCard from '../components/auth/AuthStepCard';
import { AuthButton, AuthProgress } from '../components/auth/AuthControls';
import { AUTH_COLORS } from '../theme/authTheme';

export default function PassChanged({ onBackToLogin }: { onBackToLogin?: () => void }) {
  return <AuthScreenLayout title="Password updated" subtitle="Your account is secure and ready to use.">
    <AuthProgress step={3} />
    <AuthStepCard step="✓" title="Reset complete" subtitle="Sign in again using your new password." style={styles.card}>
      <View style={styles.successIcon}><Feather name="check" size={32} color="#fff" /></View>
      <Text style={styles.message}>Other active sessions were signed out to protect your account.</Text>
      <AuthButton label="Back to sign in" onPress={onBackToLogin} />
    </AuthStepCard>
  </AuthScreenLayout>;
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  successIcon: { width: 68, height: 68, borderRadius: 34, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: AUTH_COLORS.success, marginVertical: 12 },
  message: { color: AUTH_COLORS.textSecondary, textAlign: 'center', fontSize: 13, lineHeight: 19, marginBottom: 14 },
});
