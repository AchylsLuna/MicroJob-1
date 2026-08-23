import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import AuthScreenLayout from '../components/auth/AuthScreenLayout';
import AuthStepCard from '../components/auth/AuthStepCard';
import { AuthButton, AuthProgress } from '../components/auth/AuthControls';
import { AUTH_COLORS } from '../theme/authTheme';

export default function PassChanged({ onBackToLogin }: { onBackToLogin?: () => void }) {
  const { t } = useTranslation('auth');
  return <AuthScreenLayout title={t('passChanged.title')} subtitle={t('passChanged.subtitle')}>
    <AuthProgress step={3} />
    <AuthStepCard step="✓" title={t('passChanged.cardTitle')} subtitle={t('passChanged.cardSubtitle')} style={styles.card}>
      <View style={styles.successIcon}><Feather name="check" size={32} color="#fff" /></View>
      <Text style={styles.message}>{t('passChanged.message')}</Text>
      <AuthButton label={t('passChanged.backToSignIn')} onPress={onBackToLogin} />
    </AuthStepCard>
  </AuthScreenLayout>;
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  successIcon: { width: 68, height: 68, borderRadius: 34, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: AUTH_COLORS.success, marginVertical: 12 },
  message: { color: AUTH_COLORS.textSecondary, textAlign: 'center', fontSize: 13, lineHeight: 19, marginBottom: 14 },
});
