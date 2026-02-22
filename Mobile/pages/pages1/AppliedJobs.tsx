import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import Navigation from '../../components/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';
import { apiRequest, asList, asObject } from '../../lib/api';
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
    onMessageEmployer,
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
        {filters.map((filter) => {
          const isActive = selectedFilter === filter;
          const color = filter === 'All' ? '#1f2937' : getApplicationStatusColor(filter as ApplicationStatus);
          return (
            <TouchableOpacity
              key={filter}
              style={[styles.filterPill, isActive && styles.filterPillActive, { borderColor: color }]}
              onPress={() => setSelectedFilter(filter)}
            >
              <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive, { color }]}> {filter} </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
                  <View style={styles.jobInfo}>
                    <Text style={styles.jobTitle}>{job.title}</Text>
                    <Text style={styles.jobCompany}>{job.company}</Text>
                  </View>
                </View>

                <View style={styles.jobDetails}>
                  <View style={[styles.statusBadge, { backgroundColor: getApplicationStatusColor(job.status) }]}
                  >
                    <Text style={styles.statusText}>{job.status}</Text>
                  </View>
                  {job.hasDetails && job.jobId ? (
                    <TouchableOpacity
                      style={styles.detailsLink}
                      onPress={() => onViewDetails?.({ _id: job.jobId })}
                    >
                      <Text style={styles.detailsText}>Application Details</Text>
                      <Text style={styles.detailsArrow}>›</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Message Button */}
                <TouchableOpacity
                  style={{marginTop: 8, backgroundColor: '#3b82f6', borderRadius: 8, padding: 10, alignItems: 'center'}}
                  onPress={async () => {
                    // Find the employer userId from the application/job data
                    const token = await AsyncStorage.getItem('auth_token');
                    // Fetch the full application to get employer userId if not present
                    let employerId = null;
                    try {
                      const result = await apiRequest(`${API_URL}/applications/${job.id}`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                      }, 'Failed to load application details.');
                      if (result.ok) {
                        const rawObject = asObject<any>(result.raw);
                        const payload = asObject<any>(result.data);
                        const application = rawObject?.application || payload?.application || payload;
                        employerId = application?.job?.jobPoster?._id;
                      }
                    } catch {}
                    if (!employerId) {
                      Alert.alert('Error', 'Could not find employer user ID.');
                      return;
                    }
                    onMessageEmployer?.({
                      userId: employerId,
                      userName: job.company,
                      jobId: job.jobId,
                    });
                  }}
                >
                  <Text style={{color: '#fff', fontWeight: '700'}}>Message Employer</Text>
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
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 4,
    backgroundColor: '#1e3a5f',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  toggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 12,
    backgroundColor: '#fff',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  toggleBtnActive: {
    backgroundColor: '#1e3a5f',
    borderColor: '#1e3a5f',
  },
  toggleBtnInactive: {
    backgroundColor: '#f5f7fa',
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
    paddingVertical: 0,
    gap: 4,
    backgroundColor: '#fff',
    alignItems: 'flex-start',
  },
  filterPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  filterPillActive: {
    backgroundColor: '#f8fafc',
  },
  filterPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  filterPillTextActive: {
    fontWeight: '700',
  },
  scroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 90 },
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
  jobsList: { gap: 10, marginTop: 6 },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  jobCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  jobInfo: { flex: 1 },
  jobTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 2 },
  jobCompany: { fontSize: 13, color: '#6b7280' },
  jobDetails: {
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  detailsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailsText: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '600',
  },
  detailsArrow: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '700',
  },
});
