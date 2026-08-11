import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import EmployerNavigation from '../../components/employerNavigation';
import ScrollView from '../../components/ui/SmoothScrollView';
import TabTopNav from '../../components/TabTopNav';
import { apiRequest, asList } from '../../lib/api';
import { APPLICATION_STATUSES, ApplicationStatus, normalizeApplicationStatus } from '../../lib/status';
import PublicProfile from '../shared/PublicProfile';
import { tokens } from '../../theme/tokens';
import RatingModal, { MobileRatingTarget } from '../../components/reviews/RatingModal';
import { useToast } from '../../contexts/ToastContext';
import { useAppSession } from '../../contexts/AppSessionContext';

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
    rating?: { averageRating?: number; totalReviews?: number };
  };
  match?: { percentage?: number; level?: string; reasons?: string[] };
  coverLetter?: string;
  resume?: string;
  nextInterview?: {
    _id?: string;
    scheduledAt: string;
    location?: string | null;
    mode?: string;
    notes?: string | null;
  } | null;
};

type ReviewEligibility = {
  applicationId: string;
  canReview: boolean;
  existingReview?: { rating?: number } | null;
};

type EmployerApplicationsProps = {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  onMessageWorker?: (payload: { workerId: string; workerName?: string; jobId: string }) => void;
};

const STATUS_OPTIONS: ApplicationStatus[] = APPLICATION_STATUSES.filter((status) => status !== 'Withdrawn');

