import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import Navigation from '../../components/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';
import { apiRequest, asList } from '../../lib/api';
import { APPLICATION_STATUSES, ApplicationStatus, getApplicationStatusColor, normalizeApplicationStatus } from '../../lib/status';

type AppliedJob = {
  id: string;
  jobId: string;
  title: string;
  company: string;
  status: ApplicationStatus;
  hasDetails?: boolean;
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
  const [activeTab, setActiveTab] = useState(externalActiveTab || 'Jobs');
  const [selectedFilter, setSelectedFilter] = useState<'All' | ApplicationStatus>('All');
  const [applications, setApplications] = useState<AppliedJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const filters = ['All', ...APPLICATION_STATUSES] as const;

  const filteredJobs = applications.filter((job) => {
    if (selectedFilter === 'All') return true;
    return job.status === selectedFilter;
  });

  const fetchApplications = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/applications`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }, 'Failed to load applications.');
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
      }));
      setApplications(mapped);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to load applications.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
    externalOnTabPress?.(tab);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => handleTabPress('Jobs')}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Applied jobs</Text>
      </View>

      <View style={styles.toggleContainer}>
        <TouchableOpacity style={[styles.toggleBtn, styles.toggleBtnActive]}>
          <Text style={styles.toggleBtnTextActive}>Applied Job details</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, styles.toggleBtnInactive]}
          onPress={onViewSavedJobs}
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
            >
              <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive, { color }]}>{filter}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.mainScroll} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#1e3a5f" />
          </View>
        ) : null}
        {filteredJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No applications</Text>
            <Text style={styles.emptyText}>
              You don't have any {selectedFilter.toLowerCase()} applications yet
            </Text>
          </View>
        ) : (
          <View style={styles.jobsList}>
            {filteredJobs.map((job) => (
              <View key={job.id} style={styles.jobCard}>
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
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Navigation activeTab={activeTab} onTabPress={handleTabPress} messageBadgeCount={messageBadgeCount} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e5e7eb' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: '#1e3a5f',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    left: 12,
    top: 46,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 24, lineHeight: 24 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  toggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 10,
    backgroundColor: '#e5e7eb',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  toggleBtnActive: {
    backgroundColor: '#1e3a5f',
    borderColor: '#1e3a5f',
  },
  toggleBtnInactive: {
    backgroundColor: '#eef0f1',
    borderColor: '#d1d5db',
  },
  toggleBtnTextActive: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
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
    backgroundColor: '#ffffff',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  filterPillTextActive: {
    fontWeight: '700',
  },
  mainScroll: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 90 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6b7280' },
  loadingRow: { paddingVertical: 8 },
  errorText: { color: '#b91c1c', fontSize: 12, marginBottom: 8 },
  jobsList: { gap: 12, marginTop: 2 },
  jobCard: {
    backgroundColor: '#fff',
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
  logoText: { color: '#111827', fontSize: 10, fontWeight: '700' },
  jobInfo: { flex: 1 },
  jobTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 0 },
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
  viewDetailsText: { fontSize: 12, color: '#111827', fontWeight: '600' },
});
