import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';
import EmployerNavigation from '../../components/employerNavigation';

type JobItem = {
  _id: string;
  title: string;
  location: string;
  salary: string;
  jobType: string;
  status?: string;
  urgent?: boolean;
  applicants?: string[];
  category?: { name: string };
  createdAt?: string;
};

type EmployerJobPostsProps = {
  onOpenPostJob?: () => void;
  onOpenApplications?: () => void;
  onOpenProfile?: () => void;
  onOpenNotifications?: () => void;
  onEditJob?: (job: JobItem) => void;
  activeTab?: string;
  onTabPress?: (tab: string) => void;
};

export default function EmployerJobPosts({
  onOpenPostJob,
  onOpenApplications,
  onOpenProfile,
  onOpenNotifications,
  onEditJob,
  activeTab,
  onTabPress,
}: EmployerJobPostsProps) {
  const [employerName, setEmployerName] = useState('Employer');
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const totalApplicants = jobs.reduce((sum, job) => sum + (job.applicants?.length || 0), 0);

  const fetchJobs = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/jobs/mine`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || 'Failed to load job posts.');
      setJobs(data || []);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to load job posts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    const loadEmployerName = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('auth_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          const name = [parsed?.firstName, parsed?.lastName].filter(Boolean).join(' ');
          if (name) {
            setEmployerName(name);
            return;
          }
        }
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) return;
        const response = await fetch(`${API_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return;
        const profile = data?.profile || data?.user;
        const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
        if (name) setEmployerName(name);
      } catch (error) {
        console.log('Failed to load employer name', error);
      }
    };

    loadEmployerName();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{employerName}</Text>
          <Text style={styles.headerSubtitle}>Employer</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{jobs.length}</Text>
            <Text style={styles.summaryLabel}>Job Posts</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalApplicants}</Text>
            <Text style={styles.summaryLabel}>Total Applicants</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.card}>
            <ActivityIndicator color="#0a2847" />
            <Text style={styles.loadingText}>Loading your job posts...</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {!loading && jobs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Job Posts Yet</Text>
            <Text style={styles.emptyText}>Create your first job post to start receiving applications.</Text>
          </View>
        ) : null}

        {jobs.map((job) => (
          <View key={job._id} style={styles.jobCard}>
            <View style={styles.jobHeader}>
              <View>
                <Text style={styles.jobTitle}>{job.title}</Text>
                <Text style={styles.jobLocation}>{job.location}</Text>
                {job.category?.name ? (
                  <Text style={styles.categoryTag}>{job.category.name}</Text>
                ) : null}
              </View>
              <View style={styles.statusColumn}>
                {job.urgent ? (
                  <View style={styles.urgentTag}>
                    <Text style={styles.urgentText}>Urgent</Text>
                  </View>
                ) : null}
                <View style={styles.statusTag}>
                  <Text style={styles.statusText}>{job.status || 'Available'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.jobType}>{job.jobType}</Text>
              <Text style={styles.salary}>{job.salary}</Text>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Applicants: {job.applicants?.length || 0}</Text>
              <View style={styles.footerActions}>
                <Text style={styles.footerText}>
                  {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : ''}
                </Text>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => onEditJob?.(job)}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Applicants List (count only, no message button due to type) */}
            {/* If you want to show applicant details, update the backend to return applicant objects, not just string IDs */}
          </View>
        ))}
      </ScrollView>

      <EmployerNavigation
        activeTab={activeTab}
        onTabPress={onTabPress}
        notificationsCount={totalApplicants}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },
  header: {
    backgroundColor: '#0a2847',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  headerTitle: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  headerSubtitle: { color: '#cbd5f0', fontSize: 13, marginTop: 4 },
  scroll: { padding: 20, paddingBottom: 90 },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 18, fontWeight: '700', color: '#0a2847' },
  summaryLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  summaryDivider: { width: 1, height: 36, backgroundColor: '#e2e8f0' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  loadingText: { marginTop: 10, color: '#475569', fontSize: 13 },
  errorCard: { borderWidth: 1, borderColor: '#fecaca' },
  errorText: { color: '#dc2626', fontSize: 13 },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  jobCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statusColumn: { alignItems: 'flex-end', gap: 6 },
  jobTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  jobLocation: { fontSize: 13, color: '#64748b', marginTop: 4 },
  categoryTag: {
    marginTop: 6,
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '700',
    alignSelf: 'flex-start',
  },
  urgentTag: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  urgentText: { color: '#b91c1c', fontSize: 11, fontWeight: '700' },
  statusTag: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: { color: '#15803d', fontSize: 11, fontWeight: '700' },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  jobType: { color: '#2563eb', fontWeight: '700', fontSize: 12 },
  salary: { color: '#16a34a', fontWeight: '700', fontSize: 12 },
  footerRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: { color: '#64748b', fontSize: 12 },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editButton: {
    backgroundColor: '#0a2847',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  editButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
});
