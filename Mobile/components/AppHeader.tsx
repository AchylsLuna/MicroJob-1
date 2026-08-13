import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../theme/tokens';
import { StatusBar } from 'expo-status-bar';
import { AnimatedMicroJobsLogoBadge } from './auth/MicroJobsLogo';

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightLabel?: string;
  onRightPress?: () => void;
  rightIconName?: React.ComponentProps<typeof Ionicons>['name'];
  rightAccessibilityLabel?: string;
  rightBadgeCount?: number;
  showBrandBadge?: boolean;
  employerMode?: boolean;
};

export default function AppHeader({
  title,
  subtitle,
  onBack,
  rightLabel,
  onRightPress,
  rightIconName,
  rightAccessibilityLabel,
  rightBadgeCount = 0,
  showBrandBadge = false,
  employerMode = false,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const showRightAction = Boolean(onRightPress && (rightLabel || rightIconName));

  return (
    <View style={[styles.wrapper, { paddingTop: Math.max(insets.top, 10) + 10 }]}>
      <StatusBar style="dark" />
      <View style={styles.row}>
        <View style={styles.side}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.iconButton} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
              <Ionicons name="chevron-back" size={20} color={tokens.colors.brand} />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButtonPlaceholder} />
          )}
        </View>

        <View style={[styles.center, showBrandBadge && styles.brandedCenter]}>
          {showBrandBadge ? <AnimatedMicroJobsLogoBadge /> : null}
          <View style={showBrandBadge ? styles.titleCopy : undefined}>
            <Text style={[styles.title, showBrandBadge && styles.brandedTitle]} numberOfLines={1}>{title}</Text>
            {employerMode ? <View style={styles.employerPill}><Ionicons name="business-outline" size={10} color={tokens.colors.brand} /><Text style={styles.employerPillText}>Employer Mode</Text></View> : null}
            {subtitle ? <Text style={[styles.subtitle, showBrandBadge && styles.brandedSubtitle]} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </View>

        <View style={[styles.side, styles.sideEnd]}>
          {showRightAction ? (
            <TouchableOpacity
              onPress={onRightPress}
              style={[styles.actionButton, !rightLabel && styles.iconOnlyAction]}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={rightAccessibilityLabel || rightLabel}
            >
              {rightIconName ? (
                <Ionicons name={rightIconName} size={15} color={tokens.colors.brand} style={styles.actionIcon} />
              ) : null}
              {rightLabel ? <Text style={styles.actionText}>{rightLabel}</Text> : null}
              {rightBadgeCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{rightBadgeCount > 99 ? '99+' : String(rightBadgeCount)}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButtonPlaceholder} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    paddingBottom: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    width: 84,
    minHeight: 36,
    justifyContent: 'center',
  },
  sideEnd: {
    alignItems: 'flex-end',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.sm,
  },
  brandedCenter: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
  },
  titleCopy: {
    minWidth: 0,
    flexShrink: 1,
  },
  employerPill: { minHeight: 22, marginTop: 2, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: tokens.radius.pill, paddingHorizontal: 7, backgroundColor: tokens.colors.brandSoft },
  employerPillText: { color: tokens.colors.brand, fontSize: 9, fontWeight: '900' },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: tokens.colors.text,
    textAlign: 'center',
  },
  brandedTitle: {
    color: tokens.colors.brandDark,
    textAlign: 'left',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: tokens.colors.textMuted,
    textAlign: 'center',
  },
  brandedSubtitle: {
    textAlign: 'left',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  actionButton: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brandSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOnlyAction: {
    width: 44,
    height: 44,
    paddingHorizontal: 0,
    borderRadius: tokens.radius.md,
  },
  actionIcon: {
    marginRight: 4,
  },
  actionText: {
    fontSize: 12,
    color: tokens.colors.brand,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.surface,
    backgroundColor: tokens.colors.danger,
  },
  badgeText: {
    color: tokens.colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
});
