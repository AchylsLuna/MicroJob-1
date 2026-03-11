import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';
import EmployerNavigation from '../../components/employerNavigation';
import TabTopNav from '../../components/TabTopNav';
import { apiRequest, asList } from '../../lib/api';
import { APPLICATION_STATUSES, ApplicationStatus, normalizeApplicationStatus } from '../../lib/status';
import PublicProfile from '../shared/PublicProfile';

type ApplicationItem = {
  _id: string;
  status: ApplicationStatus;
  createdAt?: string;
  job: {
    _id: string;
    title: string;
  };
  applicant: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    role?: string;
    phoneNumber?: string;
    jobsApplied?: number;
    projectsCompleted?: number;
    successRate?: string;
    city?: string;
    totalExperience?: string;
    about?: string;
    avatarUrl?: string;
  };
  coverLetter?: string;
  resume?: string;
};

type EmployerApplicationsProps = {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  onMessageWorker?: (workerId: string, jobId: string) => void;
};

const STATUS_OPTIONS: ApplicationStatus[] = APPLICATION_STATUSES;

const getApiStatusCandidates = (status: ApplicationStatus): string[] => {
  // Support both newer (Interviewed) and older (Terms) backend status enums.
  if (status === 'To Be Interview') return ['Interviewed', 'Terms'];
  return [status];
};

const toApiFilterStatus = (status: 'All' | ApplicationStatus): string | null => {
  if (status === 'All') return null;
  return getApiStatusCandidates(status)[0];
};

