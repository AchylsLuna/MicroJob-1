import { useCallback, useEffect, useState } from 'react';
import {
  getUserReviews,
  type ProfileReview,
  type ReviewSort,
  type ReviewSummary,
} from '../../services/api';
import { ProfileReviews } from './ProfileReviews';

const EMPTY_SUMMARY: ReviewSummary = {
  averageRating: 0,
  totalReviews: 0,
  percentage: 0,
  ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
};

export function ProfileReviewsLoader({
  profileOwnerId,
  profileOwnerName,
  viewAs,
}: {
  profileOwnerId: string;
  profileOwnerName: string;
  viewAs: 'worker' | 'employer';
}) {
  const [summary, setSummary] = useState<ReviewSummary>(EMPTY_SUMMARY);
  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [sort, setSort] = useState<ReviewSort>('recent');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const loadPage = useCallback(async (
    requestedPage: number,
    mode: 'replace' | 'append' | 'refresh' = 'replace'
  ) => {
    if (!profileOwnerId) return;
    if (mode === 'replace') {
      setLoading(true);
      setError('');
    } else if (mode === 'append') {
      setLoadingMore(true);
    }

    try {
      const response = await getUserReviews(profileOwnerId, viewAs, sort, requestedPage, 20);
      const nextReviews = Array.isArray(response.reviews) ? response.reviews : [];
      setSummary(response.summary || EMPTY_SUMMARY);
      setReviews((current) => {
        if (mode === 'replace') return nextReviews;
        const incomingIds = new Set(nextReviews.map((review) => review._id));
        return mode === 'refresh'
          ? [...nextReviews, ...current.filter((review) => !incomingIds.has(review._id))]
          : [...current.filter((review) => !incomingIds.has(review._id)), ...nextReviews];
      });
      setPage(requestedPage);
      setHasMore(Boolean(response.pagination?.hasMore));
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
    const refreshTimer = window.setInterval(() => void loadPage(1, 'refresh'), 30_000);
    return () => window.clearInterval(refreshTimer);
  }, [loadPage]);

  if (!profileOwnerId || loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading ratings and reviews…</div>;
  }
  if (error) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>;
  }

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
