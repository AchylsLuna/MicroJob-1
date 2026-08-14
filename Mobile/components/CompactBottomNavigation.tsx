import React, { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedPressable from './ui/AnimatedPressable';
import { tokens } from '../theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type CompactNavigationItem<T extends string> = {
  key: T;
  label: string;
  icon: IconName;
  activeIcon: IconName;
  badge?: number;
  profileInitials?: string;
  emphasized?: boolean;
};

type Props<T extends string> = {
  items: CompactNavigationItem<T>[];
  activeKey: T;
  onSelect?: (key: T) => void;
  isActive?: (activeKey: T, itemKey: T) => boolean;
};

const formatBadge = (value: number) => value > 99 ? '99+' : String(value);

export default function CompactBottomNavigation<T extends string>({ items, activeKey, onSelect, isActive }: Props<T>) {
  const insets = useSafeAreaInsets();
  const lastPressRef = useRef<{ key: T; at: number } | null>(null);
  const bottomInset = Math.max(0, insets.bottom);
  const activeResolver = useMemo(() => isActive || ((current: T, item: T) => current === item), [isActive]);

  const handleSelect = useCallback((key: T, selected: boolean) => {
    if (selected || !onSelect) return;
    const now = Date.now();
    const previous = lastPressRef.current;
    if (previous && now - previous.at < 350) return;
    lastPressRef.current = { key, at: now };
    onSelect(key);
  }, [onSelect]);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.bar, { paddingBottom: bottomInset, minHeight: tokens.navigation.barContentHeight + bottomInset }]} accessibilityRole="tablist">
        {items.map((item) => {
          const selected = activeResolver(activeKey, item.key);
          const badge = Math.max(0, Number(item.badge) || 0);
          const label = badge > 0 ? `${item.label}, ${badge} unread` : item.label;
          return (
            <AnimatedPressable
              key={item.key}
              containerStyle={[styles.item, item.emphasized && styles.emphasizedItem]}
              pressedScale={0.96}
              onPress={() => handleSelect(item.key, selected)}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
            >
              <View style={[
                styles.icon,
                selected && styles.iconSelected,
                item.emphasized && styles.iconEmphasized,
                item.emphasized && selected && styles.iconEmphasizedSelected,
              ]}>
                {item.profileInitials ? (
                  <Text style={[styles.initials, selected && styles.initialsSelected]}>{item.profileInitials.slice(0, 2).toUpperCase()}</Text>
                ) : (
                  <Ionicons name={selected ? item.activeIcon : item.icon} size={item.emphasized ? 24 : tokens.navigation.iconSize} color={item.emphasized ? tokens.colors.onBrand : selected ? tokens.colors.brand : tokens.colors.textMuted} />
                )}
                {badge > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{formatBadge(badge)}</Text></View> : null}
              </View>
              <Text style={[styles.label, selected && styles.labelSelected, item.emphasized && styles.labelEmphasized]} numberOfLines={1} maxFontSizeMultiplier={1.25}>
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
  wrapper: { backgroundColor: tokens.colors.signedInCanvas, paddingHorizontal: tokens.layout.gutter, paddingBottom: tokens.spacing.xxs },
  bar: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 4, paddingHorizontal: 3, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 19, backgroundColor: tokens.colors.surface, shadowColor: '#0F172A', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 7 },
  item: { flex: 1, minWidth: 0, height: tokens.navigation.barContentHeight - 5, alignItems: 'center', justifyContent: 'center' },
  emphasizedItem: { transform: [{ translateY: -11 }], overflow: 'visible' },
  icon: { position: 'relative', width: 34, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconSelected: { backgroundColor: tokens.colors.brandSoft },
  iconEmphasized: { width: 48, height: 48, borderRadius: 24, backgroundColor: tokens.colors.brand, borderWidth: 3, borderColor: tokens.colors.surface, shadowColor: tokens.colors.brandDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.24, shadowRadius: 7, elevation: 7 },
  iconEmphasizedSelected: { backgroundColor: tokens.colors.brandDark },
  initials: { color: tokens.colors.textMuted, fontSize: 12, fontWeight: '800' },
  initialsSelected: { color: tokens.colors.brand },
  label: { width: '100%', marginTop: 1, color: tokens.colors.textMuted, fontSize: tokens.navigation.labelSize, lineHeight: 11, fontWeight: '600', textAlign: 'center', includeFontPadding: false },
  labelSelected: { color: tokens.colors.brand, fontWeight: '800' },
  labelEmphasized: { marginTop: -1, color: tokens.colors.brand, fontWeight: '800' },
  badge: { position: 'absolute', top: -3, right: -7, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tokens.colors.surface, backgroundColor: tokens.colors.danger },
  badgeText: { color: tokens.colors.white, fontSize: 9, fontWeight: '800' },
});
