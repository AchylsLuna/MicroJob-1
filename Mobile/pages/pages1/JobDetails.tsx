import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Navigation from '../../components/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';
import { apiRequest, asObject } from '../../lib/api';
import PublicProfile from '../shared/PublicProfile';
import { useToast } from '../../contexts/ToastContext';

type EmployerPreview = {
  profile?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    city?: string;
    province?: string;
  };
  rating?: {
    stars?: number;
    percentage?: number;
  };
};

type JobDetailsProps = {
  onBack?: () => void;
  job: any;
  onSaveJob?: (job: any) => void;
  onMessageEmployer?: (payload: { userId?: string; userName?: string; jobId?: string }) => void;
  isSaved?: boolean;
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  messageBadgeCount?: number;
};

export default function JobDetails({
  job,
  onSaveJob,
  onMessageEmployer,
  isSaved = false,
  activeTab = 'Jobs',
  onTabPress,
  messageBadgeCount = 0,
}: JobDetailsProps) {
  const insets = useSafeAreaInsets();
  const [saved, setSaved] = useState(isSaved);
  const [showSuccess, setShowSuccess] = useState(false);
  const [jobDetails, setJobDetails] = useState(job);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasApplied, setHasApplied] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [employerPreview, setEmployerPreview] = useState<EmployerPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const toast = useToast();

  const getCurrentUserId = async () => {
    const raw = await AsyncStorage.getItem('auth_user');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return String(parsed?.id || parsed?._id || parsed?.userId || '').trim();
  };

  const resolveApplicantId = (value: any) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return String(value?._id || value?.id || value?.userId || '').trim();
  };

  const handleTabPress = (tab: string) => {
    onTabPress?.(tab);
  };

  const handleSave = () => {
    setSaved(!saved);
    onSaveJob?.(job);
  };

  const handleApply = () => {
    applyForJob();
  };

  const resolveEmployerId = (source: any): string => {
    if (!source) return '';

    const poster = source?.jobPoster || source?.employer || source?.postedBy;

    if (typeof poster === 'string') return poster.trim();
    if (poster && typeof poster === 'object') {
      const nestedId = poster._id || poster.id || poster.userId || poster.user?._id || poster.user?.id;
      if (nestedId) return String(nestedId).trim();
    }

    const directId = source?.jobPosterId || source?.employerId || source?.postedById;
    return directId ? String(directId).trim() : '';
  };

  const fetchEmployerPreview = async (employerId: string) => {
    if (!employerId) {
      setEmployerPreview(null);
      return;
    }

    setPreviewLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/auth/profiles/${employerId}?viewAs=employer`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }, 'Failed to load employer profile.');

      if (!result.ok) {
        throw new Error(result.message || 'Failed to load employer profile.');
      }

      const payload = asObject<EmployerPreview>(result.data) || asObject<EmployerPreview>(result.raw);
      setEmployerPreview(payload?.profile ? payload : null);
    } catch (error) {
      setEmployerPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleViewEmployerProfile = () => {
    const employerId = resolveEmployerId(jobDetails) || resolveEmployerId(job);
    
    if (!employerId) {
      toast.error('Employer information not available.');
      return;
    }
    
    setProfileUserId(employerId);
    setShowProfile(true);
  };

  const handleMessageEmployer = async () => {
    const recipientCandidate = jobDetails?.jobPoster || job?.jobPoster;
    const recipientId =
      typeof recipientCandidate === 'string'
        ? recipientCandidate
        : recipientCandidate && (recipientCandidate._id || recipientCandidate.id || recipientCandidate.email);

    const recipientName =
      typeof recipientCandidate === 'string'
        ? 'Employer'
        : `${recipientCandidate?.firstName || ''} ${recipientCandidate?.lastName || ''}`.trim() || 'Employer';

    if (!recipientId) {
      toast.error('Employer details are not available for this job yet.');
      return;
    }

    const defaultMessage = `Hi ${recipientName}, I'm interested in your job "${jobDetails?.title || job?.title || 'this job'}".`;

    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        await apiRequest(
          `${API_URL}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ receiverId: recipientId, content: defaultMessage, jobId: jobDetails?._id || job?._id }),
          },
          'Failed to send message.'
        );
      }
    } catch (error) {
      console.warn('Initial message send failed', error);
    } finally {
      onMessageEmployer?.({
        userId: recipientId,
        userName: recipientName,
        jobId: jobDetails?._id || job?._id,
      });
    }
  };

  const handleFindMoreJobs = () => {
    setShowSuccess(false);
    onTabPress?.('Jobs');
  };

  const handleBackToHome = () => {
    setShowSuccess(false);
    onTabPress?.('Home');
  };

  const applyForJob = async () => {
    if (!jobDetails?._id) return;
    if (hasApplied) return;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/jobs/${jobDetails._id}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to apply.');
      }
      setHasApplied(true);
      setShowSuccess(true);
    } catch (error: any) {
      const message = error?.message || 'Failed to apply.';
      if (/already applied/i.test(message)) {
        setHasApplied(true);
      }
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDetails = async () => {
    if (!job?._id) return;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(`${API_URL}/jobs/${job._id}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to load job.');
      }
      setJobDetails(data);

      const userId = await getCurrentUserId();
      if (userId) {
        const applicants = Array.isArray(data?.applicants) ? data.applicants : [];
        const alreadyApplied = applicants.some((applicant: any) => resolveApplicantId(applicant) === userId);
        setHasApplied(alreadyApplied);
      } else {
        setHasApplied(false);
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to load job.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [job?._id]);

  useEffect(() => {
    const employerId = resolveEmployerId(jobDetails) || resolveEmployerId(job);
    fetchEmployerPreview(employerId);
  }, [jobDetails?._id, jobDetails?.jobPoster, job?._id]);

  if (showProfile && profileUserId) {
    return (
      <PublicProfile
        userId={profileUserId}
        viewAs="employer"
        onBack={() => {
          setShowProfile(false);
          setProfileUserId(null);
        }}
      />
    );
  }

  if (showSuccess) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f5f7fa' }}>
        <View style={styles.successContainer}>
          <View style={styles.successContent}>
            <View style={styles.successIcon}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Successful!</Text>
            <Text style={styles.successMessage}>
              Congratulations, your application has been sent. Good luck!
            </Text>
            <TouchableOpacity style={styles.findJobsBtn} onPress={handleFindMoreJobs} accessibilityRole="button" accessibilityLabel="Find more jobs">
              <Text style={styles.findJobsBtnText}>Find more jobs</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBackToHome} accessibilityRole="button" accessibilityLabel="Back to home">
              <Text style={styles.backToHomeText}>Back to home</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Navigation activeTab={activeTab} onTabPress={handleTabPress} messageBadgeCount={messageBadgeCount} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(insets.top, 20) + 24,
            paddingBottom: 108 + Math.max(insets.bottom, 10),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Container with Light Blue Background */}
        <View style={styles.headerContainer}>
          {/* Job Title */}
          <Text style={styles.jobTitle}>{jobDetails?.title || 'Job Details'}</Text>
          <Text style={styles.jobMeta}>{jobDetails?.jobType || ''} {jobDetails?.location ? `• ${jobDetails.location}` : ''}</Text>
          {jobDetails?.urgent ? (
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentText}>Urgent</Text>
            </View>
          ) : null}

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#eef0f1" />
            </View>
          ) : null}

          {/* Stats */}
          <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>📍</Text>
            <Text style={styles.statLabel}>LOCATION</Text>
            <Text style={styles.statValue}>{jobDetails?.location || 'N/A'}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>⏰</Text>
            <Text style={styles.statLabel}>TYPE</Text>
            <Text style={styles.statValue}>{jobDetails?.jobType || 'N/A'}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>💰</Text>
            <Text style={styles.statLabel}>SALARY</Text>
            <Text style={styles.statValue}>{jobDetails?.salary || 'N/A'}</Text>
          </View>
        </View>
        </View>

        {/* Posted Info */}
        <View style={styles.postedInfoContainer}>
          <Text style={styles.postedInfo}>
            This job post is managed by{' '}
            <Text style={styles.highlight}>
              {jobDetails?.jobPoster?.firstName ? `${jobDetails.jobPoster.firstName} ${jobDetails.jobPoster.lastName || ''}`.trim() : 'the employer'}
            </Text>
          </Text>

          {previewLoading ? (
            <ActivityIndicator size="small" color="#64748b" style={styles.previewLoader} />
          ) : employerPreview?.profile ? (
            <View style={styles.previewCard}>
              <Text style={styles.previewName}>
                {`${employerPreview.profile.firstName || ''} ${employerPreview.profile.lastName || ''}`.trim() || employerPreview.profile.companyName || 'Employer'}
              </Text>
              {employerPreview.profile.companyName ? (
                <Text style={styles.previewCompany}>{employerPreview.profile.companyName}</Text>
              ) : null}
              <Text style={styles.previewMeta}>
                Rating {Number(employerPreview.rating?.stars || 0).toFixed(1)}/5 • {Number(employerPreview.rating?.percentage || 0)}% success
              </Text>
              {(employerPreview.profile.city || employerPreview.profile.province) ? (
                <Text style={styles.previewMeta}>
                  {[employerPreview.profile.city, employerPreview.profile.province].filter(Boolean).join(', ')}
                </Text>
              ) : null}
            </View>
          ) : null}

          <TouchableOpacity onPress={handleViewEmployerProfile} style={styles.viewProfileBtn} accessibilityRole="button" accessibilityLabel="View employer profile">
            <Text style={styles.viewProfileText}>View Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Skills */}
        <Text style={styles.sectionTitle}>Must have skills</Text>
        <View style={styles.skillsGrid}>
          {(jobDetails?.skills || []).map((skill: string, index: number) => (
            <View key={index} style={styles.skillTag}>
              <Text style={styles.skillText}>{skill}</Text>
            </View>
          ))}
        </View>

        {/* Description */}
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>
          {jobDetails?.description || 'No description provided.'}
        </Text>

        {/* Requirements */}
        {jobDetails?.requirements?.length ? (
          <>
            <Text style={styles.sectionTitle}>Requirements</Text>
            <View style={styles.requirementsList}>
              {jobDetails.requirements.map((req: string, index: number) => (
                <Text key={index} style={styles.requirementItem}>• {req}</Text>
              ))}
            </View>
          </>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.saveBtn, saved && styles.savedBtn]} 
            onPress={handleSave}
            accessibilityRole="button"
            accessibilityLabel={saved ? "Remove job from saved jobs" : "Save job"}
            accessibilityState={{ selected: saved }}
          >
            <Text style={[styles.actionBtnText, styles.saveBtnText, saved && styles.savedBtnText]}>
              {saved ? 'Saved ✓' : 'Saved job'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.applyBtn, hasApplied && styles.appliedBtn]}
            onPress={handleApply}
            disabled={isLoading || hasApplied}
            accessibilityRole="button"
            accessibilityLabel={hasApplied ? "Application already submitted" : "Apply for this job"}
            accessibilityState={{ disabled: isLoading || hasApplied }}
          >
            <Text style={styles.actionBtnText}>
              {hasApplied ? 'Already submitted' : isLoading ? 'Applying...' : 'Apply now'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.actionBtn, styles.messageBtn]} onPress={handleMessageEmployer} accessibilityRole="button" accessibilityLabel="Message employer">
          <Text style={[styles.actionBtnText, styles.messageBtnText]}>Message Employer</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom nav */}
      <Navigation activeTab={activeTab} onTabPress={handleTabPress} messageBadgeCount={messageBadgeCount} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingHorizontal: 20 },
  headerContainer: {
    backgroundColor: '#c8d4d8',
    borderRadius: 12,
    padding: 10,
    marginBottom: 24,
  },
  jobTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  jobMeta: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 10,
  },
  urgentBadge: {
    alignSelf: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  urgentText: { color: '#b91c1c', fontSize: 12, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: { fontSize: 20, marginBottom: 8 },
  statLabel: { fontSize: 10, color: '#6b7280', marginBottom: 4, fontWeight: '600' },
  statValue: { fontSize: 12, color: '#1f2937', fontWeight: '700', textAlign: 'center' },
  postedInfoContainer: {
    marginBottom: 24,
  },
  postedInfo: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
    marginBottom: 8,
  },
  highlight: { fontWeight: '700', color: '#1f2937' },
  viewProfileBtn: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  previewLoader: {
    marginBottom: 10,
  },
  previewCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  previewName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  previewCompany: {
    marginTop: 2,
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  previewMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748B',
  },
  viewProfileText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
    marginTop: 8,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  skillTag: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  skillText: { fontSize: 13, color: '#1f2937', fontWeight: '600' },
  description: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 22,
    marginBottom: 24,
  },
  loadingRow: {
    paddingVertical: 8,
  },
  errorText: {
    marginTop: 8,
    color: '#fca5a5',
    fontSize: 12,
    textAlign: 'center',
  },
  requirementsList: {
    marginBottom: 24,
  },
  requirementItem: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#1f2937',
  },
  savedBtn: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  applyBtn: {
    backgroundColor: '#4a90e2',
  },
  appliedBtn: {
    backgroundColor: '#94a3b8',
  },
  messageBtn: {
    marginTop: 10,
    backgroundColor: '#0ea5a6',
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  saveBtnText: {
    color: '#1f2937',
  },
  savedBtnText: {
    color: '#fff',
  },
  messageBtnText: {
    color: '#fff',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
    backgroundColor: '#f5f7fa',
  },
  successContent: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  checkmark: {
    fontSize: 48,
    color: '#fff',
    fontWeight: '700',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 40,
  },
  findJobsBtn: {
    width: '100%',
    backgroundColor: '#4a90e2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  findJobsBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  backToHomeText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
});
