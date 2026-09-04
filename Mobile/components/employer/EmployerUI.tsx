import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { motion } from '../../theme/motion';
import useReducedMotion from '../../hooks/useReducedMotion';
import AnimatedPressable from '../ui/AnimatedPressable';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function EmployerModeBanner({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.banner}>
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

export function EmployerAction({ icon, label, hint, onPress, disabled = false, tone = 'secondary', busy = false }: { icon: IconName; label: string; hint?: string; onPress?: () => void; disabled?: boolean; tone?: 'primary' | 'secondary' | 'quiet' | 'danger'; busy?: boolean }) {
  const unavailable = disabled || busy;
  return (
    <AnimatedPressable
      containerStyle={[styles.action, tone === 'primary' && styles.actionPrimary, tone === 'quiet' && styles.actionQuiet, tone === 'danger' && styles.actionDanger]}
      onPress={onPress}
      disabled={unavailable}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: unavailable, busy }}
    >
      <View style={styles.actionRow}>
        <View style={[styles.actionIcon, tone === 'primary' && styles.actionIconPrimary, tone === 'danger' && styles.actionIconDanger]}>{busy ? <ActivityIndicator size="small" color={tone === 'primary' ? tokens.colors.onBrand : tokens.colors.brand} /> : <Ionicons name={icon} size={20} color={tone === 'primary' ? tokens.colors.onBrand : tone === 'danger' ? tokens.colors.danger : tokens.colors.brand} />}</View>
        <Text style={[styles.actionLabel, tone === 'primary' && styles.actionLabelPrimary, tone === 'danger' && styles.actionLabelDanger]}>{label}</Text>
        {!busy ? <Ionicons name="chevron-forward" size={16} color={tone === 'primary' ? tokens.colors.onBrandMuted : tone === 'danger' ? tokens.colors.danger : tokens.colors.textSubtle} /> : null}
      </View>
    </AnimatedPressable>
  );
}

