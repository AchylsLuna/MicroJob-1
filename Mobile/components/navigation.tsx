import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../theme/tokens';

type WorkerTab = 'Home' | 'Jobs' | 'EWallet' | 'Messages' | 'Profile';

type NavItem = {
  label: string;
  screen: WorkerTab;
  iconInactive?: string;
  iconActive?: string;
};

type Props = {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  messageBadgeCount?: number;
  profileInitials?: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', screen: 'Home', iconInactive: 'home-outline', iconActive: 'home' },
  { label: 'Jobs', screen: 'Jobs', iconInactive: 'briefcase-outline', iconActive: 'briefcase' },
  { label: 'E-Wallet', screen: 'EWallet', iconInactive: 'wallet-outline', iconActive: 'wallet' },
  { label: 'Messages', screen: 'Messages', iconInactive: 'chatbubble-outline', iconActive: 'chatbubble' },
  { label: 'Profile', screen: 'Profile' },
];

const formatBadgeCount = (count: number) => (count > 99 ? '99+' : String(count));

export default function Navigation({
  activeTab = 'Home',
  onTabPress,
  messageBadgeCount = 0,
  profileInitials = 'JD',
}: Props) {
  return (
    <View style={styles.tabBar}>
      {NAV_ITEMS.map((item) => {
        const isEWalletSelected = item.screen === 'EWallet' && (activeTab === 'EWallet' || activeTab === 'E-Wallet');
        const isActive = activeTab === item.screen || isEWalletSelected;
        const hasMessageBadge = item.screen === 'Messages' && messageBadgeCount > 0;

        return (
          <TouchableOpacity
            key={item.screen}
            style={styles.tabItem}
            onPress={() => onTabPress?.(item.screen)}
            activeOpacity={0.85}
          >
            <View style={styles.iconContainer}>
              {item.screen === 'Profile' ? (
                <View style={[styles.profileChip, isActive && styles.profileChipActive]}>
                  <Text style={[styles.profileChipText, isActive && styles.profileChipTextActive]}>
                    {profileInitials.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              ) : (
                <Ionicons
                  name={(isActive ? item.iconActive : item.iconInactive) as any}
                  size={24}
                  color={isActive ? tokens.colors.brand : tokens.colors.textMuted}
                />
              )}

              {hasMessageBadge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{formatBadgeCount(messageBadgeCount)}</Text>
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
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 78,
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
  },
  iconContainer: {
    position: 'relative',
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    color: tokens.colors.textMuted,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: tokens.colors.brand,
    fontWeight: '700',
  },
  profileChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#dbe5f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileChipActive: {
    backgroundColor: tokens.colors.brand,
  },
  profileChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  profileChipTextActive: {
    color: tokens.colors.white,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -8,
    backgroundColor: tokens.colors.danger,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  badgeText: {
    color: tokens.colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
});
