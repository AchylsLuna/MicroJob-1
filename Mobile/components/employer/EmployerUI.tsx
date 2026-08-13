import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function EmployerModeBanner({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerIcon}><Ionicons name="business" size={20} color={tokens.colors.onBrand} /></View>
      <View style={styles.bannerCopy}>
        <Text style={styles.eyebrow}>EMPLOYER MODE</Text>
        <Text style={styles.bannerTitle}>{title}</Text>
        <Text style={styles.bannerDetail}>{detail}</Text>
      </View>
    </View>
  );
}

export function EmployerMetric({ icon, value, label, tone = 'blue' }: { icon: IconName; value: string | number; label: string; tone?: 'blue' | 'green' | 'amber' }) {
  return (
    <View style={[styles.metric, tone === 'green' && styles.metricGreen, tone === 'amber' && styles.metricAmber]}>
      <Ionicons name={icon} size={18} color={tone === 'green' ? tokens.colors.success : tone === 'amber' ? tokens.colors.warning : tokens.colors.brand} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function EmployerAction({ icon, label, hint, onPress, disabled = false }: { icon: IconName; label: string; hint?: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.action, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.86}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
    >
      <View style={styles.actionIcon}><Ionicons name={icon} size={20} color={tokens.colors.brand} /></View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={tokens.colors.textSubtle} />
    </TouchableOpacity>
  );
}

export function EmployerAccordion({
  title,
  subtitle,
  icon = 'layers-outline',
  expanded,
  onToggle,
  children,
  badge,
  style,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: string | number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.accordion, style]}>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={onToggle}
        activeOpacity={0.86}
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
        accessibilityState={{ expanded }}
      >
        <View style={styles.accordionIcon}><Ionicons name={icon} size={19} color={tokens.colors.brand} /></View>
        <View style={styles.accordionCopy}>
          <View style={styles.titleRow}>
            <Text style={styles.accordionTitle}>{title}</Text>
            {badge !== undefined ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
          </View>
          {subtitle ? <Text style={styles.accordionSubtitle}>{subtitle}</Text> : null}
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={19} color={tokens.colors.brand} />
      </TouchableOpacity>
      {expanded ? <View style={styles.accordionBody}>{children}</View> : null}
    </View>
  );
}

export function EmployerInlineState({ icon = 'information-circle-outline', title, body, loading = false, onRetry }: { icon?: IconName; title: string; body?: string; loading?: boolean; onRetry?: () => void }) {
  return (
    <View style={styles.state} accessibilityRole={onRetry ? 'alert' : undefined}>
      {loading ? <ActivityIndicator color={tokens.colors.brand} /> : <Ionicons name={icon} size={28} color={tokens.colors.brand} />}
      <Text style={styles.stateTitle}>{title}</Text>
      {body ? <Text style={styles.stateBody}>{body}</Text> : null}
      {onRetry ? <TouchableOpacity style={styles.retry} onPress={onRetry}><Text style={styles.retryText}>Try again</Text></TouchableOpacity> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', gap: 13, borderRadius: 22, padding: 17, backgroundColor: tokens.colors.brandDark, overflow: 'hidden', ...tokens.shadow.card },
  bannerIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  bannerCopy: { flex: 1 }, eyebrow: { color: tokens.colors.onBrandMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  bannerTitle: { marginTop: 3, color: tokens.colors.onBrand, fontSize: 20, fontWeight: '900' },
  bannerDetail: { marginTop: 4, color: tokens.colors.onBrandMuted, fontSize: 12, lineHeight: 18 },
  metric: { flex: 1, minWidth: 96, minHeight: 104, borderWidth: 1, borderColor: tokens.colors.brandMuted, borderRadius: 18, padding: 14, backgroundColor: tokens.colors.brandSoft },
  metricGreen: { borderColor: '#A7F3D0', backgroundColor: tokens.colors.successSoft }, metricAmber: { borderColor: '#FDE68A', backgroundColor: tokens.colors.warningSoft },
  metricValue: { marginTop: 8, color: tokens.colors.brandDark, fontSize: 23, fontWeight: '900' }, metricLabel: { marginTop: 2, color: tokens.colors.textMuted, fontSize: 11, fontWeight: '700' },
  action: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 16, paddingHorizontal: 13, backgroundColor: tokens.colors.surface },
  actionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.brandSoft }, actionLabel: { flex: 1, color: tokens.colors.brandDark, fontSize: 14, fontWeight: '800' }, disabled: { opacity: tokens.opacity.disabled },
  accordion: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 18, backgroundColor: tokens.colors.surface, overflow: 'hidden', ...tokens.shadow.card },
  accordionHeader: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14 }, accordionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.brandSoft },
  accordionCopy: { flex: 1 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, accordionTitle: { color: tokens.colors.brandDark, fontSize: 15, fontWeight: '900' },
  accordionSubtitle: { marginTop: 2, color: tokens.colors.textMuted, fontSize: 11, lineHeight: 16 }, accordionBody: { borderTopWidth: 1, borderTopColor: tokens.colors.border, padding: 14 },
  badge: { minWidth: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, backgroundColor: tokens.colors.brand }, badgeText: { color: tokens.colors.onBrand, fontSize: 10, fontWeight: '900' },
  state: { minHeight: 150, alignItems: 'center', justifyContent: 'center', borderRadius: 18, padding: 20, backgroundColor: tokens.colors.surfaceMuted }, stateTitle: { marginTop: 9, color: tokens.colors.brandDark, fontSize: 16, fontWeight: '900', textAlign: 'center' }, stateBody: { marginTop: 5, color: tokens.colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' }, retry: { minHeight: 44, marginTop: 12, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 18, backgroundColor: tokens.colors.brand }, retryText: { color: tokens.colors.onBrand, fontSize: 13, fontWeight: '800' },
});
