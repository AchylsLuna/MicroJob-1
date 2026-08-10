import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Navigation from '../../components/navigation';
import ScrollView from '../../components/ui/SmoothScrollView';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import { apiRequest, asList } from '../../lib/api';
import { APPLICATION_STATUSES, ApplicationStatus, getApplicationStatusColor, normalizeApplicationStatus } from '../../lib/status';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import RatingModal, { MobileRatingTarget } from '../../components/reviews/RatingModal';

type AppliedJob = {
  id: string;
  jobId: string;
  title: string;
  company: string;
  status: ApplicationStatus;
  hasDetails?: boolean;
  employerName?: string;
};

type ReviewEligibility = {
  applicationId: string;
  canReview: boolean;
  existingReview?: { rating?: number } | null;
};

type AppliedJobsProps = {
  onViewSavedJobs?: () => void;
  onViewDetails?: (job: { _id: string }) => void;
  onMessageEmployer?: (payload: { userId?: string; userName?: string; jobId?: string }) => void;
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  messageBadgeCount?: number;
};

export default function AppliedJobs(props: AppliedJobsProps) {
  const {
    onViewSavedJobs,
    onViewDetails,
    activeTab: externalActiveTab,
    onTabPress: externalOnTabPress,
    messageBadgeCount = 0,
  } = props;
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(externalActiveTab || 'Jobs');
  const [selectedFilter, setSelectedFilter] = useState<'All' | ApplicationStatus>('All');
  const [applications, setApplications] = useState<AppliedJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [reviewEligibility, setReviewEligibility] = useState<Record<string, ReviewEligibility>>({});
  const [ratingTarget, setRatingTarget] = useState<MobileRatingTarget | null>(null);

  const filters = ['All', ...APPLICATION_STATUSES] as const;

  const filteredJobs = useMemo(() => applications.filter((job) => {
    if (selectedFilter === 'All') return true;
    return job.status === selectedFilter;
  }), [applications, selectedFilter]);
  const mountedRef = useRef(true);
  const requestRef = useRef(false);

  const fetchApplications = useCallback(async () => {
    if (requestRef.current) return;
    requestRef.current = true;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const [result, eligibilityResult] = await Promise.all([
        apiRequest(`${API_URL}/applications`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }, 'Failed to load applications.'),
        apiRequest(`${API_URL}/reviews/eligible`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }, 'Failed to load review eligibility.'),
      ]);
      if (!result.ok) {
        throw new Error(result.message || 'Failed to load applications.');
      }
      const mapped = asList<any>(result.raw, ['applications']).map((app: any) => ({
        id: app._id,
        jobId: app.job?._id,
        title: app.job?.title || 'Untitled job',
        company: app.job?.jobPoster
          ? `${app.job.jobPoster.firstName || ''} ${app.job.jobPoster.lastName || ''}`.trim()
          : 'Job Poster',
        status: normalizeApplicationStatus(app.status),
        hasDetails: true,
        employerName: app.job?.jobPoster?.companyName || `${app.job?.jobPoster?.firstName || ''} ${app.job?.jobPoster?.lastName || ''}`.trim() || 'Employer',
      }));
      if (!mountedRef.current) return;
      setApplications(mapped);
      const eligibilityPayload: any = eligibilityResult.data || eligibilityResult.raw || {};
      const workerItems: ReviewEligibility[] = Array.isArray(eligibilityPayload?.asWorker) ? eligibilityPayload.asWorker : [];
      setReviewEligibility(Object.fromEntries(workerItems.map((item) => [item.applicationId, item])));
    } catch (error: any) {
      if (mountedRef.current) setErrorMessage(error?.message || 'Failed to load applications.');
    } finally {
      requestRef.current = false;
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void fetchApplications();
    return () => { mountedRef.current = false; };
  }, [fetchApplications]);

  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
    externalOnTabPress?.(tab);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => handleTabPress('Jobs')} accessibilityRole="button" accessibilityLabel="Back to jobs">
          <Ionicons name="chevron-back" size={20} color={tokens.colors.brand} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Applied jobs</Text>
          <Text style={styles.headerSubtitle}>{applications.length} total applications</Text>
        </View>
        <View style={styles.headerRightSpacer} />
      </View>

      <View style={styles.toggleContainer}>
        <View style={[styles.toggleBtn, styles.toggleBtnActive]}>
          <Text style={styles.toggleBtnTextActive}>Applied Job details</Text>
        </View>
        <TouchableOpacity
          style={[styles.toggleBtn, styles.toggleBtnInactive]}
          onPress={onViewSavedJobs}
          accessibilityRole="button"
          accessibilityLabel="Open saved jobs"
        >
          <Text style={styles.toggleBtnTextInactive}>Save job</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
        {filters.map((filter) => {
          const isActive = selectedFilter === filter;
          const color = filter === 'All' ? '#1f2937' : getApplicationStatusColor(filter as ApplicationStatus);
          return (
            <TouchableOpacity
              key={filter}
              style={[styles.filterPill, isActive && styles.filterPillActive, { borderColor: color }]}
              onPress={() => setSelectedFilter(filter)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Filter applications by ${filter}`}
            >
              <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive, { color }]}>{filter}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={filteredJobs}
        keyExtractor={(job) => job.id}
        style={styles.mainScroll}
        contentContainerStyle={[styles.scroll, { paddingBottom: 96 + Math.max(insets.bottom, 10) }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        ListHeaderComponent={errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        ListEmptyComponent={isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#1C4D8D" />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No applications</Text>
            <Text style={styles.emptyText}>
              You don't have any {selectedFilter.toLowerCase()} applications yet
            </Text>
          </View>
        )}
        renderItem={({ item: job }) => (
              <View style={styles.jobCard}>
                <View style={styles.jobCardHeader}>
                  <View style={styles.logoWrap}>
                    <Text style={styles.logoText}>logo</Text>
                  </View>
                  <View style={styles.jobInfo}>
                    <Text style={styles.jobTitle}>{job.title}</Text>
                    <Text style={styles.jobCompany}>{job.company}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.detailsLink}
                  disabled={!job.hasDetails || !job.jobId}
                  onPress={() => onViewDetails?.({ _id: job.jobId })}
                >
                  <Text style={[styles.statusInline, { color: getApplicationStatusColor(job.status) }]}>{job.status}</Text>
                  <Text style={styles.viewDetailsText}>View details ›</Text>
                </TouchableOpacity>
                {reviewEligibility[job.id]?.canReview ? (
                  <TouchableOpacity
                    style={styles.rateButton}
                    onPress={() => setRatingTarget({ applicationId: job.id, name: job.employerName || job.company, jobTitle: job.title, roleLabel: 'employer' })}
                    accessibilityRole="button"
                    accessibilityLabel={`Rate employer for ${job.title}`}
                  >
                    <Ionicons name="star" size={16} color="#92400E" />
                    <Text style={styles.rateButtonText}>Rate Employer</Text>
                  </TouchableOpacity>
                ) : reviewEligibility[job.id]?.existingReview ? (
                  <Text style={styles.reviewedText}>★ Review submitted</Text>
                ) : null}
              </View>
        )}
      />

      <Navigation activeTab={activeTab} onTabPress={handleTabPress} messageBadgeCount={messageBadgeCount} />
      <RatingModal target={ratingTarget} onClose={() => setRatingTarget(null)} onSubmitted={fetchApplications} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRightSpacer: { width: 44, height: 44 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: tokens.colors.text, letterSpacing: -0.3 },
  headerSubtitle: { marginTop: 2, fontSize: 13, fontWeight: '500', color: tokens.colors.textMuted },
  toggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 10,
    backgroundColor: tokens.colors.contentSurface,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  toggleBtnActive: {
    backgroundColor: tokens.colors.brand,
    borderColor: tokens.colors.brand,
  },
  toggleBtnInactive: {
    backgroundColor: '#eef0f1',
    borderColor: '#d1d5db',
  },
  toggleBtnTextActive: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.surface,
  },
  toggleBtnTextInactive: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
  },
  filterScroll: {
    maxHeight: 42,
    backgroundColor: '#e5e7eb',
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#f3f4f6',
  },
  filterPillActive: {
    backgroundColor: tokens.colors.surface,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  filterPillTextActive: {
    fontWeight: '700',
  },
  mainScroll: { flex: 1 },
  itemSeparator: { height: 12 },
  scroll: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 112 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: tokens.colors.contentSurface,
    ...tokens.shadow.card,
  },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6b7280' },
  loadingRow: { paddingVertical: 8 },
  errorText: { color: '#b91c1c', fontSize: 12, marginBottom: 8 },
  jobsList: { gap: 12, marginTop: 2 },
  jobCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  jobCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: tokens.colors.text, fontSize: 10, fontWeight: '700' },
  jobInfo: { flex: 1 },
  jobTitle: { fontSize: 22, fontWeight: '700', color: tokens.colors.text, marginBottom: 0 },
  jobCompany: { fontSize: 13, color: '#6b7280' },
  detailsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  statusInline: {
    fontSize: 13,
    fontWeight: '600',
  },
  viewDetailsText: { fontSize: 12, color: tokens.colors.text, fontWeight: '600' },
  rateButton: { marginTop: 10, minHeight: 44, borderRadius: 12, backgroundColor: '#FEF3C7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  rateButtonText: { color: '#92400E', fontSize: 13, fontWeight: '800' },
  reviewedText: { marginTop: 10, textAlign: 'center', color: '#047857', fontSize: 12, fontWeight: '700' },
});
