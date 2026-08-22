import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { getCategoryVisual } from '../../theme/categoryVisuals';

type Size = 'sm' | 'md' | 'lg';

const DIMENSIONS: Record<Size, { box: number; icon: number; radius: number }> = {
  sm: { box: 44, icon: 18, radius: tokens.radius.md },
  md: { box: 56, icon: 22, radius: tokens.radius.md },
  lg: { box: 96, icon: 26, radius: tokens.radius.lg },
};

type Props = {
  category?: { id?: string; name?: string } | string | null;
  size?: Size;
  showLabel?: boolean;
  count?: number;
};

export default function CategoryTile({ category, size = 'md', showLabel = false, count }: Props) {
  const visual = getCategoryVisual(category);
  const dims = DIMENSIONS[size];
  const name = typeof category === 'string' ? undefined : category?.name;

  return (
    <View style={showLabel ? styles.withLabel : undefined}>
      <View
        style={[styles.tile, { width: dims.box, height: dims.box, borderRadius: dims.radius, backgroundColor: visual.fill }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Ionicons name={visual.icon} size={dims.icon} color={visual.onFill} />
      </View>
      {showLabel ? (
        <View style={styles.labelWrap}>
          {typeof count === 'number' ? <Text style={styles.count}>{count}</Text> : null}
          {name ? (
            <Text style={styles.label} numberOfLines={2}>
              {name}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', ...tokens.shadow.card },
  withLabel: { alignItems: 'center', width: 116, gap: tokens.spacing.xs },
  labelWrap: { alignItems: 'center', gap: 2 },
  count: { fontSize: tokens.typography.h3, fontWeight: '800', color: tokens.colors.sectionText },
  label: { fontSize: tokens.typography.caption, fontWeight: '700', color: tokens.colors.onCanvasMuted, textAlign: 'center' },
});
