import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../theme/tokens';

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
  const showRightAction = Boolean(rightLabel && onRightPress);

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <View style={styles.side}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.iconButton} activeOpacity={0.85}>
              <Ionicons name="chevron-back" size={20} color={tokens.colors.white} />
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
                <Ionicons name={rightIconName} size={15} color={tokens.colors.white} style={styles.actionIcon} />
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
    backgroundColor: '#0a2847',
    paddingTop: 54,
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
    color: tokens.colors.white,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#dbe8ff',
    textAlign: 'center',
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPlaceholder: {
    width: 34,
    height: 34,
  },
  actionButton: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: tokens.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    marginRight: 4,
  },
  actionText: {
    fontSize: 12,
    color: tokens.colors.white,
    fontWeight: '700',
  },
});
