import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import { apiRequest, asObject } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import ProfileReviews, { type MobileProfileReview, type MobileReviewSummary } from './ProfileReviews';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async (silent = false) => {
      if (!profileOwnerId) return;
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const result = await apiRequest(
          `${API_URL}/reviews/user/${profileOwnerId}?as=${viewAs}&sort=recent`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
          'Failed to load ratings and reviews.',
        );
        const payload = asObject<{ summary?: MobileReviewSummary; reviews?: MobileProfileReview[] }>(result.raw);
        if (!result.ok || !payload) throw new Error(result.message || 'Failed to load ratings and reviews.');
        if (!mounted) return;
        setSummary(payload.summary || EMPTY_SUMMARY);
        setReviews(Array.isArray(payload.reviews) ? payload.reviews : []);
      } catch (requestError: any) {
        if (mounted && !silent) setError(requestError?.message || 'Failed to load ratings and reviews.');
      } finally {
        if (mounted && !silent) setLoading(false);
      }
    };
    load();
    const refreshTimer = setInterval(() => void load(true), 30_000);
    return () => {
      mounted = false;
      clearInterval(refreshTimer);
    };
  }, [profileOwnerId, viewAs]);

  if (!profileOwnerId || loading) {
    return <View style={styles.state}><ActivityIndicator color={tokens.colors.brand} /><Text style={styles.stateText}>Loading ratings and reviews…</Text></View>;
  }
  if (error) return <Text style={styles.error}>{error}</Text>;

  return <ProfileReviews profileOwnerId={profileOwnerId} profileOwnerName={profileOwnerName} summary={summary} reviews={reviews} />;
}

const styles = StyleSheet.create({
  state: { minHeight: 90, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: tokens.colors.surface },
  stateText: { fontSize: 12, color: tokens.colors.textMuted },
  error: { borderRadius: 12, backgroundColor: tokens.colors.dangerSoft, padding: 14, fontSize: 12, color: tokens.colors.danger },
});
