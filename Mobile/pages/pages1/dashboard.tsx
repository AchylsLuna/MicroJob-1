import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Navigation from '../../components/navigation';
import ScrollView from '../../components/ui/SmoothScrollView';
import TabTopNav from '../../components/TabTopNav';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import { apiRequest, asList } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import InlineStateCard from '../../components/ui/InlineStateCard';

type Category = { _id: string; name: string };
type Job = {
  _id: string;
  title: string;
  description: string;
  location: string;
  salary: string;
  jobType: string;
  skills?: string[];
  createdAt?: string;
  category?: { _id: string; name: string } | string;
  jobPoster?: { firstName?: string; lastName?: string; email?: string };
};

export default function Dashboard({
  onNavigateToJobs,
  onOpenSettings,
  onViewJobDetails,
  onSaveJob,
  savedJobIds = [],
  activeTab: externalActiveTab,
  onTabPress: externalOnTabPress,
  onOpenNotifications,
  notificationBadgeCount = 0,
  messageBadgeCount = 0,
}: {
  onNavigateToJobs?: () => void;
  onOpenSettings?: () => void;
  onViewJobDetails?: (job: any) => void;
  onSaveJob?: (job: any) => void;
  savedJobIds?: string[];
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  onOpenNotifications?: () => void;
  notificationBadgeCount?: number;
  messageBadgeCount?: number;
}) {
  const [activeTab, setActiveTab] = useState(externalActiveTab || 'Home');
  const [categories, setCategories] = useState<Category[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasUploadedResume, setHasUploadedResume] = useState(false);
  const jobsRequestInFlight = useRef(false);

  const recentJobs = useMemo(() => jobs.slice(0, 5), [jobs]);
  const needsLocation = /city|municipality|location/i.test(errorMessage);
  const jobsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    jobs.forEach((job) => {
      const categoryId = typeof job.category === 'string' ? job.category : job.category?._id;
      if (!categoryId) return;
      counts[categoryId] = (counts[categoryId] || 0) + 1;
    });
    return counts;
  }, [jobs]);

  const fetchCategories = async () => {
    try {
      const result = await apiRequest<Category[]>(`${API_URL}/categories`, undefined, 'Failed to load categories.');
      if (result.ok) {
        setCategories(asList<Category>(result.raw, ['categories']).slice(0, 3));
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const fetchJobs = async () => {
    if (jobsRequestInFlight.current) return;
    jobsRequestInFlight.current = true;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest<Job[]>(
        `${API_URL}/jobs?excludeOwn=true`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
        'Failed to load jobs.'
      );
      if (!result.ok) {
        throw new Error(result.message || 'Failed to load jobs.');
      }
      setJobs(asList<Job>(result.raw, ['jobs']));
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to load jobs.');
    } finally {
      jobsRequestInFlight.current = false;
      setIsLoading(false);
    }
  };

  const profileHasResume = (profile: any) => {
    if (!profile || typeof profile !== 'object') return false;
    const resumeFileName = String(profile.resumeFileName || '').trim();
    const resumeUrl = String(profile.resumeUrl || '').trim();
    const resume = String(profile.resume || '').trim();
    return Boolean(resumeFileName || resumeUrl || resume);
  };

  const syncResumeStatus = useCallback(async () => {
    try {
      const storedUserRaw = await AsyncStorage.getItem('auth_user');
      if (storedUserRaw) {
        const storedUser = JSON.parse(storedUserRaw);
        setHasUploadedResume(profileHasResume(storedUser));
      }

      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const result = await apiRequest(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }, 'Failed to load profile.');

      if (!result.ok) return;

      const payload: any = (result.raw && typeof result.raw === 'object') ? result.raw : {};
      const dataPayload: any = (result.data && typeof result.data === 'object') ? result.data : {};
      const profile =
        dataPayload?.user ||
        payload?.user ||
        dataPayload?.profile ||
        payload?.profile ||
        dataPayload;

      if (profile && typeof profile === 'object') {
        setHasUploadedResume(profileHasResume(profile));
      }
    } catch (error) {
      // Keep UI functional even when profile sync fails.
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchJobs();
    syncResumeStatus();
  }, [syncResumeStatus]);

  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
    externalOnTabPress?.(tab);
    if (tab === 'Jobs' && onNavigateToJobs) {
      onNavigateToJobs();
    }
  };

  return (
    <View style={styles.container}>
      <TabTopNav
        title="Home"
        showNotifications
        onOpenNotifications={onOpenNotifications}
        notificationBadgeCount={notificationBadgeCount}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.searchContainer} onPress={onNavigateToJobs} activeOpacity={0.88} accessibilityRole="button" accessibilityLabel="Search jobs, skills, or companies">
          <Ionicons name="search-outline" size={18} color={tokens.colors.textSubtle} />
          <Text style={styles.searchPlaceholder}>Search jobs, skills, or companies</Text>
          <Ionicons name="chevron-forward" size={18} color={tokens.colors.brand} />
        </TouchableOpacity>

        {!hasUploadedResume ? (
          <View style={styles.uploadCard}>
            <View style={styles.uploadTopRow}>
              <View style={styles.uploadIconWrap}>
                <Ionicons name="document-text-outline" size={20} color={tokens.colors.onCardStrong} />
              </View>
              <Text style={styles.uploadTitle}>Upload your resume</Text>
            </View>
            <Text style={styles.uploadSubtitle}>Get matched with top companies automatically.</Text>
            <TouchableOpacity style={styles.checkButton} activeOpacity={0.9} onPress={onNavigateToJobs}>
              <Text style={styles.checkButtonText}>Explore jobs</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Job Categories</Text>
          <TouchableOpacity onPress={onNavigateToJobs}>
            <Text style={styles.seeAll}>Browse all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.categoryRow}>
          {categories.map((category) => {
            const openingCount = jobsByCategory[category._id] || 0;
            return (
              <View key={category._id} style={styles.categoryCard}>
                <View style={styles.categoryIconWrap}>
                  <Ionicons name="briefcase-outline" size={17} color={tokens.colors.brand} />
                </View>
                <Text style={styles.categoryCount}>{openingCount}</Text>
                <Text style={styles.categoryLabel} numberOfLines={2}>
                  {category.name}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Jobs</Text>
          <TouchableOpacity onPress={onNavigateToJobs}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {errorMessage ? <InlineStateCard
          icon={needsLocation ? 'location-outline' : 'cloud-offline-outline'}
          title={needsLocation ? 'Set your work location' : 'Jobs are unavailable'}
          message={needsLocation ? 'Add your city or municipality to see nearby opportunities.' : errorMessage}
          actionLabel={needsLocation ? 'Open settings' : 'Try again'}
          onAction={needsLocation ? onOpenSettings : fetchJobs}
          busy={isLoading}
        /> : null}
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={tokens.colors.brand} />
          </View>
        ) : null}

        <View style={styles.jobsList}>
          {recentJobs.map((job) => (
            <TouchableOpacity key={job._id} style={styles.jobCard} onPress={() => onViewJobDetails?.(job)} activeOpacity={0.88}>
              <View style={styles.jobCardHeader}>
                <View style={styles.jobLogo}>
                  <Text style={styles.jobLogoText}>{job.title?.slice(0, 1)?.toUpperCase() || 'J'}</Text>
                </View>
                <View style={styles.jobInfo}>
                  <Text style={styles.jobTitle} numberOfLines={1}>
                    {job.title}
                  </Text>
                  <Text style={styles.jobCompany} numberOfLines={1}>
                    {job.jobPoster?.firstName ? `${job.jobPoster.firstName} ${job.jobPoster.lastName || ''}`.trim() : 'Job Poster'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.bookmarkBtn}
                  onPress={(event: any) => {
                    event?.stopPropagation?.();
                    onSaveJob?.(job);
                  }}
                >
                  <Ionicons
                    name={savedJobIds.includes(job._id) ? 'bookmark' : 'bookmark-outline'}
                    size={18}
                    color={savedJobIds.includes(job._id) ? tokens.colors.brand : tokens.colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.jobTags}>
                {(job.skills || []).slice(0, 3).map((skill, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{skill}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.jobFooter}>
                <View style={styles.jobMetaRow}>
                  <View style={styles.metaPill}>
                    <Ionicons name="time-outline" size={12} color={tokens.colors.textMuted} />
                    <Text style={styles.jobMetaText}>{job.jobType}</Text>
                  </View>
                  {job.category && typeof job.category !== 'string' ? (
                    <View style={styles.metaPill}>
                      <Ionicons name="grid-outline" size={12} color={tokens.colors.textMuted} />
                      <Text style={styles.jobMetaText}>{job.category.name}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.jobSalary}>{job.salary}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        {!isLoading && !errorMessage && recentJobs.length === 0 ? <InlineStateCard icon="briefcase-outline" title="No recent jobs yet" message="New opportunities in your area will appear here." actionLabel="Explore jobs" onAction={onNavigateToJobs} /> : null}
      </ScrollView>

      <Navigation activeTab={activeTab} onTabPress={handleTabPress} messageBadgeCount={messageBadgeCount} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.signedInCanvas },
  scroll: { paddingHorizontal: tokens.layout.gutterWide, paddingTop: 16, paddingBottom: tokens.layout.tabBarClearance + 16, gap: tokens.layout.sectionGap },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.cardSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: tokens.controls.fieldHeight,
    gap: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  searchPlaceholder: { fontSize: 14, color: tokens.colors.textSubtle },
  uploadCard: {
    backgroundColor: tokens.colors.cardStrong,
    borderRadius: tokens.radius.lg,
    padding: 18,
    gap: 10,
    ...tokens.shadow.card,
  },
  uploadTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: { fontSize: 17, fontWeight: '800', color: tokens.colors.onCardStrong },
  uploadSubtitle: { fontSize: 13, color: tokens.colors.onBrandMuted, lineHeight: 19 },
  checkButton: {
    minHeight: 44,
    backgroundColor: tokens.colors.contentSurface,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  checkButtonText: { color: tokens.colors.brand, fontSize: 12, fontWeight: '800' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: tokens.colors.onCanvas },
  seeAll: { fontSize: 13, color: tokens.colors.onCanvasMuted, fontWeight: '700' },
  categoryRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  categoryCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
    minHeight: 122,
    backgroundColor: tokens.colors.cardSoft,
    ...tokens.shadow.card,
  },
  categoryIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: tokens.colors.contentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCount: { fontSize: 22, fontWeight: '800', color: tokens.colors.text },
  categoryLabel: { fontSize: 12, color: tokens.colors.textMuted, fontWeight: '700', lineHeight: 16 },
  jobsList: { gap: 12 },
  loadingRow: { paddingVertical: 8 },
  jobCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    ...tokens.shadow.card,
  },
  jobCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  jobLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: tokens.colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobLogoText: { fontSize: 14, color: tokens.colors.brand, fontWeight: '700' },
  jobInfo: { flex: 1 },
  jobTitle: { fontSize: 15, fontWeight: '700', color: tokens.colors.text, marginBottom: 2 },
  jobCompany: { fontSize: 12, color: tokens.colors.textMuted },
  bookmarkBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: tokens.colors.contentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobTags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tag: {
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagText: { fontSize: 11, color: tokens.colors.textMuted, fontWeight: '600' },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  jobMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: tokens.colors.contentMuted,
  },
  jobMetaText: { fontSize: 11, color: tokens.colors.textMuted, fontWeight: '600' },
  jobSalary: { fontSize: 13, fontWeight: '700', color: tokens.colors.text },
});
