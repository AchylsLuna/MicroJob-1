import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Navigation from '../../components/navigation';
import ScrollView from '../../components/ui/SmoothScrollView';
import TabTopNav from '../../components/TabTopNav';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import { apiRequest, asList } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import InlineStateCard from '../../components/ui/InlineStateCard';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import CategoryTile from '../../components/ui/CategoryTile';
import SectionHeader from '../../components/ui/SectionHeader';
import JobCard from '../../components/job/JobCard';
import { toJobCardData } from '../../components/job/jobCardModel';

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
  match?: { percentage?: number; level?: string; reasons?: string[] };
};

export default function Dashboard({
  onNavigateToJobs,
  onSelectCategory,
  onUploadResume,
  onOpenSettings,
  onViewJobDetails,
  onSaveJob,
  savedJobIds = [],
  activeTab: externalActiveTab,
  onTabPress: externalOnTabPress,
  onOpenNotifications,
  notificationBadgeCount = 0,
  messageBadgeCount = 0,
  headerSubtitle,
}: {
  onNavigateToJobs?: () => void;
  onSelectCategory?: (categoryId: string) => void;
  onUploadResume?: () => void;
  onOpenSettings?: () => void;
  onViewJobDetails?: (job: any) => void;
  onSaveJob?: (job: any) => void;
  savedJobIds?: string[];
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  onOpenNotifications?: () => void;
  notificationBadgeCount?: number;
  messageBadgeCount?: number;
  headerSubtitle?: string;
}) {
  const { t } = useTranslation('worker');
  const [categories, setCategories] = useState<Category[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<Job[]>([]);
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

  const fetchCategories = useCallback(async () => {
    try {
      const result = await apiRequest<Category[]>(`${API_URL}/categories`, undefined, t('dashboard.apiFallback.loadCategoriesFailed'));
      if (result.ok) {
        setCategories(asList<Category>(result.raw, ['categories']).slice(0, 10));
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, [t]);

  const fetchJobs = useCallback(async () => {
    if (jobsRequestInFlight.current) return;
    jobsRequestInFlight.current = true;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const [result, recommendedResult] = await Promise.all([
        apiRequest<Job[]>(`${API_URL}/jobs?excludeOwn=true`, { headers }, t('dashboard.apiFallback.loadJobsFailed')),
        apiRequest<Job[]>(`${API_URL}/jobs/recommended?limit=5`, { headers }, t('dashboard.apiFallback.loadRecommendedFailed')),
      ]);
      if (!result.ok) throw new Error(result.message || t('dashboard.apiFallback.loadJobsFailed'));
      setJobs(asList<Job>(result.raw, ['jobs']));
      setRecommendedJobs(recommendedResult.ok ? asList<Job>(recommendedResult.raw, ['jobs']) : []);
    } catch (error: any) {
      setErrorMessage(error?.message || t('dashboard.apiFallback.loadJobsFailed'));
    } finally {
      jobsRequestInFlight.current = false;
      setIsLoading(false);
    }
  }, [t]);

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
      }, t('dashboard.apiFallback.loadProfileFailed'));

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
  }, [t]);

  useEffect(() => {
    fetchCategories();
    fetchJobs();
    syncResumeStatus();
  }, [fetchCategories, fetchJobs, syncResumeStatus]);

  const handleTabPress = (tab: string) => {
    externalOnTabPress?.(tab);
  };

  return (
    <View style={styles.container}>
      <TabTopNav
        title={t('dashboard.headerTitle')}
        subtitle={headerSubtitle}
        onSubtitlePress={onOpenSettings}
        homeContext
        showNotifications
        onOpenNotifications={onOpenNotifications}
        notificationBadgeCount={notificationBadgeCount}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AnimatedPressable containerStyle={styles.searchContainer} onPress={onNavigateToJobs} accessibilityRole="button" accessibilityLabel={t('dashboard.search.accessibilityLabel')}>
          <View style={styles.searchRow}>
            <View style={styles.searchIconWrap}>
              <Ionicons name="search-outline" size={17} color={tokens.colors.brand} />
            </View>
            <View style={styles.searchCopy}>
              <Text style={styles.searchTitle}>{t('dashboard.search.title')}</Text>
              <Text style={styles.searchSubtitle}>{t('dashboard.search.subtitle')}</Text>
            </View>
            <View style={styles.searchFilterDot}>
              <Ionicons name="options-outline" size={16} color={tokens.colors.brand} />
            </View>
          </View>
        </AnimatedPressable>

        {!hasUploadedResume ? (
          <View style={styles.uploadCard}>
            <View style={styles.uploadTopRow}>
              <View style={styles.uploadIconWrap}>
                <Ionicons name="document-text-outline" size={20} color={tokens.colors.onCardStrong} />
              </View>
              <Text style={styles.uploadTitle}>{t('dashboard.resumeCard.title')}</Text>
            </View>
            <Text style={styles.uploadSubtitle}>{t('dashboard.resumeCard.subtitle')}</Text>
            <AnimatedPressable containerStyle={styles.checkButton} onPress={onUploadResume} accessibilityRole="button" accessibilityLabel={t('dashboard.resumeCard.uploadAccessibility')}>
              <Text style={styles.checkButtonText}>{t('dashboard.resumeCard.uploadButton')}</Text>
            </AnimatedPressable>
          </View>
        ) : null}

        <SectionHeader title={t('dashboard.sections.categories')} onSeeAll={onNavigateToJobs} seeAllLabel={t('dashboard.sections.browseAll')} />

        <ScrollView horizontal contentContainerStyle={styles.categoryRow}>
          {categories.map((category) => {
            const openingCount = jobsByCategory[category._id] || 0;
            return (
              <AnimatedPressable
                key={category._id}
                onPress={() => onSelectCategory?.(category._id)}
                accessibilityRole="button"
                accessibilityLabel={t('dashboard.category.accessibilityLabel', { name: category.name, count: openingCount })}
              >
                <CategoryTile category={category} size="lg" showLabel count={openingCount} />
              </AnimatedPressable>
            );
          })}
        </ScrollView>

        <SectionHeader title={t('dashboard.sections.matchingSkills')} onSeeAll={onNavigateToJobs} />

        {errorMessage ? <InlineStateCard
          icon={needsLocation ? 'location-outline' : 'cloud-offline-outline'}
          title={needsLocation ? t('dashboard.state.locationTitle') : t('dashboard.state.unavailableTitle')}
          message={needsLocation ? t('dashboard.state.locationMessage') : errorMessage}
          actionLabel={needsLocation ? t('dashboard.state.locationAction') : t('dashboard.state.unavailableAction')}
          onAction={needsLocation ? onOpenSettings : fetchJobs}
          busy={isLoading}
        /> : null}
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={tokens.colors.brand} />
          </View>
        ) : null}

        {recommendedJobs.length > 0 ? (
          <ScrollView horizontal contentContainerStyle={styles.jobsCarousel} snapToInterval={256} decelerationRate="fast">
            {recommendedJobs.map((job) => (
              <JobCard
                key={job._id}
                job={toJobCardData(job)}
                variant="carousel"
                showMatch
                saved={savedJobIds.includes(job._id)}
                onPress={() => onViewJobDetails?.(job)}
                onToggleSave={() => onSaveJob?.(job)}
              />
            ))}
          </ScrollView>
        ) : null}
        {!isLoading && !errorMessage && recommendedJobs.length === 0 ? <InlineStateCard icon="briefcase-outline" title={t('dashboard.state.emptyTitle')} message={t('dashboard.state.emptyMessage')} actionLabel={t('dashboard.state.emptyAction')} onAction={onNavigateToJobs} /> : null}

        {recentJobs.length > 0 ? (
          <>
            <SectionHeader title={t('dashboard.sections.recentInArea')} onSeeAll={onNavigateToJobs} />
            <View style={styles.jobsList}>
              {recentJobs.map((job) => (
                <JobCard
                  key={job._id}
                  job={toJobCardData(job)}
                  variant="list"
                  saved={savedJobIds.includes(job._id)}
                  onPress={() => onViewJobDetails?.(job)}
                  onToggleSave={() => onSaveJob?.(job)}
                />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <Navigation activeTab={externalActiveTab || 'Home'} onTabPress={handleTabPress} messageBadgeCount={messageBadgeCount} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.signedInCanvas },
  scroll: { paddingHorizontal: tokens.layout.gutterWide, paddingTop: 16, paddingBottom: tokens.layout.tabBarClearance + 16, gap: tokens.layout.sectionGap },
  searchContainer: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.spacing.sm,
    minHeight: tokens.controls.fieldHeight,
    ...tokens.shadow.card,
  },
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
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, width: '100%' },
  searchIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: tokens.colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  searchCopy: { flex: 1 },
  searchTitle: { fontSize: 14, fontWeight: '800', color: tokens.colors.text },
  searchSubtitle: { fontSize: 12, color: tokens.colors.textSubtle, marginTop: 1 },
  searchFilterDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: tokens.colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  categoryRow: { flexDirection: 'row', gap: tokens.spacing.sm, paddingRight: tokens.spacing.md },
  jobsCarousel: { flexDirection: 'row', gap: tokens.spacing.sm, paddingRight: tokens.spacing.md },
  jobsList: { gap: 12 },
  loadingRow: { paddingVertical: 8 },
});
