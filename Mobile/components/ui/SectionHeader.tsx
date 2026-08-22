import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AnimatedPressable from './AnimatedPressable';
import { tokens } from '../../theme/tokens';

type Props = {
  title: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
};

export default function SectionHeader({ title, onSeeAll, seeAllLabel = 'See all' }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {onSeeAll ? (
        <AnimatedPressable containerStyle={styles.seeAllBtn} onPress={onSeeAll} accessibilityRole="button" accessibilityLabel={`${seeAllLabel} — ${title}`}>
          <Text style={styles.seeAll}>{seeAllLabel} ›</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: tokens.typography.h3, fontWeight: '800', color: tokens.colors.sectionText },
  seeAllBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  seeAll: { fontSize: 13, fontWeight: '700', color: tokens.colors.onCanvasMuted },
});
