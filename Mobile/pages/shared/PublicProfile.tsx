import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import { apiRequest, asObject } from '../../lib/api';
import { tokens } from '../../theme/tokens';

type PublicProfileProps = {
  userId: string;
  viewAs: 'worker' | 'employer';
  onBack: () => void;
};

type PublicProfileResponse = {
  profile?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    city?: string;
    province?: string;
    about?: string;
    jobPosition?: string;
    linkedin?: string;
    website?: string;
    totalExperience?: string;
    companyName?: string;
    avatarUrl?: string;
    skills?: Array<{ name?: string } | string>;
    workExperience?: Array<{
      _id?: string;
      title?: string;
      company?: string;
      location?: string;
      startDate?: string;
      endDate?: string | null;
      current?: boolean;
      description?: string;
    }>;
  };
  rating?: {
    viewAs?: 'worker' | 'employer';
    hidden?: boolean;
    stars?: number | null;
    percentage?: number | null;
    completedCount?: number | null;
    totalCount?: number | null;
  };
  stats?: {
    worker?: {
      jobsApplied?: number;
      projectsCompleted?: number;
      successRate?: number;
    };
    employer?: {
      jobsPosted?: number;
      totalApplicants?: number;
      hires?: number | null;
      hiresHidden?: boolean;
      successRate?: number | null;
    };
  };
};

const toAbsoluteAssetUrl = (value?: string): string | null => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) {
    return `${API_URL.replace(/\/api\/?$/, '')}${value}`;
  }
  return value;
};