const getApiStatusCandidates = (status: ApplicationStatus): string[] => {
  switch (status) {
    case 'Applied':
      return ['Applied', 'Pending'];
    case 'Shortlisted':
      return ['Shortlisted', 'Reviewed'];
    case 'Interview Scheduled':
      return ['Interview Scheduled', 'Interviewed', 'Terms'];
    case 'Interviewed':
      return ['Interviewed', 'Interview Scheduled', 'Terms'];
    case 'Offer Sent':
      return ['Offer Sent', 'Terms'];
    case 'Hired':
      return ['Hired', 'Accepted'];
    default:
      return [status];
  }
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
  const toast = useToast();
  const session = useAppSession();
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
  const [reviewEligibility, setReviewEligibility] = useState<Record<string, ReviewEligibility>>({});
  const [ratingTarget, setRatingTarget] = useState<MobileRatingTarget | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<ApplicationItem | null>(null);
  const [interviewDate, setInterviewDate] = useState<Date | null>(null);
  const [interviewMode, setInterviewMode] = useState('virtual');
  const [interviewLocation, setInterviewLocation] = useState('');
  const [interviewNotes, setInterviewNotes] = useState('');
  const [showInterviewDatePicker, setShowInterviewDatePicker] = useState(false);
  const [showInterviewTimePicker, setShowInterviewTimePicker] = useState(false);
  const [savingInterview, setSavingInterview] = useState(false);

  const jobOptions = useMemo(() => {
    const unique = new Map<string, string>();
    applications.forEach((app) => {
      if (app.job?._id) unique.set(app.job._id, app.job.title);
    });
    return Array.from(unique.entries()).map(([id, title]) => ({ id, title }));
  }, [applications]);

  const fetchApplications = useCallback(async () => {
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

      if (!result.ok && (result.message || '').includes('Invalid status') && apiStatusFilter) {
        const fallbackStatuses = getApiStatusCandidates(statusFilter as ApplicationStatus).slice(1);
        let fallbackResult = result;
        for (const fallbackStatus of fallbackStatuses) {
          params.set('status', fallbackStatus);
          fallbackResult = await apiRequest(buildUrl(), {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }, 'Failed to load applications.');
          if (fallbackResult.ok) {
            result = fallbackResult;
            break;
          }
        }
      }

      if (!result.ok) {
        throw new Error(result.message || 'Failed to load applications.');
      }
      const mapped = asList<any>(result.raw, ['applications']).map((item) => ({
        ...item,
        status: normalizeApplicationStatus(item?.status),
      }));
      setApplications(mapped as ApplicationItem[]);
      const eligibilityResult = await apiRequest(`${API_URL}/reviews/eligible`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }, 'Failed to load review eligibility.');
      const eligibilityPayload: any = eligibilityResult.data || eligibilityResult.raw || {};
      const employerItems: ReviewEligibility[] = Array.isArray(eligibilityPayload?.asEmployer) ? eligibilityPayload.asEmployer : [];
      setReviewEligibility(Object.fromEntries(employerItems.map((item) => [item.applicationId, item])));
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to load applications.');
    } finally {
      setLoading(false);
    }
  }, [jobFilter, search, statusFilter]);

  useEffect(() => {
    const debounce = setTimeout(fetchApplications, 300);
    return () => clearTimeout(debounce);
  }, [statusFilter, jobFilter, search, fetchApplications]);

  const latestApplicationNotification = useMemo(() => {
    const match = session.employerNotifications
      .map((raw) => raw?.notification || raw)
      .find((item) => String(item?.type || '').toLowerCase() === 'application');
    return String(match?._id || match?.id || match?.updatedAt || '');
  }, [session.employerNotifications]);

  useEffect(() => {
    if (latestApplicationNotification) void fetchApplications();
  }, [fetchApplications, latestApplicationNotification]);

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

  const handleOpenSchedule = (application: ApplicationItem) => {
    const existingDate = application.nextInterview?.scheduledAt
      ? new Date(application.nextInterview.scheduledAt)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    setScheduleTarget(application);
    setInterviewDate(Number.isNaN(existingDate.getTime()) ? new Date() : existingDate);
    setInterviewMode(application.nextInterview?.mode || 'virtual');
    setInterviewLocation(application.nextInterview?.location || '');
    setInterviewNotes(application.nextInterview?.notes || '');
  };

  const handleInterviewDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowInterviewDatePicker(false);
    if (event.type === 'dismissed' || !selected) return;
    setInterviewDate((current) => {
      const next = new Date(current || selected);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      return next;
    });
  };

  const handleInterviewTimeChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowInterviewTimePicker(false);
    if (event.type === 'dismissed' || !selected) return;
    setInterviewDate((current) => {
      const next = new Date(current || selected);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      return next;
    });
  };

  const handleScheduleSubmit = async () => {
    if (!scheduleTarget || !interviewDate || savingInterview) return;
    if (interviewDate.getTime() <= Date.now()) {
      toast.error('Choose an interview time in the future.');
      return;
    }

    setSavingInterview(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const existingInterviewId = scheduleTarget.nextInterview?._id;
      const result = await apiRequest(
        existingInterviewId
          ? `${API_URL}/applications/${scheduleTarget._id}/interviews/${existingInterviewId}`
          : `${API_URL}/applications/${scheduleTarget._id}/interviews`,
        {
          method: existingInterviewId ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            scheduledAt: interviewDate.toISOString(),
            mode: interviewMode,
            location: interviewLocation.trim(),
            notes: interviewNotes.trim(),
          }),
        },
        'Failed to save interview schedule.',
      );
      if (!result.ok) throw new Error(result.message || 'Failed to save interview schedule.');
      setScheduleTarget(null);
      await fetchApplications();
      toast.success(existingInterviewId ? 'Interview rescheduled.' : 'Interview scheduled. The worker was notified.');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to save interview schedule.');
    } finally {
      setSavingInterview(false);
    }
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
            <ActivityIndicator color="#1C4D8D" />
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
            <View style={styles.insightRow}>
              <View style={styles.matchPill}>
                <Text style={styles.matchText}>{Number(app.match?.percentage || 0)}% Match</Text>
              </View>
              <View style={styles.ratingPill}>
                <Ionicons name="star" size={13} color="#F59E0B" />
                <Text style={styles.ratingText}>{Number(app.applicant?.rating?.averageRating || 0).toFixed(1)} ({app.applicant?.rating?.totalReviews || 0})</Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : ''}
              </Text>
              <View style={styles.metaActions}>
                <TouchableOpacity style={styles.textAction} onPress={() => handleViewProfile(app.applicant._id)} accessibilityRole="button">
                  <Text style={styles.linkText}>View Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.textAction} onPress={() => handleRemoveApplication(app._id)} accessibilityRole="button">
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
                {onMessageWorker ? (
                  <TouchableOpacity
                    style={styles.textAction}
                    onPress={() =>
                      onMessageWorker({
                        workerId: app.applicant._id,
                        workerName: `${app.applicant?.firstName || ''} ${app.applicant?.lastName || ''}`.trim(),
                        jobId: app.job._id,
                      })
                    }
                  >
                    <Text style={styles.linkText}>Message</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {app.nextInterview ? (
              <View style={styles.interviewSummary}>
                <Ionicons name="calendar-outline" size={17} color={tokens.colors.brand} />
                <View style={styles.interviewSummaryCopy}>
                  <Text style={styles.interviewSummaryTitle}>Next interview</Text>
                  <Text style={styles.interviewSummaryText}>{new Date(app.nextInterview.scheduledAt).toLocaleString()}</Text>
                  <Text style={styles.interviewSummaryMeta}>
                    {app.nextInterview.mode || 'other'}{app.nextInterview.location ? ` · ${app.nextInterview.location}` : ''}
                  </Text>
                </View>
              </View>
            ) : null}

            {!['Hired', 'Rejected', 'Withdrawn'].includes(app.status) ? (
              <TouchableOpacity style={styles.interviewButton} onPress={() => handleOpenSchedule(app)}>
                <Ionicons name="calendar-outline" size={16} color={tokens.colors.brand} />
                <Text style={styles.interviewButtonText}>{app.nextInterview ? 'Reschedule Interview' : 'Schedule Interview'}</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusButton,
                    app.status === status && styles.statusButtonActive,
                  ]}
                  onPress={() => handleStatusChange(app._id, status)}
                  disabled={updatingId === app._id || app.status === status}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: updatingId === app._id || app.status === status, busy: updatingId === app._id }}
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

            {reviewEligibility[app._id]?.canReview ? (
              <TouchableOpacity
                style={styles.rateButton}
                onPress={() => setRatingTarget({
                  applicationId: app._id,
                  name: `${app.applicant?.firstName || ''} ${app.applicant?.lastName || ''}`.trim() || 'Worker',
                  jobTitle: app.job?.title || 'Completed job',
                  roleLabel: 'worker',
                })}
              >
                <Ionicons name="star" size={17} color="#92400E" />
                <Text style={styles.rateButtonText}>Rate Worker</Text>
              </TouchableOpacity>
            ) : reviewEligibility[app._id]?.existingReview ? (
              <Text style={styles.reviewedText}>★ Review submitted</Text>
            ) : null}

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
      <RatingModal target={ratingTarget} onClose={() => setRatingTarget(null)} onSubmitted={fetchApplications} />

      <Modal
        visible={Boolean(scheduleTarget)}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!savingInterview) setScheduleTarget(null); }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.scheduleCard}>
            <View style={styles.scheduleHeader}>
              <View style={styles.scheduleHeaderCopy}>
                <Text style={styles.scheduleEyebrow}>INTERVIEW</Text>
                <Text style={styles.scheduleTitle}>{scheduleTarget?.nextInterview ? 'Reschedule interview' : 'Schedule interview'}</Text>
                <Text style={styles.scheduleSubtitle}>
                  {scheduleTarget?.applicant?.firstName} {scheduleTarget?.applicant?.lastName} · {scheduleTarget?.job?.title}
                </Text>
              </View>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setScheduleTarget(null)} disabled={savingInterview}>
                <Ionicons name="close" size={21} color={tokens.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scheduleContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.scheduleLabel}>Date and time</Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowInterviewDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={17} color={tokens.colors.brand} />
                  <Text style={styles.dateTimeText}>{interviewDate?.toLocaleDateString() || 'Choose date'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowInterviewTimePicker(true)}>
                  <Ionicons name="time-outline" size={17} color={tokens.colors.brand} />
                  <Text style={styles.dateTimeText}>{interviewDate?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Choose time'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.scheduleLabel}>Interview mode</Text>
              <View style={styles.modeRow}>
                {['virtual', 'phone', 'in-person', 'other'].map((mode) => (
                  <TouchableOpacity key={mode} style={[styles.modeChip, interviewMode === mode && styles.modeChipActive]} onPress={() => setInterviewMode(mode)}>
                    <Text style={[styles.modeChipText, interviewMode === mode && styles.modeChipTextActive]}>{mode}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.scheduleLabel}>Location or meeting link</Text>
              <TextInput
                style={styles.scheduleInput}
                value={interviewLocation}
                onChangeText={setInterviewLocation}
                placeholder="Google Meet link, office address, or call instructions"
                placeholderTextColor={tokens.colors.textSubtle}
              />

              <Text style={styles.scheduleLabel}>Notes</Text>
              <TextInput
                style={[styles.scheduleInput, styles.scheduleTextArea]}
                value={interviewNotes}
                onChangeText={setInterviewNotes}
                multiline
                placeholder="Preparation details or interviewer names"
                placeholderTextColor={tokens.colors.textSubtle}
              />
            </ScrollView>

            <View style={styles.scheduleActions}>
              <TouchableOpacity style={styles.scheduleCancelButton} onPress={() => setScheduleTarget(null)} disabled={savingInterview}>
                <Text style={styles.scheduleCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.scheduleSaveButton, savingInterview && styles.disabledButton]} onPress={handleScheduleSubmit} disabled={savingInterview}>
                {savingInterview
                  ? <ActivityIndicator color={tokens.colors.surface} />
                  : <Text style={styles.scheduleSaveText}>{scheduleTarget?.nextInterview ? 'Update Interview' : 'Schedule Interview'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showInterviewDatePicker && interviewDate ? (
        <DateTimePicker value={interviewDate} mode="date" minimumDate={new Date()} onChange={handleInterviewDateChange} />
      ) : null}
      {showInterviewTimePicker && interviewDate ? (
        <DateTimePicker value={interviewDate} mode="time" onChange={handleInterviewTimeChange} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  scroll: { padding: 20, paddingBottom: 112 },
  filterCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 52,
    paddingVertical: 10,
    fontSize: 13,
    color: tokens.colors.text,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  filterChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    minHeight: 44,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: tokens.colors.brand,
    borderColor: tokens.colors.brand,
  },
  filterChipText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  filterChipTextActive: { color: tokens.colors.surface },
  jobsScroll: { marginTop: 12 },
  jobChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    minHeight: 44,
    paddingVertical: 8,
    justifyContent: 'center',
    marginRight: 8,
    maxWidth: 180,
  },
  jobChipActive: { backgroundColor: '#e0f2fe', borderColor: '#38bdf8' },
  jobChipText: { fontSize: 11, color: '#475569' },
  jobChipTextActive: { color: '#0284c7', fontWeight: '700' },
  card: {
    backgroundColor: tokens.colors.surface,
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
    backgroundColor: tokens.colors.surface,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: '#6b7280' },
  appHeader: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
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
  appName: { fontSize: 15, fontWeight: '700', color: tokens.colors.text },
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
  insightRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 12 },
  matchPill: { borderRadius: 999, backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 6 },
  matchText: { color: '#047857', fontSize: 11, fontWeight: '800' },
  ratingPill: { borderRadius: 999, backgroundColor: '#FFFBEB', paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: '#92400E', fontSize: 11, fontWeight: '700' },
  rateButton: { minHeight: 46, marginTop: 12, borderRadius: 12, backgroundColor: '#FEF3C7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  rateButtonText: { color: '#92400E', fontSize: 13, fontWeight: '800' },
  reviewedText: { marginTop: 12, textAlign: 'center', color: '#047857', fontSize: 12, fontWeight: '700' },
  coverLetter: { fontSize: 12, color: '#4b5563', marginTop: 12, lineHeight: 18 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 8, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: '#6b7280' },
  metaActions: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  textAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  linkText: { fontSize: 12, color: '#1C4D8D', fontWeight: '600' },
  removeText: { fontSize: 12, color: '#b91c1c', fontWeight: '700' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  statusButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    minHeight: 44,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  statusButtonActive: { backgroundColor: tokens.colors.brand, borderColor: tokens.colors.brand },
  statusButtonText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  statusButtonTextActive: { color: tokens.colors.surface },
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
    backgroundColor: tokens.colors.surface,
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
    color: '#1C4D8D',
  },
  workerStatLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  interviewSummary: { marginTop: 12, flexDirection: 'row', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', padding: 12 },
  interviewSummaryCopy: { flex: 1 },
  interviewSummaryTitle: { color: tokens.colors.brand, fontSize: 12, fontWeight: '800' },
  interviewSummaryText: { marginTop: 3, color: tokens.colors.text, fontSize: 13, fontWeight: '700' },
  interviewSummaryMeta: { marginTop: 2, color: tokens.colors.textMuted, fontSize: 12, textTransform: 'capitalize' },
  interviewButton: { marginTop: 12, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  interviewButtonText: { color: tokens.colors.brand, fontSize: 13, fontWeight: '800' },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.55)', padding: 20 },
  scheduleCard: { width: '100%', maxWidth: 520, maxHeight: '90%', borderRadius: 22, backgroundColor: tokens.colors.surface, overflow: 'hidden' },
  scheduleHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 18, borderBottomWidth: 1, borderBottomColor: tokens.colors.border },
  scheduleHeaderCopy: { flex: 1, paddingRight: 12 },
  scheduleEyebrow: { color: tokens.colors.brand, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  scheduleTitle: { marginTop: 4, color: tokens.colors.text, fontSize: 20, fontWeight: '800' },
  scheduleSubtitle: { marginTop: 5, color: tokens.colors.textMuted, fontSize: 12, lineHeight: 18 },
  modalCloseButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.surfaceMuted },
  scheduleContent: { padding: 18 },
  scheduleLabel: { marginTop: 14, marginBottom: 7, color: tokens.colors.text, fontSize: 13, fontWeight: '800' },
  dateTimeRow: { flexDirection: 'row', gap: 10 },
  dateTimeButton: { flex: 1, minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  dateTimeText: { color: tokens.colors.text, fontSize: 12, fontWeight: '700' },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeChip: { minHeight: 42, borderRadius: 999, borderWidth: 1, borderColor: tokens.colors.border, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  modeChipActive: { borderColor: tokens.colors.brand, backgroundColor: tokens.colors.brand },
  modeChipText: { color: tokens.colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  modeChipTextActive: { color: tokens.colors.surface },
  scheduleInput: { minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.border, paddingHorizontal: 13, paddingVertical: 11, color: tokens.colors.text, fontSize: 13 },
  scheduleTextArea: { minHeight: 90, textAlignVertical: 'top' },
  scheduleActions: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: tokens.colors.border },
  scheduleCancelButton: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.border, alignItems: 'center', justifyContent: 'center' },
  scheduleCancelText: { color: tokens.colors.text, fontSize: 13, fontWeight: '700' },
  scheduleSaveButton: { flex: 1.4, minHeight: 48, borderRadius: 12, backgroundColor: tokens.colors.brand, alignItems: 'center', justifyContent: 'center' },
  scheduleSaveText: { color: tokens.colors.surface, fontSize: 13, fontWeight: '800' },
  disabledButton: { opacity: 0.6 },
});
