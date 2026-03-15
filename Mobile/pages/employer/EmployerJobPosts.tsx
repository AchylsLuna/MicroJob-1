import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';
import EmployerNavigation from '../../components/employerNavigation';
import TabTopNav from '../../components/TabTopNav';
import { useToast } from '../../contexts/ToastContext';
import { apiRequest, asList } from '../../lib/api';

type JobItem = {
  _id: string;
  title: string;
  location: string;
  salary: string;
  jobType: string;
  status?: string;
  urgent?: boolean;
  applicants?: string[];
  positionsNeeded?: number;
  hiredCount?: number;
  category?: { name: string };
  createdAt?: string;
};

type EmployerJobPostsProps = {
  onEditJob?: (job: JobItem) => void;
  activeTab?: string;
  onTabPress?: (tab: string) => void;
};

export default function EmployerJobPosts({
  onEditJob,
  activeTab,
  onTabPress,
}: EmployerJobPostsProps) {
  const toast = useToast();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingDoneJobId, setMarkingDoneJobId] = useState<string | null>(null);
  const [confirmDoneJob, setConfirmDoneJob] = useState<JobItem | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const totalApplicants = jobs.reduce((sum, job) => sum + (job.applicants?.length || 0), 0);

  const fetchJobs = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest<JobItem[]>(`${API_URL}/jobs/mine`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }, 'Failed to load job posts.');
      if (!result.ok) throw new Error(result.message || 'Failed to load job posts.');
      setJobs(asList<JobItem>(result.raw, ['jobs']));
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to load job posts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleRequestMarkDone = (job: JobItem) => {
    if (String(job.status || 'Available') === 'Completed') {
      return;
    }
    setConfirmDoneJob(job);
  };

  const handleConfirmMarkDone = async () => {
    if (!confirmDoneJob) return;

    setMarkingDoneJobId(confirmDoneJob._id);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/jobs/${confirmDoneJob._id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: 'Completed' }),
      }, 'Failed to mark job as done.');

      if (!result.ok) throw new Error(result.message || 'Failed to mark job as done.');

      setConfirmDoneJob(null);
      await fetchJobs();
      toast.success('Job marked as done. Worker payouts were triggered automatically from escrow.');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to mark job as done.');
    } finally {
      setMarkingDoneJobId(null);
    }
  };

  return (
    <View style={styles.container}>
      <TabTopNav title="Home" />

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
              <Text style={styles.footerText}>
                Positions: {job.hiredCount || 0}/{job.positionsNeeded || 1}
              </Text>
              <View style={styles.footerActions}>
                <Text style={styles.footerText}>
                  {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : ''}
                </Text>
                <TouchableOpacity
                  style={[styles.doneButton, String(job.status || 'Available') === 'Completed' && styles.doneButtonDisabled]}
                  disabled={String(job.status || 'Available') === 'Completed' || markingDoneJobId === job._id}
                  onPress={() => handleRequestMarkDone(job)}
                >
                  {markingDoneJobId === job._id ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.doneButtonText}>Mark Done</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => onEditJob?.(job)}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.autoPayHint}>
              Marking this job done automatically releases escrow to hired workers.
            </Text>

            {/* Applicants List (count only, no message button due to type) */}
            {/* If you want to show applicant details, update the backend to return applicant objects, not just string IDs */}
          </View>
        ))}
      </ScrollView>

      <Modal
        visible={Boolean(confirmDoneJob)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!markingDoneJobId) setConfirmDoneJob(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Mark Job as Done</Text>
            <Text style={styles.modalText}>
              {confirmDoneJob?.title ? `Complete "${confirmDoneJob.title}"?` : 'Complete this job?'}
            </Text>
            <Text style={styles.modalInfo}>
              Once completed, escrow funds are automatically paid to hired workers' e-wallets.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setConfirmDoneJob(null)}
                disabled={Boolean(markingDoneJobId)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmMarkDone}
                disabled={Boolean(markingDoneJobId)}
              >
                {markingDoneJobId ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm Done</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <EmployerNavigation
        activeTab={activeTab}
        onTabPress={onTabPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },
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
  doneButton: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  doneButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  doneButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  editButton: {
    backgroundColor: '#0a2847',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  editButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  autoPayHint: {
    marginTop: 10,
    fontSize: 11,
    color: '#475569',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalText: {
    marginTop: 10,
    fontSize: 14,
    color: '#334155',
  },
  modalInfo: {
    marginTop: 10,
    fontSize: 13,
    color: '#1d4ed8',
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modalActions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modalCancelText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  modalConfirmBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 110,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