export default function PublicProfile({ userId, viewAs, onBack }: PublicProfileProps) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<PublicProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const headerStyle = [styles.header, { paddingTop: Math.max(insets.top, 10) + 10 }];

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!userId) return;
      setIsLoading(true);
      setError(null);
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const result = await apiRequest(
          `${API_URL}/auth/profiles/${userId}?viewAs=${viewAs}`,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
          'Failed to load profile.'
        );

        if (!result.ok) {
          throw new Error(result.message || 'Failed to load profile.');
        }

        const payload =
          asObject<PublicProfileResponse>(result.data) ||
          asObject<PublicProfileResponse>(result.raw);

        if (!payload?.profile) {
          throw new Error('Profile not found.');
        }

        if (!isMounted) return;
        setData(payload);
      } catch (err: any) {
        if (!isMounted) return;
        setData(null);
        setError(err?.message || 'Failed to load profile.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [userId, viewAs, reloadKey]);

  const fullName = useMemo(() => {
    const first = data?.profile?.firstName || '';
    const last = data?.profile?.lastName || '';
    return `${first} ${last}`.trim() || 'User';
  }, [data?.profile?.firstName, data?.profile?.lastName]);

  const skills = useMemo(() => {
    const raw = data?.profile?.skills || [];
    return raw
      .map((entry) => (typeof entry === 'string' ? entry : entry?.name || ''))
      .filter(Boolean);
  }, [data?.profile?.skills]);

  const avatarUrl = toAbsoluteAssetUrl(data?.profile?.avatarUrl);
  const ratingStars = Math.max(0, Math.min(5, Number(data?.rating?.stars || 0)));
  const ratingPercentage = Math.max(0, Math.min(100, Number(data?.rating?.percentage || 0)));

  const renderStars = () => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Text key={i} style={[styles.star, i < Math.round(ratingStars) && styles.starFilled]}>
          ★
        </Text>
      );
    }
    return stars;
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={headerStyle}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1C4D8D" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={headerStyle}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setReloadKey((prev) => prev + 1);
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!data?.profile) {
    return (
      <View style={styles.container}>
        <View style={headerStyle}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Profile not found</Text>
        </View>
      </View>
    );
  }

  const profile = data.profile;
  const stats = viewAs === 'worker' ? data.stats?.worker : data.stats?.employer;

  return (
    <View style={styles.container}>
      <View style={headerStyle}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {viewAs === 'employer' ? 'Employer Profile' : 'Worker Profile'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 40 + Math.max(insets.bottom, 10) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{fullName.charAt(0).toUpperCase()}</Text>
              </View>
            )}

            <View style={styles.profileInfo}>
              <Text style={styles.nameText}>{fullName}</Text>
              {viewAs === 'employer' && profile.companyName ? (
                <Text style={styles.companyText}>{profile.companyName}</Text>
              ) : null}
              {viewAs === 'worker' && profile.jobPosition ? (
                <Text style={styles.companyText}>{profile.jobPosition}</Text>
              ) : null}
              {profile.city || profile.province ? (
                <Text style={styles.locationText}>
                  📍 {[profile.city, profile.province].filter(Boolean).join(', ')}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Rating Section */}
          <View style={styles.ratingContainer}>
            {data.rating?.hidden ? (
              <View style={styles.ratingBox}>
                <Text style={styles.ratingLabel}>Hiring performance</Text>
                <Text style={styles.completedCount}>Private</Text>
                <Text style={styles.totalJobs}>This employer does not share hiring totals.</Text>
              </View>
            ) : (
              <>
                <View style={styles.ratingBox}>
                  <Text style={styles.ratingLabel}>Rating</Text>
                  <View style={styles.starsRow}>{renderStars()}</View>
                  <Text style={styles.ratingValue}>{ratingStars.toFixed(1)}/5</Text>
                  <Text style={styles.successRate}>{ratingPercentage}% success</Text>
                </View>

                <View style={styles.ratingBox}>
                  <Text style={styles.ratingLabel}>Completed</Text>
                  <Text style={styles.completedCount}>{data.rating?.completedCount || 0}</Text>
                  <Text style={styles.totalJobs}>
                    out of {data.rating?.totalCount || 0} records
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Stats Section */}
          {stats && (
            <View style={styles.statsContainer}>
              <Text style={styles.sectionTitle}>Statistics</Text>
              <View style={styles.statsGrid}>
                {viewAs === 'worker' ? (
                  <>
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>{(stats as any).jobsApplied || 0}</Text>
                      <Text style={styles.statLabel}>Jobs Applied</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>{(stats as any).projectsCompleted || 0}</Text>
                      <Text style={styles.statLabel}>Completed</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>{(stats as any).successRate || 0}%</Text>
                      <Text style={styles.statLabel}>Success Rate</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>{(stats as any).jobsPosted || 0}</Text>
                      <Text style={styles.statLabel}>Jobs Posted</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>{(stats as any).totalApplicants || 0}</Text>
                      <Text style={styles.statLabel}>Total Applicants</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>
                        {(stats as any).hiresHidden ? 'Private' : (stats as any).hires || 0}
                      </Text>
                      <Text style={styles.statLabel}>Hires</Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          )}

          {/* Experience */}
          {profile.totalExperience && viewAs === 'worker' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Experience</Text>
              <Text style={styles.sectionText}>{profile.totalExperience}</Text>
            </View>
          ) : null}

          {profile.workExperience?.length && viewAs === 'worker' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Work History</Text>
              <View style={styles.workHistoryList}>
                {profile.workExperience.map((item, index) => {
                  const formatDate = (value?: string | null) => {
                    if (!value) return '';
                    const date = new Date(value);
                    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
                  };
                  return (
                    <View key={item._id || `${item.title}-${index}`} style={styles.workHistoryItem}>
                      <Text style={styles.workHistoryTitle}>{item.title || 'Work experience'}</Text>
                      <Text style={styles.workHistoryCompany}>{[item.company, item.location].filter(Boolean).join(' / ')}</Text>
                      <Text style={styles.workHistoryPeriod}>{formatDate(item.startDate)} - {item.current ? 'Present' : formatDate(item.endDate)}</Text>
                      {item.description ? <Text style={styles.workHistoryDescription}>{item.description}</Text> : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* About */}
          {profile.about ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.sectionText}>{profile.about}</Text>
            </View>
          ) : null}

          {/* Skills */}
          {skills.length > 0 && viewAs === 'worker' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Skills</Text>
              <View style={styles.skillsGrid}>
                {skills.map((skill, index) => (
                  <View key={index} style={styles.skillTag}>
                    <Text style={styles.skillText}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    marginBottom: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#475569',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748B',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#B91C1C',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: tokens.colors.brand,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: tokens.colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 15,
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1C4D8D',
  },
  profileInfo: {
    flex: 1,
  },
  nameText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  companyText: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.brand,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#64748B',
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  ratingBox: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  ratingLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
    fontWeight: '600',
  },
  starsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  star: {
    fontSize: 16,
    color: '#CBD5E1',
    marginHorizontal: 1,
  },
  starFilled: {
    color: '#F59E0B',
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  successRate: {
    fontSize: 14,
    color: '#334155',
  },
  completedCount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
    marginTop: 8,
  },
  totalJobs: {
    fontSize: 14,
    color: '#334155',
    textAlign: 'center',
  },
  statsContainer: {
    marginBottom: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C4D8D',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  sectionText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
  },
  workHistoryList: {
    gap: 10,
  },
  workHistoryItem: {
    borderRadius: 12,
    backgroundColor: tokens.colors.background,
    padding: 13,
  },
  workHistoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  workHistoryCompany: {
    marginTop: 2,
    fontSize: 13,
    color: '#475569',
  },
  workHistoryPeriod: {
    marginTop: 5,
    fontSize: 12,
    color: '#64748B',
  },
  workHistoryDescription: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillTag: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  skillText: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '600',
  },
});
