import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { AUTH_COLORS } from '../../theme/authTheme';

type LogoVariant = 'default' | 'compact' | 'launch';

export function MicroJobsLogoBadge({ variant = 'default', style }: { variant?: LogoVariant; style?: StyleProp<ViewStyle> }) {
  const size = variant === 'launch' ? 82 : variant === 'compact' ? 34 : 42;
  return <View style={[styles.badge, { width: size, height: size, borderRadius: variant === 'launch' ? 26 : variant === 'compact' ? 11 : 13 }, style]}>
    <Text style={[styles.badgeText, variant === 'compact' && styles.badgeTextCompact, variant === 'launch' && styles.badgeTextLaunch]}>M</Text>
  </View>;
}

export function MicroJobsWordmark({ variant = 'default', style }: { variant?: LogoVariant; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.wordmark, variant === 'compact' && styles.wordmarkCompact, variant === 'launch' && styles.wordmarkLaunch, style]}><Text style={styles.micro}>Micro</Text>Jobs</Text>;
}

export default function MicroJobsLogo({ compact = false, variant }: { compact?: boolean; variant?: LogoVariant }) {
  const resolvedVariant = variant || (compact ? 'compact' : 'default');
  return <View style={styles.row} accessibilityRole="image" accessibilityLabel="MicroJobs">
    <MicroJobsLogoBadge variant={resolvedVariant} />
    <MicroJobsWordmark variant={resolvedVariant} />
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { backgroundColor: AUTH_COLORS.primary, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '30deg' }] },
  badgeText: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', transform: [{ rotate: '-30deg' }] },
  badgeTextCompact: { fontSize: 17 },
  badgeTextLaunch: { fontSize: 40 },
  wordmark: { color: AUTH_COLORS.primary, fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  wordmarkCompact: { fontSize: 20 },
  wordmarkLaunch: { fontSize: 38, letterSpacing: -1 },
  micro: { color: AUTH_COLORS.backgroundDeep },
});
