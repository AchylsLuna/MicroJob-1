import React, { memo } from 'react';
import { StyleSheet, Text, View, type ViewStyle, type StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import AnimatedPressable from '../ui/AnimatedPressable';
import CategoryTile from '../ui/CategoryTile';
import type { JobCardData } from './jobCardModel';

type Variant = 'carousel' | 'list' | 'compact';

type Props = {
  job: JobCardData;
  variant: Variant;
  saved?: boolean;
  onPress: () => void;
  onToggleSave?: () => void;
  showMatch?: boolean;
  footerSlot?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

function BookmarkButton({ saved, onToggleSave, tone = 'default' }: { saved?: boolean; onToggleSave?: () => void; tone?: 'default' | 'onFill' }) {
  if (!onToggleSave) return null;
  return (
    <AnimatedPressable
      containerStyle={[styles.bookmarkBtn, tone === 'onFill' && styles.bookmarkBtnOnFill]}
      onPress={(event: any) => {
        event?.stopPropagation?.();
        onToggleSave();
      }}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from saved jobs' : 'Save job'}
      accessibilityState={{ selected: Boolean(saved) }}
    >
      <Ionicons
        name={saved ? 'bookmark' : 'bookmark-outline'}
        size={16}
        color={saved ? tokens.colors.brand : tone === 'onFill' ? tokens.colors.onBrand : tokens.colors.textMuted}
      />
    </AnimatedPressable>
  );
}

function JobCard({ job, variant, saved, onPress, onToggleSave, showMatch = false, footerSlot, style }: Props) {
  if (variant === 'carousel') {
    return (
      <AnimatedPressable containerStyle={[styles.carouselCard, style]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`View ${job.title}`}>
        <View style={styles.carouselInner}>
          <View style={styles.carouselHero}>
            <CategoryTile category={{ id: job.categoryId, name: job.categoryName }} size="lg" />
            <View style={styles.carouselHeroOverlay} pointerEvents="none">
              {job.categoryName ? (
                <View style={styles.categoryChip}>
                  <Text style={styles.categoryChipText} numberOfLines={1}>{job.categoryName}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.carouselBookmarkSlot}>
              <BookmarkButton saved={saved} onToggleSave={onToggleSave} tone="onFill" />
            </View>
            {job.urgent ? (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentText}>Urgent</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.carouselBody}>
            <View style={styles.carouselTitleRow}>
              <Text style={styles.carouselTitle} numberOfLines={1}>{job.title}</Text>
              {showMatch && typeof job.matchPercentage === 'number' ? (
                <View style={styles.matchPill}>
                  <Ionicons name="star" size={11} color={tokens.colors.brand} />
                  <Text style={styles.matchPillText}>{job.matchPercentage}%</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.carouselPoster} numberOfLines={1}>{job.posterName}</Text>
            <Text style={styles.carouselSalary}>{job.salaryLabel}</Text>
          </View>
        </View>
      </AnimatedPressable>
    );
  }

  if (variant === 'compact') {
    return (
      <AnimatedPressable containerStyle={[styles.compactCard, style]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`View ${job.title}`}>
        <View style={styles.compactInner}>
          <CategoryTile category={{ id: job.categoryId, name: job.categoryName }} size="sm" />
          <View style={styles.compactInfo}>
            <Text style={styles.compactTitle} numberOfLines={1}>{job.title}</Text>
            <Text style={styles.compactMeta} numberOfLines={1}>{job.location}{job.location && job.salaryLabel !== 'Not set' ? ' · ' : ''}{job.salaryLabel !== 'Not set' ? job.salaryLabel : ''}</Text>
          </View>
          {footerSlot}
        </View>
      </AnimatedPressable>
    );
  }

  // variant === 'list'
  return (
    <AnimatedPressable containerStyle={[styles.listCard, style]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`View ${job.title}${job.location ? ` in ${job.location}` : ''}`}>
      <View style={styles.listInner}>
        <View style={styles.listHeader}>
          <CategoryTile category={{ id: job.categoryId, name: job.categoryName }} size="md" />
          <View style={styles.listInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.listTitle} numberOfLines={1}>{job.title}</Text>
              {job.urgent ? (
                <View style={styles.urgentBadgeInline}>
                  <Text style={styles.urgentText}>Urgent</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.listPoster} numberOfLines={1}>{job.posterName}</Text>
            {showMatch && typeof job.matchPercentage === 'number' ? (
              <Text style={styles.listMatch}>{job.matchPercentage}% Match{job.matchLevel ? ` · ${job.matchLevel}` : ''}</Text>
            ) : null}
          </View>
          <BookmarkButton saved={saved} onToggleSave={onToggleSave} />
        </View>

        {job.skills.length > 0 ? (
          <View style={styles.jobTags}>
            {job.skills.slice(0, 3).map((skill, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{skill}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.listFooter}>
          <View style={styles.listMetaRow}>
            <View style={styles.metaPill}>
              <Ionicons name="time-outline" size={12} color={tokens.colors.textMuted} />
              <Text style={styles.jobMetaText}>{job.jobType}</Text>
            </View>
            {job.location ? (
              <View style={styles.metaPill}>
                <Ionicons name="location-outline" size={12} color={tokens.colors.textMuted} />
                <Text style={styles.jobMetaText} numberOfLines={1}>{job.location}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.listSalary}>{job.salaryLabel}</Text>
        </View>
        {footerSlot}
      </View>
    </AnimatedPressable>
  );
}

export default memo(JobCard);

const styles = StyleSheet.create({
  // Carousel
  carouselCard: { width: 240, borderRadius: tokens.radius.lg, backgroundColor: tokens.colors.surface, overflow: 'hidden', ...tokens.shadow.card },
  carouselInner: { width: '100%' },
  carouselHero: { width: '100%', height: 128, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.brandSoft },
  carouselHeroOverlay: { position: 'absolute', left: tokens.spacing.sm, bottom: tokens.spacing.sm },
  carouselBookmarkSlot: { position: 'absolute', top: tokens.spacing.sm, right: tokens.spacing.sm },
  categoryChip: { paddingHorizontal: tokens.spacing.sm, paddingVertical: 4, borderRadius: tokens.radius.pill, backgroundColor: 'rgba(15,23,42,0.45)' },
  categoryChipText: { color: tokens.colors.onBrand, fontSize: 11, fontWeight: '800' },
  carouselBody: { padding: tokens.spacing.md, gap: 3 },
  carouselTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing.xs },
  carouselTitle: { flex: 1, color: tokens.colors.text, fontSize: 15, fontWeight: '800' },
  carouselPoster: { color: tokens.colors.textMuted, fontSize: 12 },
  carouselSalary: { marginTop: 4, color: tokens.colors.brand, fontSize: 14, fontWeight: '800' },
  matchPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: tokens.radius.pill, backgroundColor: tokens.colors.brandSoft },
  matchPillText: { color: tokens.colors.brand, fontSize: 11, fontWeight: '800' },

  // Shared
  bookmarkBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.surfaceMuted },
  bookmarkBtnOnFill: { backgroundColor: 'rgba(255,255,255,0.88)' },
  urgentBadge: { position: 'absolute', top: tokens.spacing.sm, left: tokens.spacing.sm, paddingHorizontal: 8, paddingVertical: 3, borderRadius: tokens.radius.pill, backgroundColor: tokens.colors.danger },
  urgentBadgeInline: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: tokens.radius.pill, backgroundColor: tokens.colors.dangerSoft },
  urgentText: { color: tokens.colors.onBrand, fontSize: 10, fontWeight: '800' },
  jobTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: tokens.spacing.sm },
  tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: tokens.radius.pill, backgroundColor: tokens.colors.brandSoft },
  tagText: { color: tokens.colors.brand, fontSize: 11, fontWeight: '700' },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 140 },
  jobMetaText: { color: tokens.colors.textMuted, fontSize: 12 },

  // List
  listCard: { width: '100%', borderRadius: tokens.radius.lg, backgroundColor: tokens.colors.surface, borderWidth: 1, borderColor: tokens.colors.border, ...tokens.shadow.card },
  listInner: { width: '100%', padding: tokens.spacing.md, gap: tokens.spacing.sm },
  listHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing.sm },
  listInfo: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs },
  listTitle: { flex: 1, color: tokens.colors.text, fontSize: 15, fontWeight: '800' },
  listPoster: { color: tokens.colors.textMuted, fontSize: 12 },
  listMatch: { color: tokens.colors.brand, fontSize: 11, fontWeight: '700', marginTop: 1 },
  listFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing.sm },
  listMetaRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, flex: 1 },
  listSalary: { color: tokens.colors.brand, fontSize: 13, fontWeight: '800' },

  // Compact
  compactCard: { width: '100%', borderRadius: tokens.radius.md, backgroundColor: tokens.colors.surface, borderWidth: 1, borderColor: tokens.colors.border },
  compactInner: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, padding: tokens.spacing.sm },
  compactInfo: { flex: 1, gap: 2 },
  compactTitle: { color: tokens.colors.text, fontSize: 14, fontWeight: '700' },
  compactMeta: { color: tokens.colors.textMuted, fontSize: 12 },
});
