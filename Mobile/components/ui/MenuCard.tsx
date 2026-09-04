import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';

export type MenuCardItem = {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  iconBackground: string;
  onPress?: () => void;
  danger?: boolean;
};

/**
 * Settings-style list: leading icon, label, trailing chevron. Unlike the accordion
 * headers, the icons here earn their place — they make a long list scannable.
 */
export default function MenuCard({ items }: { items: MenuCardItem[] }) {
  return (
    <View style={styles.menuCard}>
      {items.map((item, index) => (
        <View key={item.title}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={item.onPress}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={item.title}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconWrap, { backgroundColor: item.iconBackground }]}>
                <Ionicons name={item.icon} size={22} color={item.iconColor} />
              </View>
              <Text style={[styles.menuTitle, item.danger && styles.menuTitleDanger]}>{item.title}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#C0C8D4" />
          </TouchableOpacity>
          {index < items.length - 1 ? <View style={styles.divider} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  menuCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5EAF1',
    ...tokens.shadow.card,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
    minHeight: 84,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexShrink: 1,
    minWidth: 0,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937', flexShrink: 1 },
  menuTitleDanger: { color: tokens.colors.danger },
  divider: {
    height: 1,
    backgroundColor: '#ECEFF5',
    marginLeft: 74,
  },
});
