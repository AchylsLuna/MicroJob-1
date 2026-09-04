import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '../lib/storage';
import { API_URL } from '../config';
import { apiRequest, asObject } from '../lib/api';

type ReviewSummary = {
  averageRating: number;
  totalReviews: number;
};

/**
 * Reads just the rating headline for a user. ProfileReviewsLoader already fetches this
 * endpoint, but keeps the summary in its own local state, so header stat tiles cannot
 * reach it. This asks for a single row and uses only the summary block.
 */
export default function useReviewSummary(userId?: string | null, viewAs: 'worker' | 'employer' = 'worker') {
  const [summary, setSummary] = useState<ReviewSummary>({ averageRating: 0, totalReviews: 0 });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setSummary({ averageRating: 0, totalReviews: 0 });
      return;
    }
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const query = new URLSearchParams({ as: viewAs, page: '1', limit: '1' });
      const result = await apiRequest(
        `${API_URL}/reviews/user/${userId}?${query.toString()}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
        'Failed to load rating.',
      );
      const payload = asObject<{ summary?: Partial<ReviewSummary> }>(result.raw);
      if (!result.ok || !payload?.summary) {
        setSummary({ averageRating: 0, totalReviews: 0 });
        return;
      }
      setSummary({
        averageRating: Number(payload.summary.averageRating) || 0,
        totalReviews: Number(payload.summary.totalReviews) || 0,
      });
    } catch {
      // A missing rating must never block the screen it decorates.
      setSummary({ averageRating: 0, totalReviews: 0 });
    } finally {
      setLoading(false);
    }
  }, [userId, viewAs]);

  useEffect(() => { load(); }, [load]);

  return { ...summary, loading, reload: load };
}
