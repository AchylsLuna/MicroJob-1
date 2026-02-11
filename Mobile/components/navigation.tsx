import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

type NavItem = { 
  label: string; 
  icon: string; 
  badge?: number; 
  active?: boolean;
  screen?: string;
};

type Props = {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
};

export default function Navigation({ activeTab = 'Home', onTabPress }: Props) {
  const navItems: NavItem[] = [
    { label: 'Home', icon: '🏠', screen: 'Home' },
    { label: 'Jobs', icon: '💼', screen: 'Jobs' },
    { label: 'Saved', icon: '🔖', screen: 'Saved' },
    { label: 'Messages', icon: '✉️', screen: 'Messages' },
    { label: 'Profile', icon: '👤', screen: 'Profile' },
  ];

  return (
    <View style={styles.tabBar}>
      {navItems.map((item) => {
        const isActive = activeTab === item.screen;
        return (
          <TouchableOpacity
            key={item.label}
            style={styles.tabItem}
            onPress={() => onTabPress?.(item.screen || item.label)}
          >
            <View style={styles.iconContainer}>
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
                {item.icon}
              </Text>
              {item.badge !== undefined && item.badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingBottom: 8,
    paddingTop: 8,
    height: 65,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
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
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 22,
    color: '#9ca3af',
  },
  tabIconActive: {
    color: '#1f2937',
  },
  tabLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#1f2937',
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});