export default function EmployerApplications({
  activeTab,
  onTabPress,
  onMessageWorker,
}: EmployerApplicationsProps) {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ApplicationStatus>('All');
  const [jobFilter, setJobFilter] = useState<'All' | string>('All');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const jobOptions = useMemo(() => {
    const unique = new Map<string, string>();
    applications.forEach((app) => {
      if (app.job?._id) unique.set(app.job._id, app.job.title);
    });
    return Array.from(unique.entries()).map(([id, title]) => ({ id, title }));
  }, [applications]);

  const fetchApplications = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const params = new URLSearchParams();
      const apiStatusFilter = toApiFilterStatus(statusFilter);
      if (apiStatusFilter) params.set('status', apiStatusFilter);
      if (jobFilter !== 'All') params.set('jobId', jobFilter);
      if (search) params.set('search', search);
      const buildUrl = () => `${API_URL}/applications/employer${params.toString() ? `?${params}` : ''}`;

      let result = await apiRequest(buildUrl(), {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }, 'Failed to load applications.');

      if (
        !result.ok &&
        statusFilter === 'To Be Interview' &&
        (result.message || '').includes('Invalid status')
      ) {
        params.set('status', 'Terms');
        result = await apiRequest(buildUrl(), {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }, 'Failed to load applications.');
      }

      if (!result.ok) throw new Error(result.message || 'Failed to load applications.');
      const mapped = asList<any>(result.raw, ['applications']).map((item) => ({
        ...item,
        status: normalizeApplicationStatus(item?.status),
      }));
      setApplications(mapped as ApplicationItem[]);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to load applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(fetchApplications, 300);
    return () => clearTimeout(debounce);
  }, [statusFilter, jobFilter, search]);

  const handleStatusChange = async (applicationId: string, status: ApplicationStatus) => {
    setUpdatingId(applicationId);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const candidates = getApiStatusCandidates(status);
      let result: any = null;

      for (let i = 0; i < candidates.length; i += 1) {
        result = await apiRequest(`${API_URL}/applications/${applicationId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ status: candidates[i] }),
        }, 'Failed to update status.');

        if (result.ok) break;
        const shouldRetry = (result.message || '').includes('Invalid status') && i < candidates.length - 1;
        if (!shouldRetry) break;
      }

      if (!result.ok) throw new Error(result.message || 'Failed to update status.');
      setApplications((prev) =>
        prev.map((app) => (app._id === applicationId ? { ...app, status } : app))
      );
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to update status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemoveApplication = (applicationId: string) => {
    setErrorMessage('');
    AsyncStorage.getItem('auth_token')
      .then((token) =>
        apiRequest(`${API_URL}/applications/${applicationId}/employer/remove`, {
          method: 'PATCH',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }, 'Failed to remove application.')
      )
      .then((result) => {
        if (result?.ok) {
          setApplications((prev) => prev.filter((app) => app._id !== applicationId));
          return;
        }
        if (result) {
          setErrorMessage(result.message || 'Failed to remove application.');
        }
      })
      .catch((error) => {
        setErrorMessage(error?.message || 'Failed to remove application.');
      });
  };

  const handleViewProfile = (applicantId: string) => {
    setProfileUserId(applicantId);
    setShowProfile(true);
    setExpandedId(null);
  };

  if (showProfile && profileUserId) {
    return (
      <PublicProfile
        userId={profileUserId}
        viewAs="worker"
        onBack={() => {
          setShowProfile(false);
          setProfileUserId(null);
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <TabTopNav title="Applications" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.filterCard}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />

          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.filterChip, statusFilter === 'All' && styles.filterChipActive]}
              onPress={() => setStatusFilter('All')}
            >
              <Text
                style={[styles.filterChipText, statusFilter === 'All' && styles.filterChipTextActive]}
              >
                All Statuses
              </Text>
            </TouchableOpacity>
            {STATUS_OPTIONS.map((status) => (
              <TouchableOpacity
                key={status}
                style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
                onPress={() => setStatusFilter(status)}
              >
                <Text
                  style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}
                >
                  {status}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.jobsScroll}>
            <TouchableOpacity
              style={[styles.jobChip, jobFilter === 'All' && styles.jobChipActive]}
              onPress={() => setJobFilter('All')}
            >
              <Text style={[styles.jobChipText, jobFilter === 'All' && styles.jobChipTextActive]}>All Jobs</Text>
            </TouchableOpacity>
            {jobOptions.map((job) => (
              <TouchableOpacity
                key={job.id}
                style={[styles.jobChip, jobFilter === job.id && styles.jobChipActive]}
                onPress={() => setJobFilter(job.id)}
              >
                <Text
                  style={[styles.jobChipText, jobFilter === job.id && styles.jobChipTextActive]}
                  numberOfLines={1}
                >
                  {job.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.card}>
            <ActivityIndicator color="#0a2847" />
            <Text style={styles.loadingText}>Loading applications...</Text>
          </View>
        ) : null}

        {!loading && applications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No applications found.</Text>
          </View>
        ) : null}

        {applications.map((app) => (
          <View key={app._id} style={styles.card}>
            <View style={styles.appHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(app.applicant?.firstName?.[0] || '').toUpperCase()}
                  {(app.applicant?.lastName?.[0] || '').toUpperCase()}
                </Text>
              </View>
              <View style={styles.appInfo}>
                <Text style={styles.appName}>
                  {app.applicant?.firstName} {app.applicant?.lastName}
                </Text>
                <Text style={styles.appEmail}>{app.applicant?.email}</Text>
                <Text style={styles.appJob}>Applied for: {app.job?.title}</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{app.status}</Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : ''}
              </Text>
              <View style={styles.metaActions}>
                <TouchableOpacity onPress={() => handleViewProfile(app.applicant._id)}>
                  <Text style={styles.linkText}>View Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleRemoveApplication(app._id)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
                {onMessageWorker && (
                  <TouchableOpacity onPress={() => onMessageWorker(app.applicant._id, app.job._id)}>
                    <Text style={styles.linkText}>Message</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusButton,
                    app.status === status && styles.statusButtonActive,
                  ]}
                  onPress={() => handleStatusChange(app._id, status)}
                  disabled={updatingId === app._id}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      app.status === status && styles.statusButtonTextActive,
                    ]}
                  >
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {expandedId === app._id ? (
              <View style={styles.profileBox}>
                <Text style={styles.profileTitle}>Applicant Details</Text>
                <Text style={styles.profileText}>
                  Name: {app.applicant?.firstName} {app.applicant?.lastName}
                </Text>
                <Text style={styles.profileText}>Email: {app.applicant?.email}</Text>
                {app.applicant?.phoneNumber ? (
                  <Text style={styles.profileText}>Phone: {app.applicant.phoneNumber}</Text>
                ) : null}
                {app.applicant?.role ? (
                  <Text style={styles.profileText}>Role: {app.applicant.role}</Text>
                ) : null}
                <View style={styles.workerStatsRow}>
                  <View style={styles.workerStatBox}>
                    <Text style={styles.workerStatValue}>{app.applicant?.jobsApplied ?? 0}</Text>
                    <Text style={styles.workerStatLabel}>Applied Jobs</Text>
                  </View>
                  <View style={styles.workerStatBox}>
                    <Text style={styles.workerStatValue}>{app.applicant?.projectsCompleted ?? 0}</Text>
                    <Text style={styles.workerStatLabel}>Completed Jobs</Text>
                  </View>
                  <View style={styles.workerStatBox}>
                    <Text style={styles.workerStatValue}>{app.applicant?.successRate || '0%'}</Text>
                    <Text style={styles.workerStatLabel}>Success Rate</Text>
                  </View>
                </View>
                {app.applicant?.city ? (
                  <Text style={styles.profileText}>City: {app.applicant.city}</Text>
                ) : null}
                {app.applicant?.totalExperience ? (
                  <Text style={styles.profileText}>Experience: {app.applicant.totalExperience}</Text>
                ) : null}
                {app.applicant?.about ? (
                  <Text style={styles.profileText}>About: {app.applicant.about}</Text>
                ) : null}
                {app.resume ? <Text style={styles.profileText}>Resume: Available</Text> : null}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <EmployerNavigation activeTab={activeTab} onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },
  scroll: { padding: 20, paddingBottom: 90 },
  filterCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#111827',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  filterChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: '#0a2847',
    borderColor: '#0a2847',
  },
  filterChipText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  filterChipTextActive: { color: '#ffffff' },
  jobsScroll: { marginTop: 12 },
  jobChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    maxWidth: 180,
  },
  jobChipActive: { backgroundColor: '#e0f2fe', borderColor: '#38bdf8' },
  jobChipText: { fontSize: 11, color: '#475569' },
  jobChipTextActive: { color: '#0284c7', fontWeight: '700' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  loadingText: { marginTop: 10, color: '#475569', fontSize: 13 },
  errorCard: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: '#dc2626', fontSize: 12 },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: '#6b7280' },
  appHeader: { flexDirection: 'row', gap: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#be123c', fontWeight: '700' },
  appInfo: { flex: 1 },
  appName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  appEmail: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  appJob: { fontSize: 12, color: '#374151', marginTop: 6 },
  statusPill: {
    backgroundColor: '#fef9c3',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  statusText: { fontSize: 11, color: '#a16207', fontWeight: '700' },
  coverLetter: { fontSize: 12, color: '#4b5563', marginTop: 12, lineHeight: 18 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  metaText: { fontSize: 12, color: '#6b7280' },
  metaActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkText: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
  removeText: { fontSize: 12, color: '#b91c1c', fontWeight: '700' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  statusButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusButtonActive: { backgroundColor: '#0a2847', borderColor: '#0a2847' },
  statusButtonText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  statusButtonTextActive: { color: '#ffffff' },
  profileBox: {
    marginTop: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  profileTitle: { fontSize: 12, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  profileText: { fontSize: 12, color: '#475569', marginBottom: 4 },
  workerStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
  },
  workerStatBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  workerStatValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  workerStatLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
});