function AccordionBody({ children }: { children: React.ReactNode }) {
  const reducedMotion = useReducedMotion() === true;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: reducedMotion ? motion.duration.instant : motion.duration.enter, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion]);

  return (
    <Animated.View
      style={[
        styles.accordionBody,
        { opacity: progress, transform: [{ translateY: reducedMotion ? 0 : progress.interpolate({ inputRange: [0, 1], outputRange: [motion.distance.micro, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function EmployerAccordion({
  title,
  subtitle,
  icon,
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
      <AnimatedPressable
        containerStyle={styles.accordionHeader}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
        accessibilityState={{ expanded }}
      >
        <View style={styles.accordionHeaderRow}>
          {/* Decorative only: pass an icon just when the title alone is ambiguous. */}
          {icon ? <View style={styles.accordionIcon}><Ionicons name={icon} size={19} color={tokens.colors.brand} /></View> : null}
          <View style={styles.accordionCopy}>
            <View style={styles.titleRow}>
              <Text style={styles.accordionTitle}>{title}</Text>
              {badge !== undefined ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
            </View>
            {subtitle ? <Text style={styles.accordionSubtitle}>{subtitle}</Text> : null}
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={19} color={tokens.colors.brand} />
        </View>
      </AnimatedPressable>
      {expanded ? <AccordionBody>{children}</AccordionBody> : null}
    </View>
  );
}

export function EmployerInlineState({ icon = 'information-circle-outline', title, body, loading = false, onRetry }: { icon?: IconName; title: string; body?: string; loading?: boolean; onRetry?: () => void }) {
  return (
    <View style={styles.state} accessibilityRole={onRetry ? 'alert' : undefined}>
      {loading ? <ActivityIndicator color={tokens.colors.brand} /> : <Ionicons name={icon} size={28} color={tokens.colors.brand} />}
      <Text style={styles.stateTitle}>{title}</Text>
      {body ? <Text style={styles.stateBody}>{body}</Text> : null}
      {onRetry ? <AnimatedPressable containerStyle={styles.retry} onPress={onRetry} accessibilityRole="button" accessibilityLabel="Try again"><Text style={styles.retryText}>Try again</Text></AnimatedPressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', gap: 12, borderRadius: tokens.radius.lg, padding: tokens.spacing.md, backgroundColor: tokens.colors.brandDark, overflow: 'hidden', ...tokens.shadow.card },
  bannerCopy: { flex: 1 }, eyebrow: { color: tokens.colors.onBrandMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  bannerTitle: { marginTop: 2, color: tokens.colors.onBrand, fontSize: 18, fontWeight: '900' },
  bannerDetail: { marginTop: 4, color: tokens.colors.onBrandMuted, fontSize: 12, lineHeight: 18 },
  metric: { flex: 1, minWidth: 96, minHeight: 104, borderWidth: 1, borderColor: tokens.colors.brandMuted, borderRadius: tokens.radius.lg, padding: tokens.spacing.md, backgroundColor: tokens.colors.brandSoft },
  metricGreen: { borderColor: '#A7F3D0', backgroundColor: tokens.colors.successSoft }, metricAmber: { borderColor: '#FDE68A', backgroundColor: tokens.colors.warningSoft },
  metricValue: { marginTop: 8, color: tokens.colors.brandDark, fontSize: 23, fontWeight: '900' }, metricLabel: { marginTop: 2, color: tokens.colors.textMuted, fontSize: 11, fontWeight: '700' },
  action: { minHeight: 58, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 16, backgroundColor: tokens.colors.surface, overflow: 'hidden' },
  actionRow: { flex: 1, width: '100%', flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13 },
  actionPrimary: { borderColor: tokens.colors.brand, backgroundColor: tokens.colors.brand }, actionQuiet: { borderColor: 'transparent', backgroundColor: tokens.colors.surfaceMuted }, actionDanger: { borderColor: tokens.colors.danger, backgroundColor: tokens.colors.dangerSoft },
  actionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.brandSoft }, actionIconPrimary: { backgroundColor: 'rgba(255,255,255,0.16)' }, actionIconDanger: { backgroundColor: tokens.colors.dangerSoft }, actionLabel: { flex: 1, color: tokens.colors.brandDark, fontSize: 14, fontWeight: '800' }, actionLabelPrimary: { color: tokens.colors.onBrand }, actionLabelDanger: { color: tokens.colors.danger },
  accordion: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.radius.lg, backgroundColor: tokens.colors.surface, overflow: 'hidden', ...tokens.shadow.card },
  accordionHeader: { minHeight: 62 },
  accordionHeaderRow: { flex: 1, width: '100%', flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, paddingHorizontal: 13, paddingVertical: tokens.spacing.sm },
  accordionIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.brandSoft },
  accordionCopy: { flex: 1 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, accordionTitle: { color: tokens.colors.brandDark, fontSize: 15, fontWeight: '900' },
  accordionSubtitle: { marginTop: 2, color: tokens.colors.textMuted, fontSize: 11, lineHeight: 16 }, accordionBody: { borderTopWidth: 1, borderTopColor: tokens.colors.border, padding: tokens.spacing.md },
  badge: { minWidth: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, backgroundColor: tokens.colors.brand }, badgeText: { color: tokens.colors.onBrand, fontSize: 10, fontWeight: '900' },
  state: { minHeight: 150, alignItems: 'center', justifyContent: 'center', borderRadius: tokens.radius.lg, padding: 20, backgroundColor: tokens.colors.surfaceMuted }, stateTitle: { marginTop: 9, color: tokens.colors.brandDark, fontSize: 16, fontWeight: '900', textAlign: 'center' }, stateBody: { marginTop: 5, color: tokens.colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' }, retry: { minHeight: 44, marginTop: 12, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 18, backgroundColor: tokens.colors.brand }, retryText: { color: tokens.colors.onBrand, fontSize: 13, fontWeight: '800' },
});
