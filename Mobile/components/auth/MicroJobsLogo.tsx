import { StyleSheet, Text, View } from 'react-native';
import { AUTH_COLORS } from '../../theme/authTheme';

export default function MicroJobsLogo({ compact = false }: { compact?: boolean }) {
  const size = compact ? 34 : 42;
  return <View style={styles.row} accessibilityRole="image" accessibilityLabel="MicroJobs">
    <View style={[styles.badge, { width: size, height: size, borderRadius: compact ? 11 : 13 }]}>
      <Text style={[styles.badgeText, compact && styles.badgeTextCompact]}>M</Text>
    </View>
    <Text style={[styles.wordmark, compact && styles.wordmarkCompact]}><Text style={styles.micro}>Micro</Text>Jobs</Text>
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { backgroundColor: AUTH_COLORS.primary, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '30deg' }] },
  badgeText: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', transform: [{ rotate: '-30deg' }] },
  badgeTextCompact: { fontSize: 17 },
  wordmark: { color: AUTH_COLORS.primary, fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  wordmarkCompact: { fontSize: 20 },
  micro: { color: AUTH_COLORS.backgroundDeep },
});
