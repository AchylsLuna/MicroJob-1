import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Navigation from '../../components/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';
import { apiRequest, asList } from '../../lib/api';
import { tokens } from '../../theme/tokens';

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
  onViewJobDetails,
  onSaveJob,
  savedJobIds = [],
  activeTab: externalActiveTab,
  onTabPress: externalOnTabPress,
  onOpenNotifications,
  notificationBadgeCount = 0,
  messageBadgeCount = 0,
}: {
  onLogout?: () => void;
  onNavigateToJobs?: () => void;
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

  const recentJobs = useMemo(() => jobs.slice(0, 5), [jobs]);
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

  const syncResumeStatus = async () => {
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
  };

  useEffect(() => {
    fetchCategories();
    fetchJobs();
    syncResumeStatus();
  }, []);

  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
    externalOnTabPress?.(tab);
    if (tab === 'Jobs' && onNavigateToJobs) {
      onNavigateToJobs();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>Good morning, Jonas</Text>
          <Text style={styles.headerTitle}>Find your next role</Text>
        </View>
        <TouchableOpacity style={styles.notificationIcon} onPress={onOpenNotifications} activeOpacity={0.85}>
          <Ionicons name="notifications-outline" size={20} color={tokens.colors.text} />
          {notificationBadgeCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{notificationBadgeCount > 99 ? '99+' : String(notificationBadgeCount)}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color={tokens.colors.textSubtle} />
          <Text style={styles.searchPlaceholder}>Search jobs, skills, or companies</Text>
        </View>

        {!hasUploadedResume ? (
          <View style={styles.uploadCard}>
            <View style={styles.uploadTopRow}>
              <View style={styles.uploadIconWrap}>
                <Ionicons name="document-text-outline" size={18} color={tokens.colors.onBrand} />
              </View>
              <Text style={styles.uploadTitle}>Upload your resume</Text>
            </View>
            <Text style={styles.uploadSubtitle}>Get matched with top companies automatically.</Text>
            <TouchableOpacity style={styles.checkButton} activeOpacity={0.9}>
              <Text style={styles.checkButtonText}>Check Applied</Text>
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
          {categories.map((category, index) => {
            const colors = [tokens.colors.brandDark, tokens.colors.brand, tokens.colors.brandAccent];
            const openingCount = jobsByCategory[category._id] || 0;
            return (
              <View key={category._id} style={[styles.categoryCard, { backgroundColor: colors[index % colors.length] }]}>
                <View style={styles.categoryIconWrap}>
                  <Ionicons name="briefcase-outline" size={16} color={tokens.colors.onBrand} />
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

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
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
      </ScrollView>

      <Navigation activeTab={activeTab} onTabPress={handleTabPress} messageBadgeCount={messageBadgeCount} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  header: {
    paddingHorizontal: 18,
    paddingTop: 52,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: tokens.colors.background,
  },
  headerContent: {
    flex: 1,
    paddingRight: 12,
  },
  greeting: { fontSize: 13, color: tokens.colors.textMuted, marginBottom: 4, fontWeight: '600' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: tokens.colors.text, letterSpacing: -0.4 },
  notificationIcon: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: tokens.colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.surface,
  },
  badgeText: {
    color: tokens.colors.onBrand,
    fontSize: 11,
    fontWeight: '700',
  },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 90, gap: 16 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  searchPlaceholder: { fontSize: 14, color: tokens.colors.textSubtle },
  uploadCard: {
    backgroundColor: tokens.colors.brandDark,
    borderRadius: 18,
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
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: { fontSize: 17, fontWeight: '700', color: tokens.colors.onBrand },
  uploadSubtitle: { fontSize: 13, color: tokens.colors.onBrandMuted, lineHeight: 18 },
  checkButton: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  checkButtonText: { color: tokens.colors.onBrand, fontSize: 12, fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: tokens.colors.text },
  seeAll: { fontSize: 13, color: tokens.colors.brand, fontWeight: '600' },
  categoryRow: { flexDirection: 'row', gap: 10 },
  categoryCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
    minHeight: 104,
  },
  categoryIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCount: { fontSize: 22, fontWeight: '800', color: tokens.colors.onBrand },
  categoryLabel: { fontSize: 12, color: tokens.colors.onBrandMuted, fontWeight: '600', lineHeight: 16 },
  jobsList: { gap: 12 },
  loadingRow: { paddingVertical: 8 },
  errorText: {
    color: tokens.colors.danger,
    fontSize: 12,
  },
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
    backgroundColor: '#F8FAFC',
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
    backgroundColor: '#F8FAFC',
  },
  jobMetaText: { fontSize: 11, color: tokens.colors.textMuted, fontWeight: '600' },
  jobSalary: { fontSize: 13, fontWeight: '700', color: tokens.colors.text },
});
