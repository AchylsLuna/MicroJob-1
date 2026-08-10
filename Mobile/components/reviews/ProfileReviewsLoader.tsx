import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import { apiRequest, asObject } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import ProfileReviews, { type MobileProfileReview, type MobileReviewSummary } from './ProfileReviews';

type ReviewSort = 'recent' | 'highest' | 'lowest' | 'helpful';

const EMPTY_SUMMARY: MobileReviewSummary = {
  averageRating: 0,
  totalReviews: 0,
  percentage: 0,
  ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
};

export default function ProfileReviewsLoader({
  profileOwnerId,
  profileOwnerName,
  viewAs,
}: {
  profileOwnerId: string;
  profileOwnerName: string;
  viewAs: 'worker' | 'employer';
}) {
  const [summary, setSummary] = useState<MobileReviewSummary>(EMPTY_SUMMARY);
  const [reviews, setReviews] = useState<MobileProfileReview[]>([]);
  const [sort, setSort] = useState<ReviewSort>('recent');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const loadPage = useCallback(async (
    requestedPage: number,
    mode: 'replace' | 'append' | 'refresh' = 'replace',
  ) => {
    if (!profileOwnerId) return;
    if (mode === 'replace') {
      setLoading(true);
      setError('');
    } else if (mode === 'append') {
      setLoadingMore(true);
    }

    try {
      const token = await AsyncStorage.getItem('auth_token');
      const query = new URLSearchParams({
        as: viewAs,
        sort,
        page: String(requestedPage),
        limit: '20',
      });
      const result = await apiRequest(
        `${API_URL}/reviews/user/${profileOwnerId}?${query.toString()}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
        'Failed to load ratings and reviews.',
      );
      const payload = asObject<{
        summary?: MobileReviewSummary;
        reviews?: MobileProfileReview[];
        pagination?: { hasMore?: boolean };
      }>(result.raw);
      if (!result.ok || !payload) throw new Error(result.message || 'Failed to load ratings and reviews.');

      const nextReviews = Array.isArray(payload.reviews) ? payload.reviews : [];
      setSummary(payload.summary || EMPTY_SUMMARY);
      setReviews((current) => {
        if (mode === 'replace') return nextReviews;
        const incomingIds = new Set(nextReviews.map((review) => review._id));
        return mode === 'refresh'
          ? [...nextReviews, ...current.filter((review) => !incomingIds.has(review._id))]
          : [...current.filter((review) => !incomingIds.has(review._id)), ...nextReviews];
      });
      setPage(requestedPage);
      setHasMore(Boolean(payload.pagination?.hasMore));
    } catch (requestError: any) {
      if (mode !== 'refresh') {
        setError(requestError?.message || 'Failed to load ratings and reviews.');
      }
    } finally {
      if (mode === 'replace') setLoading(false);
      if (mode === 'append') setLoadingMore(false);
    }
  }, [profileOwnerId, sort, viewAs]);

  useEffect(() => {
    void loadPage(1, 'replace');
    const refreshTimer = setInterval(() => void loadPage(1, 'refresh'), 30_000);
    return () => clearInterval(refreshTimer);
  }, [loadPage]);

  if (!profileOwnerId || loading) {
    return <View style={styles.state}><ActivityIndicator color={tokens.colors.brand} /><Text style={styles.stateText}>Loading ratings and reviews…</Text></View>;
  }
  if (error) return <Text style={styles.error}>{error}</Text>;

  return (
    <ProfileReviews
      profileOwnerId={profileOwnerId}
      profileOwnerName={profileOwnerName}
      summary={summary}
      reviews={reviews}
      sort={sort}
      onSortChange={setSort}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={() => void loadPage(page + 1, 'append')}
    />
  );
}

const styles = StyleSheet.create({
  state: { minHeight: 90, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: tokens.colors.surface },
  stateText: { fontSize: 12, color: tokens.colors.textMuted },
  error: { borderRadius: 12, backgroundColor: tokens.colors.dangerSoft, padding: 14, fontSize: 12, color: tokens.colors.danger },
});
