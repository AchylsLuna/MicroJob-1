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
  currentRole?: Role;
  onSwitchRole?: (role: Role) => void;
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
  notificationBadgeCount?: number;
  showModeSwitch?: boolean;
  showSettings?: boolean;
  showNotifications?: boolean;
};

export default function TabTopNav({
  title,
  currentRole = 'worker',
  onSwitchRole,
  onOpenSettings,
  onOpenNotifications,
  notificationBadgeCount = 0,
  showModeSwitch = false,
  showSettings = false,
  showNotifications = false,
}: TabTopNavProps) {
  const insets = useSafeAreaInsets();
  const nextRole: Role = currentRole === 'worker' ? 'employer' : 'worker';
  const shouldShowActions = showModeSwitch || showSettings || showNotifications;

  return (
    <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 10) + 10 }]}>
      <StatusBar style="dark" />
      <View style={styles.titleGroup}>
        <AnimatedMicroJobsLogoBadge />
        <Text style={styles.topHeaderTitle} numberOfLines={1}>
          {title}
        </Text>
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
              accessibilityLabel="Open notifications"
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
    flex: 1,
    minWidth: 0,
    paddingRight: 6,
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
