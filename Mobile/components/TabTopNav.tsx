import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { tokens } from '../theme/tokens';
import { AnimatedMicroJobsLogoBadge } from './auth/MicroJobsLogo';

type Role = 'worker' | 'employer';

type TabTopNavProps = {
  title: string;
  subtitle?: string;
  subtitleIcon?: React.ComponentProps<typeof Ionicons>['name'];
  onSubtitlePress?: () => void;
  homeContext?: boolean;
  currentRole?: Role;
  onSwitchRole?: (role: Role) => void;
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
  notificationBadgeCount?: number;
  showModeSwitch?: boolean;
  showSettings?: boolean;
  showNotifications?: boolean;
  employerMode?: boolean;
};

export default function TabTopNav({
  title,
  subtitle,
  subtitleIcon = 'location-outline',
  onSubtitlePress,
  homeContext = false,
  currentRole = 'worker',
  onSwitchRole,
  onOpenSettings,
  onOpenNotifications,
  notificationBadgeCount = 0,
  showModeSwitch = false,
  showSettings = false,
  showNotifications = false,
  employerMode = false,
}: TabTopNavProps) {
  const insets = useSafeAreaInsets();
  const nextRole: Role = currentRole === 'worker' ? 'employer' : 'worker';
  const shouldShowActions = showModeSwitch || showSettings || showNotifications;

  return (
    <View style={[styles.topHeader, homeContext && styles.homeHeader, { paddingTop: Math.max(insets.top, 10) + 10 }]}>
      <StatusBar style="dark" />
      <View style={styles.titleGroup}>
        <AnimatedMicroJobsLogoBadge />
        <View style={styles.titleCopy}>
          <Text style={styles.topHeaderTitle} numberOfLines={1}>{title}</Text>
          {employerMode ? <View style={styles.employerPill}><Ionicons name="business-outline" size={11} color={tokens.colors.brand} /><Text style={styles.employerPillText}>Employer Mode</Text></View> : null}
          {subtitle ? (
            <TouchableOpacity
              style={[styles.subtitlePill, !onSubtitlePress && styles.subtitlePillStatic]}
              onPress={onSubtitlePress}
              disabled={!onSubtitlePress}
              activeOpacity={0.82}
              hitSlop={6}
              accessibilityRole={onSubtitlePress ? 'button' : undefined}
              accessibilityLabel={onSubtitlePress ? `${subtitle}. Open Philippine location settings` : undefined}
            >
              <Ionicons name={subtitleIcon} size={13} color={tokens.colors.brand} />
              <Text style={styles.subtitleText} numberOfLines={1}>{subtitle}</Text>
              {onSubtitlePress ? <Ionicons name="chevron-forward" size={12} color={tokens.colors.brand} /> : null}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {shouldShowActions ? (
        <View style={styles.topHeaderActions}>
          {showModeSwitch ? (
            <TouchableOpacity
              style={[styles.modeButton, !onSwitchRole && styles.disabledButton]}
              onPress={() => onSwitchRole?.(nextRole)}
              activeOpacity={0.9}
              disabled={!onSwitchRole}
            >
              <Ionicons
                name={nextRole === 'employer' ? 'business-outline' : 'person-outline'}
                size={17}
                color={tokens.colors.brand}
              />
              <Text style={styles.modeButtonText} numberOfLines={1}>
                {nextRole === 'employer' ? 'Employer Mode' : 'Worker Mode'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {showSettings ? (
            <TouchableOpacity
              style={[styles.settingsButton, !onOpenSettings && styles.disabledButton]}
              onPress={onOpenSettings}
              activeOpacity={0.9}
              disabled={!onOpenSettings}
              accessibilityLabel="Open settings"
            >
              <Ionicons name="settings-outline" size={19} color={tokens.colors.brand} />
            </TouchableOpacity>
          ) : null}

          {showNotifications ? (
            <TouchableOpacity
              style={[styles.settingsButton, !onOpenNotifications && styles.disabledButton]}
              onPress={onOpenNotifications}
              activeOpacity={0.9}
              disabled={!onOpenNotifications}
              accessibilityRole="button"
              accessibilityLabel={`Open notifications${notificationBadgeCount > 0 ? `, ${notificationBadgeCount > 99 ? '99+' : notificationBadgeCount} unread` : ''}`}
              accessibilityState={{ disabled: !onOpenNotifications }}
            >
              <Ionicons name="notifications-outline" size={19} color={tokens.colors.brand} />
              {notificationBadgeCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{notificationBadgeCount > 99 ? '99+' : String(notificationBadgeCount)}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    paddingHorizontal: tokens.layout.gutterWide,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  topHeaderTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: tokens.colors.brandDark,
    letterSpacing: -0.3,
  },
  homeHeader: {
    borderBottomWidth: 3,
    borderBottomColor: tokens.colors.brandSoft,
    paddingBottom: 12,
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleCopy: { flex: 1, minWidth: 0, gap: 4 },
  employerPill: { minHeight: 24, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: tokens.radius.pill, paddingHorizontal: 8, backgroundColor: tokens.colors.brandSoft },
  employerPillText: { color: tokens.colors.brand, fontSize: 10, fontWeight: '900' },
  subtitlePill: {
    minHeight: 28,
    maxWidth: '100%',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brandSoft,
  },
  subtitlePillStatic: { paddingRight: 10 },
  subtitleText: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: tokens.colors.brandDark,
  },
  topHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  modeButton: {
    flexShrink: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...tokens.shadow.card,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    flexShrink: 1,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  disabledButton: {
    opacity: 0.55,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: tokens.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: tokens.colors.surface,
  },
  badgeText: {
    color: tokens.colors.surface,
    fontSize: 10,
    fontWeight: '700',
  },
});
