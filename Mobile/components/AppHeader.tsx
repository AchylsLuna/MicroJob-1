import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../theme/tokens';
import { StatusBar } from 'expo-status-bar';

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightLabel?: string;
  onRightPress?: () => void;
  rightIconName?: React.ComponentProps<typeof Ionicons>['name'];
};

export default function AppHeader({
  title,
  subtitle,
  onBack,
  rightLabel,
  onRightPress,
  rightIconName,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const showRightAction = Boolean(rightLabel && onRightPress);

  return (
    <View style={[styles.wrapper, { paddingTop: Math.max(insets.top, 10) + 10 }]}>
      <StatusBar style="dark" />
      <View style={styles.row}>
        <View style={styles.side}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.iconButton} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
              <Ionicons name="chevron-back" size={20} color={tokens.colors.brand} />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButtonPlaceholder} />
          )}
        </View>

        <View style={styles.center}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={[styles.side, styles.sideEnd]}>
          {showRightAction ? (
            <TouchableOpacity onPress={onRightPress} style={styles.actionButton} activeOpacity={0.85}>
              {rightIconName ? (
                <Ionicons name={rightIconName} size={15} color={tokens.colors.brand} style={styles.actionIcon} />
              ) : null}
              <Text style={styles.actionText}>{rightLabel}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButtonPlaceholder} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    paddingBottom: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    width: 84,
    minHeight: 36,
    justifyContent: 'center',
  },
  sideEnd: {
    alignItems: 'flex-end',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: tokens.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: tokens.colors.textMuted,
    textAlign: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  actionButton: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brandSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    marginRight: 4,
  },
  actionText: {
    fontSize: 12,
    color: tokens.colors.brand,
    fontWeight: '700',
  },
});
