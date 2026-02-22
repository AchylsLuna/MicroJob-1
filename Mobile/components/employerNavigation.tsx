import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../theme/tokens';

type EmployerTab = 'Home' | 'Applications' | 'Post Job' | 'Messages' | 'Notifications' | 'Profile';

type NavItem = {
  label: string;
  screen: EmployerTab;
  iconInactive: React.ComponentProps<typeof Ionicons>['name'];
  iconActive: React.ComponentProps<typeof Ionicons>['name'];
  badge?: number;
};

type Props = {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  notificationsCount?: number;
};

const formatBadgeCount = (count: number) => (count > 99 ? '99+' : String(count));

export default function EmployerNavigation({
  activeTab = 'Home',
  onTabPress,
  notificationsCount,
}: Props) {
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
      label: 'Notifications',
      screen: 'Notifications',
      iconInactive: 'notifications-outline',
      iconActive: 'notifications',
      badge: notificationsCount,
    },
    { label: 'Profile', screen: 'Profile', iconInactive: 'person-outline', iconActive: 'person' },
  ];

  return (
    <View style={styles.tabBar}>
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
            <View style={styles.iconContainer}>
              <Ionicons
                name={isActive ? item.iconActive : item.iconInactive}
                size={22}
                color={isActive ? tokens.colors.brand : tokens.colors.textMuted}
              />
              {hasBadge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{formatBadgeCount(item.badge || 0)}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingBottom: 8,
    paddingTop: 8,
    minHeight: 70,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  iconContainer: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    color: tokens.colors.textMuted,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: tokens.colors.brand,
    fontWeight: '700',
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

