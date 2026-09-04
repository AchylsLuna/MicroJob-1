import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';

type Props = {
  label: string;
  value: string | number;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  /** Secondary line under the value, e.g. a review count. */
  caption?: string;
  style?: StyleProp<ViewStyle>;
};

export default function StatTile({ label, value, icon, iconColor = tokens.colors.brand, caption, style }: Props) {
  return (
    <View style={[styles.tile, style]} accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
      <View style={styles.valueRow}>
        {icon ? <Ionicons name={icon} size={16} color={iconColor} /> : null}
        <Text style={styles.value} numberOfLines={1}>{value}</Text>
      </View>
      {caption ? <Text style={styles.caption} numberOfLines={1}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: 78,
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  label: { color: tokens.colors.textMuted, fontSize: 12, fontWeight: '600' },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  value: { color: tokens.colors.brandDark, fontSize: 20, fontWeight: '900' },
  caption: { color: tokens.colors.textSubtle, fontSize: 11, fontWeight: '600' },
});
