import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../theme/tokens';
import { useAppSession } from '../contexts/AppSessionContext';

type EmployerTab = 'Home' | 'Applications' | 'Post Job' | 'Messages' | 'Notifications' | 'Profile';

type NavItem = {
  label: string;
  screen: EmployerTab;
  iconInactive?: React.ComponentProps<typeof Ionicons>['name'];
  iconActive?: React.ComponentProps<typeof Ionicons>['name'];
  badge?: number;
};

type Props = {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  notificationsCount?: number;
  profileInitials?: string;
};

const formatBadgeCount = (count: number) => (count > 99 ? '99+' : String(count));

export default function EmployerNavigation({
  activeTab = 'Home',
  onTabPress,
  notificationsCount,
  profileInitials = 'JD',
}: Props) {
  const insets = useSafeAreaInsets();
  const session = useAppSession();
  const resolvedNotificationsCount =
    typeof notificationsCount === 'number' ? notificationsCount : session.employerNotifications.length;

  const navItems: NavItem[] = [
    { label: 'Home', screen: 'Home', iconInactive: 'home-outline', iconActive: 'home' },
    {
      label: 'Applications',
      screen: 'Applications',
      iconInactive: 'clipboard-outline',
      iconActive: 'clipboard',
    },
    { label: 'Post Job', screen: 'Post Job', iconInactive: 'add-circle-outline', iconActive: 'add-circle' },
    { label: 'Messages', screen: 'Messages', iconInactive: 'chatbubble-outline', iconActive: 'chatbubble' },
    {
      label: 'Alerts',
      screen: 'Notifications',
      iconInactive: 'notifications-outline',
      iconActive: 'notifications',
      badge: resolvedNotificationsCount,
    },
    { label: 'Profile', screen: 'Profile' },
  ];

  return (
    <View style={styles.navWrapper}>
      <View
        style={[
          styles.tabBar,
          {
            paddingBottom: Math.max(insets.bottom, 10) + 4,
            minHeight: 82 + Math.max(insets.bottom, 10),
          },
        ]}
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.screen;
          const hasBadge = item.screen === 'Notifications' && (item.badge || 0) > 0;
          return (
            <TouchableOpacity
              key={item.label}
              style={styles.tabItem}
              onPress={() => onTabPress?.(item.screen)}
              activeOpacity={0.85}
            >
              <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
                {item.screen === 'Profile' ? (
                  <View style={[styles.profileChip, isActive && styles.profileChipActive]}>
                    <Text style={[styles.profileChipText, isActive && styles.profileChipTextActive]}>
                      {profileInitials.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                ) : (
                  <Ionicons
                    name={isActive ? item.iconActive : item.iconInactive}
                    size={tokens.navigation.iconSize}
                    color={isActive ? tokens.colors.brand : tokens.colors.textMuted}
                  />
                )}
                {hasBadge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{formatBadgeCount(item.badge || 0)}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navWrapper: {
    backgroundColor: tokens.colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingTop: tokens.spacing.sm,
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing.xxs,
    marginHorizontal: tokens.spacing.xxs,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    minHeight: tokens.navigation.itemMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 1,
    paddingVertical: 0,
  },
  iconContainer: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerActive: {
    backgroundColor: tokens.colors.brandSoft,
  },
  tabLabel: {
    marginTop: 8,
    fontSize: tokens.navigation.labelSize,
    lineHeight: 13,
    color: tokens.colors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
    includeFontPadding: false,
  },
  tabLabelActive: {
    color: tokens.colors.brand,
    fontWeight: '700',
  },
  profileChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.brandMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileChipActive: {
    backgroundColor: tokens.colors.brand,
  },
  profileChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.textMuted,
  },
  profileChipTextActive: {
    color: tokens.colors.white,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    backgroundColor: tokens.colors.danger,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.white,
  },
  badgeText: {
    color: tokens.colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
});
