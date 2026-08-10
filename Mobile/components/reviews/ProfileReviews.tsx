import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView as NativeScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import { apiRequest, asObject } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { tokens } from '../../theme/tokens';

export type MobileReviewSummary = {
  averageRating: number;
  totalReviews: number;
  percentage: number;
  ratingBreakdown: Record<number, number>;
};

export type MobileProfileReview = {
  _id: string;
  rating: number;
  comment?: string;
  createdAt?: string;
  reviewerRole: 'worker' | 'employer';
  reviewer?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    avatarUrl?: string;
  };
  job?: { _id?: string; title?: string };
  ownerReply?: string;
  ownerReplyAt?: string | null;
  likeCount: number;
  dislikeCount: number;
  viewerReaction?: 'like' | 'dislike' | null;
  canReply?: boolean;
};

type ReviewSort = 'recent' | 'highest' | 'lowest' | 'helpful';

const SORT_OPTIONS: Array<{ value: ReviewSort; label: string }> = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'highest', label: 'Highest Rated' },
  { value: 'lowest', label: 'Lowest Rated' },
  { value: 'helpful', label: 'Most Helpful' },
];

const reviewerName = (review: MobileProfileReview) =>
  review.reviewer?.companyName ||
  `${review.reviewer?.firstName || ''} ${review.reviewer?.lastName || ''}`.trim() ||
  'Verified user';

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function ProfileReviews({
  profileOwnerId,
  profileOwnerName,
  summary,
  reviews,
}: {
  profileOwnerId: string;
  profileOwnerName: string;
  summary: MobileReviewSummary;
  reviews: MobileProfileReview[];
}) {
  const toast = useToast();
  const [items, setItems] = useState(reviews);
  const [sort, setSort] = useState<ReviewSort>('recent');
  const [currentUserId, setCurrentUserId] = useState('');
  const [reactionPending, setReactionPending] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replyPending, setReplyPending] = useState(false);

  useEffect(() => setItems(reviews), [reviews]);
  useEffect(() => {
    AsyncStorage.getItem('auth_user').then((raw) => {
      if (!raw) return;
      try {
        const user = JSON.parse(raw);
        setCurrentUserId(String(user?.id || user?._id || user?.userId || ''));
      } catch {
        setCurrentUserId('');
      }
    });
  }, []);

  const sortedReviews = useMemo(() => {
    const recent = (left: MobileProfileReview, right: MobileProfileReview) =>
      new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    const next = [...items];
    if (sort === 'highest') return next.sort((a, b) => b.rating - a.rating || recent(a, b));
    if (sort === 'lowest') return next.sort((a, b) => a.rating - b.rating || recent(a, b));
    if (sort === 'helpful') {
      return next.sort((a, b) =>
        (b.likeCount - b.dislikeCount) - (a.likeCount - a.dislikeCount) ||
        b.likeCount - a.likeCount || recent(a, b));
    }
    return next.sort(recent);
  }, [items, sort]);

  const updateItem = (updated: MobileProfileReview) => {
    setItems((current) => current.map((review) => review._id === updated._id ? updated : review));
  };

  const getToken = () => AsyncStorage.getItem('auth_token');

  const react = async (review: MobileProfileReview, selected: 'like' | 'dislike') => {
    if (reactionPending) return;
    const previous = review.viewerReaction || null;
    const nextReaction = previous === selected ? null : selected;
    const optimistic: MobileProfileReview = {
      ...review,
      viewerReaction: nextReaction,
      likeCount: Math.max(0, review.likeCount - (previous === 'like' ? 1 : 0) + (nextReaction === 'like' ? 1 : 0)),
      dislikeCount: Math.max(0, review.dislikeCount - (previous === 'dislike' ? 1 : 0) + (nextReaction === 'dislike' ? 1 : 0)),
    };
    setReactionPending(review._id);
    updateItem(optimistic);
    try {
      const token = await getToken();
      const result = await apiRequest(`${API_URL}/reviews/${review._id}/reaction`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reaction: nextReaction }),
      }, 'Failed to update reaction.');
      const payload = asObject<{ review?: MobileProfileReview }>(result.raw);
      if (!result.ok || !payload?.review) throw new Error(result.message || 'Failed to update reaction.');
      updateItem(payload.review);
    } catch (error: any) {
      updateItem(review);
      toast.error(error?.message || 'Failed to update reaction.');
    } finally {
      setReactionPending(null);
    }
  };

  const openReply = (review: MobileProfileReview) => {
    setReplyTarget(review._id);
    setReplyDraft(review.ownerReply || '');
  };

  const saveReply = async (reviewId: string) => {
    const reply = replyDraft.trim();
    if (!reply) {
      toast.error('Write a reply before saving.');
      return;
    }
    setReplyPending(true);
    try {
      const token = await getToken();
      const result = await apiRequest(`${API_URL}/reviews/${reviewId}/reply`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reply }),
      }, 'Failed to save reply.');
      const payload = asObject<{ review?: MobileProfileReview }>(result.raw);
      if (!result.ok || !payload?.review) throw new Error(result.message || 'Failed to save reply.');
      updateItem(payload.review);
      setReplyTarget(null);
      setReplyDraft('');
      toast.success('Reply saved.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save reply.');
    } finally {
      setReplyPending(false);
    }
  };

  const total = Number(summary.totalReviews || 0);
  const average = Number(summary.averageRating || 0);
  const isProfileOwner = currentUserId === String(profileOwnerId);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Ratings & Reviews</Text>
      <Text style={styles.headingCopy}>Verified feedback from completed jobs.</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.average}>{average.toFixed(1)} <Text style={styles.averageSuffix}>/ 5</Text></Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => <Ionicons key={star} name={star <= Math.round(average) ? 'star' : 'star-outline'} size={20} color={star <= Math.round(average) ? tokens.colors.warning : tokens.colors.textSubtle} />)}
        </View>
        <Text style={styles.percentage}>{Number(summary.percentage || 0)}% Overall Rating</Text>
        <Text style={styles.total}>Based on {total} review{total === 1 ? '' : 's'}</Text>

        <View style={styles.breakdown}>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = Number(summary.ratingBreakdown?.[star] || 0);
            const width = total ? `${Math.round((count / total) * 100)}%` : '0%';
            return (
              <View key={star} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{star} ★</Text>
                <View style={styles.track}><View style={[styles.fill, { width: width as `${number}%` }]} /></View>
                <Text style={styles.breakdownCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <NativeScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
        {SORT_OPTIONS.map((option) => (
          <TouchableOpacity key={option.value} style={[styles.sortChip, sort === option.value && styles.sortChipActive]} onPress={() => setSort(option.value)}>
            <Text style={[styles.sortText, sort === option.value && styles.sortTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </NativeScrollView>

      {sortedReviews.length ? sortedReviews.map((review) => {
        const name = reviewerName(review);
        const canReply = Boolean(review.canReply || isProfileOwner);
        return (
          <View key={review._id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text></View>
              <View style={styles.reviewerCopy}>
                <Text style={styles.reviewerName}>{name}</Text>
                <Text style={styles.date}>{formatDate(review.createdAt)}</Text>
              </View>
              <View style={styles.ratingSide}>
                <View style={styles.smallStars}>{[1, 2, 3, 4, 5].map((star) => <Ionicons key={star} name={star <= review.rating ? 'star' : 'star-outline'} size={14} color={star <= review.rating ? tokens.colors.warning : tokens.colors.textSubtle} />)}</View>
                <Text style={styles.numericRating}>{Number(review.rating).toFixed(1)}</Text>
              </View>
            </View>

            <Text style={styles.job}>Completed job: {review.job?.title || 'Job details unavailable'}</Text>
            <Text style={[styles.comment, !review.comment && styles.emptyComment]}>{review.comment || 'Star rating only.'}</Text>

            <View style={styles.actions}>
              <TouchableOpacity disabled={reactionPending === review._id} style={[styles.actionButton, review.viewerReaction === 'like' && styles.likeActive]} onPress={() => react(review, 'like')} accessibilityRole="button" accessibilityState={{ selected: review.viewerReaction === 'like' }}>
                <Ionicons name={review.viewerReaction === 'like' ? 'thumbs-up' : 'thumbs-up-outline'} size={17} color={review.viewerReaction === 'like' ? tokens.colors.brand : tokens.colors.textMuted} />
                <Text style={styles.actionText}>{review.likeCount}</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={reactionPending === review._id} style={[styles.actionButton, review.viewerReaction === 'dislike' && styles.dislikeActive]} onPress={() => react(review, 'dislike')} accessibilityRole="button" accessibilityState={{ selected: review.viewerReaction === 'dislike' }}>
                <Ionicons name={review.viewerReaction === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'} size={17} color={review.viewerReaction === 'dislike' ? tokens.colors.danger : tokens.colors.textMuted} />
                <Text style={styles.actionText}>{review.dislikeCount}</Text>
              </TouchableOpacity>
              {canReply ? (
                <TouchableOpacity style={styles.actionButton} onPress={() => openReply(review)}>
                  <Ionicons name="return-up-back-outline" size={18} color={tokens.colors.textMuted} />
                  <Text style={styles.actionText}>{review.ownerReply ? 'Edit reply' : 'Reply'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {review.ownerReply ? (
              <View style={styles.ownerReply}>
                <Text style={styles.ownerReplyTitle}>{isProfileOwner ? 'My Reply' : `${profileOwnerName}'s Reply`}</Text>
                <Text style={styles.ownerReplyText}>{review.ownerReply}</Text>
                {review.ownerReplyAt ? <Text style={styles.replyDate}>{formatDate(review.ownerReplyAt)}</Text> : null}
              </View>
            ) : null}

            {replyTarget === review._id ? (
              <View style={styles.replyEditor}>
                <Text style={styles.replyLabel}>Reply as profile owner</Text>
                <TextInput style={styles.replyInput} value={replyDraft} onChangeText={(value) => setReplyDraft(value.slice(0, 2000))} multiline maxLength={2000} textAlignVertical="top" placeholder="Write a professional reply…" placeholderTextColor={tokens.colors.textSubtle} />
                <View style={styles.replyFooter}>
                  <Text style={styles.counter}>{replyDraft.length}/2000</Text>
                  <TouchableOpacity onPress={() => setReplyTarget(null)} disabled={replyPending} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => saveReply(review._id)} disabled={replyPending || !replyDraft.trim()} style={[styles.saveButton, (replyPending || !replyDraft.trim()) && styles.disabled]}>
                    {replyPending ? <ActivityIndicator size="small" color={tokens.colors.onBrand} /> : <Text style={styles.saveText}>Save reply</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        );
      }) : <Text style={styles.empty}>No verified reviews yet.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 20, padding: 16, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 18, backgroundColor: tokens.colors.surface },
  heading: { fontSize: 19, fontWeight: '800', color: tokens.colors.text },
  headingCopy: { marginTop: 3, fontSize: 12, color: tokens.colors.textMuted },
  summaryCard: { marginTop: 14, borderRadius: 16, backgroundColor: tokens.colors.surfaceMuted, padding: 16 },
  average: { fontSize: 34, fontWeight: '800', color: tokens.colors.text },
  averageSuffix: { fontSize: 16, fontWeight: '600', color: tokens.colors.textMuted },
  starsRow: { flexDirection: 'row', gap: 2, marginTop: 5 },
  percentage: { marginTop: 10, fontSize: 13, fontWeight: '700', color: tokens.colors.text },
  total: { marginTop: 3, fontSize: 12, color: tokens.colors.textMuted },
  breakdown: { marginTop: 15, gap: 7 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownLabel: { width: 30, fontSize: 11, color: tokens.colors.textMuted },
  track: { flex: 1, height: 7, overflow: 'hidden', borderRadius: 999, backgroundColor: tokens.colors.border },
  fill: { height: 7, borderRadius: 999, backgroundColor: tokens.colors.warning },
  breakdownCount: { width: 24, textAlign: 'right', fontSize: 11, color: tokens.colors.textMuted },
  sortRow: { gap: 8, paddingVertical: 14 },
  sortChip: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 999, paddingHorizontal: 13, backgroundColor: tokens.colors.surface },
  sortChipActive: { borderColor: tokens.colors.brand, backgroundColor: tokens.colors.brandSoft },
  sortText: { fontSize: 12, fontWeight: '600', color: tokens.colors.textMuted },
  sortTextActive: { color: tokens.colors.brand },
  reviewCard: { marginBottom: 12, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 16, padding: 14, backgroundColor: tokens.colors.surface },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.brandSoft },
  avatarText: { fontSize: 16, fontWeight: '800', color: tokens.colors.brand },
  reviewerCopy: { flex: 1 },
  reviewerName: { fontSize: 14, fontWeight: '800', color: tokens.colors.text },
  date: { marginTop: 2, fontSize: 11, color: tokens.colors.textMuted },
  ratingSide: { alignItems: 'flex-end' },
  smallStars: { flexDirection: 'row' },
  numericRating: { marginTop: 2, fontSize: 11, fontWeight: '700', color: tokens.colors.textMuted },
  job: { marginTop: 12, fontSize: 11, fontWeight: '700', color: tokens.colors.brand },
  comment: { marginTop: 10, fontSize: 13, lineHeight: 20, color: tokens.colors.text },
  emptyComment: { fontStyle: 'italic', color: tokens.colors.textMuted },
  actions: { marginTop: 13, paddingTop: 10, borderTopWidth: 1, borderTopColor: tokens.colors.border, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actionButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 11 },
  likeActive: { backgroundColor: tokens.colors.brandSoft },
  dislikeActive: { backgroundColor: tokens.colors.dangerSoft },
  actionText: { fontSize: 12, fontWeight: '700', color: tokens.colors.textMuted },
  ownerReply: { marginTop: 12, borderLeftWidth: 4, borderLeftColor: tokens.colors.brand, borderRadius: 10, backgroundColor: tokens.colors.brandSoft, padding: 12 },
  ownerReplyTitle: { fontSize: 11, fontWeight: '800', color: tokens.colors.brandDark },
  ownerReplyText: { marginTop: 4, fontSize: 13, lineHeight: 19, color: tokens.colors.text },
  replyDate: { marginTop: 6, fontSize: 10, color: tokens.colors.textMuted },
  replyEditor: { marginTop: 12, borderRadius: 12, backgroundColor: tokens.colors.surfaceMuted, padding: 12 },
  replyLabel: { fontSize: 12, fontWeight: '700', color: tokens.colors.text },
  replyInput: { minHeight: 88, marginTop: 8, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12, padding: 10, backgroundColor: tokens.colors.surface, color: tokens.colors.text, fontSize: 13 },
  replyFooter: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  counter: { flex: 1, fontSize: 10, color: tokens.colors.textSubtle },
  cancelButton: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 10, paddingHorizontal: 12 },
  cancelText: { fontSize: 11, fontWeight: '700', color: tokens.colors.textMuted },
  saveButton: { minHeight: 40, minWidth: 88, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: tokens.colors.brand, paddingHorizontal: 12 },
  saveText: { fontSize: 11, fontWeight: '800', color: tokens.colors.onBrand },
  disabled: { opacity: 0.5 },
  empty: { marginTop: 14, borderRadius: 12, backgroundColor: tokens.colors.surfaceMuted, padding: 15, fontSize: 13, color: tokens.colors.textMuted },
});
