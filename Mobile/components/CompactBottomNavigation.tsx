import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedPressable from './ui/AnimatedPressable';
import useReducedMotion from '../hooks/useReducedMotion';
import { motion } from '../theme/motion';
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

const BAR_HEIGHT = 62;
const BAR_INSET = 6;
const PILL_HEIGHT = 46;
const PILL_GAP = 6;

const formatBadge = (value: number) => value > 99 ? '99+' : String(value);

export default function CompactBottomNavigation<T extends string>({ items, activeKey, onSelect, isActive }: Props<T>) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion() === true;
  const lastPressRef = useRef<{ key: T; at: number } | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const indicator = useRef(new Animated.Value(0)).current;

  const activeResolver = useMemo(() => isActive || ((current: T, item: T) => current === item), [isActive]);
  const activeIndex = items.findIndex((item) => activeResolver(activeKey, item.key));
  const itemWidth = items.length > 0 && trackWidth > 0 ? trackWidth / items.length : 0;
  const activeItem = activeIndex >= 0 ? items[activeIndex] : undefined;
  // An emphasized item draws its own raised circle, so the sliding pill would double up behind it.
  const showIndicator = itemWidth > 0 && activeIndex >= 0 && !activeItem?.emphasized;

  useEffect(() => {
    if (itemWidth <= 0 || activeIndex < 0) return;
    const toValue = activeIndex * itemWidth;
    const animation = reducedMotion
      ? Animated.timing(indicator, { toValue, duration: motion.duration.instant, useNativeDriver: true })
      : Animated.spring(indicator, { toValue, useNativeDriver: true, ...motion.spring });
    animation.start();
    return () => animation.stop();
  }, [activeIndex, itemWidth, indicator, reducedMotion]);

  const handleSelect = useCallback((key: T, selected: boolean) => {
    if (selected || !onSelect) return;
    const now = Date.now();
    const previous = lastPressRef.current;
    if (previous && now - previous.at < 350) return;
    lastPressRef.current = { key, at: now };
    onSelect(key);
  }, [onSelect]);

  return (
    <View
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, tokens.spacing.sm) }]}
      pointerEvents="box-none"
    >
      <View style={styles.barShadow}>
        <BlurView
          intensity={Platform.OS === 'android' ? 40 : 60}
          tint="light"
          // Android needs the newer blur implementation; the translucent tint below
          // keeps the bar legible anywhere real blurring is unavailable.
          experimentalBlurMethod="dimezisBlurView"
          style={styles.bar}
          accessibilityRole="tablist"
        >
          <View style={styles.barTint} pointerEvents="none" />
          {/* Flat hairline along the top edge reads as a glass edge without a gradient. */}
          <View style={styles.sheen} pointerEvents="none" />

          <View style={styles.track} onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
            {showIndicator ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.indicator,
                  {
                    width: Math.max(0, itemWidth - PILL_GAP),
                    transform: [{ translateX: Animated.add(indicator, new Animated.Value(PILL_GAP / 2)) }],
                  },
                ]}
              />
            ) : null}

            {items.map((item) => {
              const selected = activeResolver(activeKey, item.key);
              const badge = Math.max(0, Number(item.badge) || 0);
              const label = badge > 0 ? `${item.label}, ${badge} unread` : item.label;
              const iconColor = item.emphasized
                ? tokens.colors.onBrand
                : selected ? tokens.colors.onBrand : tokens.colors.navMutedIcon;
              return (
                <AnimatedPressable
                  key={item.key}
                  containerStyle={[styles.item, item.emphasized && styles.emphasizedItem]}
                  pressedScale={0.92}
                  onPress={() => handleSelect(item.key, selected)}
                  accessibilityRole="tab"
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.icon, item.emphasized && styles.iconEmphasized]}>
                    {item.profileInitials ? (
                      <Text style={[styles.initials, selected && styles.initialsSelected]}>
                        {item.profileInitials.slice(0, 2).toUpperCase()}
                      </Text>
                    ) : (
                      <Ionicons
                        name={selected ? item.activeIcon : item.icon}
                        size={item.emphasized ? 24 : tokens.navigation.iconSize}
                        color={iconColor}
                      />
                    )}
                    {badge > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{formatBadge(badge)}</Text>
                      </View>
                    ) : null}
                  </View>
                </AnimatedPressable>
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: tokens.layout.gutter,
    paddingTop: tokens.spacing.xs,
  },
  barShadow: {
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: 'transparent',
    shadowColor: tokens.colors.brandDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 12,
  },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    paddingHorizontal: BAR_INSET,
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.navGlassBorder,
  },
  // Sits under the items so the frosted panel keeps contrast over busy backgrounds.
  barTint: { ...StyleSheet.absoluteFillObject, backgroundColor: tokens.colors.navGlass },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: tokens.colors.navSheen },
  track: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  indicator: {
    position: 'absolute',
    left: 0,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    backgroundColor: tokens.colors.brand,
  },
  item: { flex: 1, minWidth: 0, height: PILL_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  emphasizedItem: { overflow: 'visible' },
  icon: { position: 'relative', width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconEmphasized: { width: 44, height: 44, borderRadius: 22, backgroundColor: tokens.colors.brand },
  initials: { color: tokens.colors.navMutedIcon, fontSize: 13, fontWeight: '800' },
  initialsSelected: { color: tokens.colors.onBrand },
  badge: {
    position: 'absolute',
    top: -2,
    right: 0,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.white,
    backgroundColor: tokens.colors.danger,
  },
  badgeText: { color: tokens.colors.white, fontSize: 9, fontWeight: '800' },
});
