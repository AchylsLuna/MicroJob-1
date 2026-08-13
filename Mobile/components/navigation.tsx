import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../theme/tokens';
import AnimatedPressable from './ui/AnimatedPressable';
import { useAppSession } from '../contexts/AppSessionContext';
import { isNavigationTabActive } from './navigationState';
import type { WorkerTab } from './tabNavigation';

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
  messageBadgeCount,
}: Props) {
  const insets = useSafeAreaInsets();
  const session = useAppSession();
  const resolvedMessageBadgeCount = typeof messageBadgeCount === 'number' ? messageBadgeCount : session.unreadMessageCount;
  const resolvedProfileInitials = session.navigationProfileInitials;
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
        {NAV_ITEMS.map((item) => {
          const isActive = isNavigationTabActive(activeTab, item.screen);
          const hasMessageBadge = item.screen === 'Messages' && resolvedMessageBadgeCount > 0;

          return (
            <AnimatedPressable
              key={item.screen}
              containerStyle={styles.tabItem}
              onPress={() => onTabPress?.(item.screen)}
              accessibilityRole="tab"
              accessibilityLabel={hasMessageBadge ? `${item.label}, ${resolvedMessageBadgeCount} unread` : item.label}
              accessibilityState={{ selected: isActive }}
            >
              <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
                {item.screen === 'Profile' ? (
                  <View style={[styles.profileChip, isActive && styles.profileChipActive]}>
                    <Text style={[styles.profileChipText, isActive && styles.profileChipTextActive]}>
                      {resolvedProfileInitials.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                ) : (
                  <Ionicons
                    name={(isActive ? item.iconActive : item.iconInactive) as any}
                    size={tokens.navigation.iconSize}
                    color={isActive ? tokens.colors.brand : tokens.colors.textMuted}
                  />
                )}

                {hasMessageBadge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{formatBadgeCount(resolvedMessageBadgeCount)}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
                {item.label}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navWrapper: {
    backgroundColor: tokens.colors.signedInCanvas,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingTop: tokens.spacing.sm,
    borderRadius: 22,
    paddingHorizontal: tokens.spacing.xs,
    marginHorizontal: tokens.layout.gutter,
    marginBottom: tokens.spacing.xs,
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
    borderColor: tokens.colors.surface,
  },
  badgeText: {
    color: tokens.colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
});
