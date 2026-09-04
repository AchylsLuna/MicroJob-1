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
        size={tone === 'onFill' ? 16 : 19}
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
  const visibleSkills = job.skills.slice(0, 3);
  const overflowSkills = job.skills.length - visibleSkills.length;
  const hasSalary = job.salaryLabel !== 'Not set';

  return (
    <AnimatedPressable containerStyle={[styles.listCard, style]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`View ${job.title}${job.location ? ` in ${job.location}` : ''}`}>
      <View style={styles.listInner}>
        <View style={styles.listHeader}>
          <CategoryTile category={{ id: job.categoryId, name: job.categoryName }} size="md" />
          <View style={styles.listInfo}>
            <Text style={styles.listTitle} numberOfLines={2}>{job.title}</Text>
            <Text style={styles.listPoster} numberOfLines={1}>{job.posterName}</Text>
          </View>
          {job.postedLabel ? <Text style={styles.postedLabel}>{job.postedLabel}</Text> : null}
        </View>

        <View style={styles.badgeRow}>
          {job.jobType ? (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText} numberOfLines={1}>{job.jobType.toUpperCase()}</Text>
            </View>
          ) : null}
          {job.urgent ? (
            <View style={styles.urgentBadgeInline}>
              <Text style={styles.urgentTextInline}>URGENT</Text>
            </View>
          ) : null}
          {showMatch && typeof job.matchPercentage === 'number' ? (
            <View style={styles.matchPill}>
              <Ionicons name="star" size={11} color={tokens.colors.brand} />
              <Text style={styles.matchPillText}>{job.matchPercentage}%</Text>
            </View>
          ) : null}
        </View>

        {job.location || hasSalary || visibleSkills.length > 0 ? (
          <View style={styles.detailPanel}>
            {job.location ? (
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={15} color={tokens.colors.textMuted} />
                <Text style={styles.detailText} numberOfLines={1}>{job.location}</Text>
              </View>
            ) : null}
            {hasSalary ? (
              <View style={styles.detailRow}>
                <Ionicons name="cash-outline" size={15} color={tokens.colors.textMuted} />
                <Text style={styles.detailSalary} numberOfLines={1}>{job.salaryLabel}</Text>
              </View>
            ) : null}

            {visibleSkills.length > 0 ? (
              <>
                <View style={styles.detailDivider} />
                <View style={styles.jobTags}>
                  {visibleSkills.map((skill, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText} numberOfLines={1}>{skill}</Text>
                    </View>
                  ))}
                  {overflowSkills > 0 ? (
                    <View style={styles.tagOverflow}>
                      <Text style={styles.tagOverflowText}>+{overflowSkills}</Text>
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <BookmarkButton saved={saved} onToggleSave={onToggleSave} />
          <View style={styles.applyButton}>
            <Text style={styles.applyButtonText}>View Job</Text>
          </View>
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
  bookmarkBtn: { width: tokens.controls.minimumTouch, height: tokens.controls.minimumTouch, borderRadius: tokens.controls.minimumTouch / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.surface, borderWidth: 1, borderColor: tokens.colors.border },
  bookmarkBtnOnFill: { width: 32, height: 32, borderRadius: 16, borderWidth: 0, backgroundColor: 'rgba(255,255,255,0.88)' },
  urgentBadge: { position: 'absolute', top: tokens.spacing.sm, left: tokens.spacing.sm, paddingHorizontal: 8, paddingVertical: 3, borderRadius: tokens.radius.pill, backgroundColor: tokens.colors.danger },
  urgentBadgeInline: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: tokens.radius.pill, backgroundColor: tokens.colors.dangerSoft },
  urgentText: { color: tokens.colors.onBrand, fontSize: 10, fontWeight: '800' },
  jobTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: tokens.spacing.sm },
  tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: tokens.radius.pill, backgroundColor: tokens.colors.brandSoft },
  tagText: { color: tokens.colors.brand, fontSize: 11, fontWeight: '700' },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 140 },
  jobMetaText: { color: tokens.colors.textMuted, fontSize: 12 },

  // List
  listCard: { width: '100%', borderRadius: 22, backgroundColor: tokens.colors.surface, borderWidth: 1, borderColor: tokens.colors.border, ...tokens.shadow.card },
  listInner: { width: '100%', padding: tokens.spacing.md, gap: tokens.spacing.sm },
  listHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing.sm },
  listInfo: { flex: 1, gap: 2 },
  listTitle: { color: tokens.colors.text, fontSize: 17, fontWeight: '800', lineHeight: 22 },
  listPoster: { color: tokens.colors.textMuted, fontSize: 13 },
  postedLabel: { color: tokens.colors.textSubtle, fontSize: 11, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spacing.xs },
  typeBadge: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: tokens.radius.pill, backgroundColor: tokens.colors.warningSoft },
  typeBadgeText: { color: '#92610A', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  urgentTextInline: { color: tokens.colors.danger, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  detailPanel: { borderRadius: tokens.radius.md, backgroundColor: tokens.colors.brandSoft, padding: tokens.spacing.md, gap: tokens.spacing.xs },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs },
  detailText: { flex: 1, color: tokens.colors.onCanvas, fontSize: 13, fontWeight: '600' },
  detailSalary: { flex: 1, color: tokens.colors.brandDark, fontSize: 14, fontWeight: '800' },
  detailDivider: { height: 1, backgroundColor: tokens.colors.brandMuted, marginVertical: tokens.spacing.xs },
  tagOverflow: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: tokens.radius.pill, backgroundColor: tokens.colors.surface, borderWidth: 1, borderColor: tokens.colors.brandMuted },
  tagOverflowText: { color: tokens.colors.textMuted, fontSize: 11, fontWeight: '700' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  applyButton: { flex: 1, height: tokens.controls.compactHeight, borderRadius: tokens.radius.pill, backgroundColor: tokens.colors.brand, alignItems: 'center', justifyContent: 'center' },
  applyButtonText: { color: tokens.colors.onBrand, fontSize: 15, fontWeight: '800' },

  // Compact
  compactCard: { width: '100%', borderRadius: tokens.radius.md, backgroundColor: tokens.colors.surface, borderWidth: 1, borderColor: tokens.colors.border },
  compactInner: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, padding: tokens.spacing.sm },
  compactInfo: { flex: 1, gap: 2 },
  compactTitle: { color: tokens.colors.text, fontSize: 14, fontWeight: '700' },
  compactMeta: { color: tokens.colors.textMuted, fontSize: 12 },
});
