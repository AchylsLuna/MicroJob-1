import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
                  color={isActive ? '#102a56' : '#6b7280'}
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
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 78,
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
    color: '#6b7280',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#102a56',
    fontWeight: '700',
  },
  profileChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileChipActive: {
    backgroundColor: '#102a56',
  },
  profileChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4b5563',
  },
  profileChipTextActive: {
    color: '#ffffff',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -8,
    backgroundColor: '#ef4444',
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
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
