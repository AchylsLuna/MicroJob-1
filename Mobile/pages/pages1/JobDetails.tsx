import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Navigation from '../../components/navigation';
import ScrollView from '../../components/ui/SmoothScrollView';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import { apiRequest, asObject } from '../../lib/api';
import PublicProfile from '../shared/PublicProfile';
import { useToast } from '../../contexts/ToastContext';
import { tokens } from '../../theme/tokens';
import { formatMinimumPay } from '../../lib/jobCompensation';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('worker');

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

  const fetchEmployerPreview = useCallback(async (employerId: string) => {
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
      }, t('jobDetails.apiFallback.loadEmployerProfileFailed'));

      if (!result.ok) {
        throw new Error(result.message || t('jobDetails.apiFallback.loadEmployerProfileFailed'));
      }

      const payload = asObject<EmployerPreview>(result.data) || asObject<EmployerPreview>(result.raw);
      setEmployerPreview(payload?.profile ? payload : null);
    } catch (error) {
      setEmployerPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [t]);

  const handleViewEmployerProfile = () => {
    const employerId = resolveEmployerId(jobDetails) || resolveEmployerId(job);

    if (!employerId) {
      toast.error(t('jobDetails.toast.employerInfoUnavailable'));
      return;
    }

    setProfileUserId(employerId);
    setShowProfile(true);
  };

  const handleMessageEmployer = async () => {
    const targetJobId = jobDetails?._id || job?._id;
    if (!targetJobId) {
      toast.error(t('jobDetails.toast.jobDetailsUnavailable'));
      return;
    }

    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        toast.error(t('jobDetails.toast.signInRequired'));
        return;
      }

      // Ask the server to resolve the job poster so the inquiry opens a worker <->
      // employer thread tied to this job instead of the Admin/Support channel.
      const result = await apiRequest(
        `${API_URL}/messages/inquiries/${targetJobId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sendInitialMessage: false }),
        },
        t('jobDetails.apiFallback.openConversationFailed')
      );

      if (!result.ok) {
        throw new Error(result.message || t('jobDetails.apiFallback.openConversationFailed'));
      }

      const payload = asObject<any>(result.data) || asObject<any>(result.raw) || {};
      const conversation = payload.conversation || payload;
      const recipientId = conversation?.otherUserId;
      if (!recipientId) {
        toast.error(t('jobDetails.toast.employerDetailsUnavailable'));
        return;
      }

      onMessageEmployer?.({
        userId: String(recipientId),
        userName: conversation.otherUserName || t('jobDetails.common.employerFallback'),
        jobId: String(conversation.jobId || targetJobId),
      });

    } catch (error: any) {
      toast.error(error?.message || t('jobDetails.apiFallback.openConversationFailed'));
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
      const result = await apiRequest(`${API_URL}/jobs/${jobDetails._id}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }, t('jobDetails.apiFallback.applyFailed'));
      if (!result.ok) {
        throw new Error(result.message || t('jobDetails.apiFallback.applyFailed'));
      }
      setHasApplied(true);
      setShowSuccess(true);
    } catch (error: any) {
      const message = error?.message || t('jobDetails.apiFallback.applyFailed');
      if (/already applied/i.test(message)) {
        setHasApplied(true);
      }
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDetails = useCallback(async () => {
    if (!job?._id) return;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const result = await apiRequest(`${API_URL}/jobs/${job._id}`, undefined, t('jobDetails.apiFallback.loadJobFailed'));
      if (!result.ok) {
        throw new Error(result.message || t('jobDetails.apiFallback.loadJobFailed'));
      }
      const data = asObject<any>(result.data) || asObject<any>(result.raw) || {};
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
      setErrorMessage(error?.message || t('jobDetails.apiFallback.loadJobFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [job?._id, t]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails, job._id]);

  useEffect(() => {
    const employerId = resolveEmployerId(jobDetails) || resolveEmployerId(job);
    fetchEmployerPreview(employerId);
  }, [jobDetails._id, jobDetails.jobPoster, job._id, jobDetails, job, fetchEmployerPreview]);

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
      <View style={{ flex: 1, backgroundColor: tokens.colors.signedInCanvas }}>
        <View style={styles.successContainer}>
          <View style={styles.successContent}>
            <View style={styles.successIcon}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
            <Text style={styles.successTitle}>{t('jobDetails.success.title')}</Text>
            <Text style={styles.successMessage}>
              {t('jobDetails.success.message')}
            </Text>
            <TouchableOpacity style={styles.findJobsBtn} onPress={handleFindMoreJobs} accessibilityRole="button" accessibilityLabel={t('jobDetails.success.findJobsAccessibility')}>
              <Text style={styles.findJobsBtnText}>{t('jobDetails.success.findJobsButton')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBackToHome} accessibilityRole="button" accessibilityLabel={t('jobDetails.success.backHomeAccessibility')}>
              <Text style={styles.backToHomeText}>{t('jobDetails.success.backHomeButton')}</Text>
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
            paddingBottom: tokens.layout.tabBarClearance,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Container with Light Blue Background */}
        <View style={styles.headerContainer}>
          {/* Job Title */}
          <Text style={styles.jobTitle}>{jobDetails?.title || t('jobDetails.titleFallback')}</Text>
          <Text style={styles.jobMeta}>{jobDetails?.jobType || ''} {jobDetails?.location ? `• ${jobDetails.location}` : ''}</Text>
          {jobDetails?.urgent ? (
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentText}>{t('jobDetails.urgentBadge')}</Text>
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
            <Text style={styles.statLabel}>{t('jobDetails.stats.locationLabel')}</Text>
            <Text style={styles.statValue}>{jobDetails?.location || t('jobDetails.common.notAvailable')}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>⏰</Text>
            <Text style={styles.statLabel}>{t('jobDetails.stats.typeLabel')}</Text>
            <Text style={styles.statValue}>{jobDetails?.jobType || t('jobDetails.common.notAvailable')}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>💰</Text>
            <Text style={styles.statLabel}>{t('jobDetails.stats.payLabel')}</Text>
            <Text style={styles.statValue}>{formatMinimumPay(jobDetails?.salary, t('jobDetails.common.notAvailable'))}</Text>
          </View>
        </View>
        </View>

        {/* Posted Info */}
        <View style={styles.postedInfoContainer}>
          {(() => {
            const employerName = jobDetails?.jobPoster?.firstName ? `${jobDetails.jobPoster.firstName} ${jobDetails.jobPoster.lastName || ''}`.trim() : t('jobDetails.postedBy.employerFallback');
            const [postedByPrefix, postedBySuffix] = t('jobDetails.postedBy.text', { name: '\u0000' }).split('\u0000');
            return (
              <Text style={styles.postedInfo}>
                {postedByPrefix}
                <Text style={styles.highlight}>{employerName}</Text>
                {postedBySuffix}
              </Text>
            );
          })()}

          {previewLoading ? (
            <ActivityIndicator size="small" color="#64748b" style={styles.previewLoader} />
          ) : employerPreview?.profile ? (
            <View style={styles.previewCard}>
              <Text style={styles.previewName}>
                {`${employerPreview.profile.firstName || ''} ${employerPreview.profile.lastName || ''}`.trim() || employerPreview.profile.companyName || t('jobDetails.employerPreview.nameFallback')}
              </Text>
              {employerPreview.profile.companyName ? (
                <Text style={styles.previewCompany}>{employerPreview.profile.companyName}</Text>
              ) : null}
              <Text style={styles.previewMeta}>
                {t('jobDetails.employerPreview.rating', { stars: Number(employerPreview.rating?.stars || 0).toFixed(1), percentage: Number(employerPreview.rating?.percentage || 0) })}
              </Text>
              {(employerPreview.profile.city || employerPreview.profile.province) ? (
                <Text style={styles.previewMeta}>
                  {[employerPreview.profile.city, employerPreview.profile.province].filter(Boolean).join(', ')}
                </Text>
              ) : null}
            </View>
          ) : null}

          <TouchableOpacity onPress={handleViewEmployerProfile} style={styles.viewProfileBtn} accessibilityRole="button" accessibilityLabel={t('jobDetails.actions.viewProfileAccessibility')}>
            <Text style={styles.viewProfileText}>{t('jobDetails.actions.viewProfile')}</Text>
          </TouchableOpacity>
        </View>

        {/* Skills */}
        <Text style={styles.sectionTitle}>{t('jobDetails.sections.skills')}</Text>
        <View style={styles.skillsGrid}>
          {(jobDetails?.skills || []).map((skill: string, index: number) => (
            <View key={index} style={styles.skillTag}>
              <Text style={styles.skillText}>{skill}</Text>
            </View>
          ))}
        </View>

        {/* Description */}
        <Text style={styles.sectionTitle}>{t('jobDetails.sections.description')}</Text>
        <Text style={styles.description}>
          {jobDetails?.description || t('jobDetails.common.noDescription')}
        </Text>

        {/* Requirements */}
        {jobDetails?.requirements?.length ? (
          <>
            <Text style={styles.sectionTitle}>{t('jobDetails.sections.requirements')}</Text>
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
            accessibilityLabel={saved ? t('jobDetails.actions.removeSavedAccessibility') : t('jobDetails.actions.saveAccessibility')}
            accessibilityState={{ selected: saved }}
          >
            <Text style={[styles.actionBtnText, styles.saveBtnText, saved && styles.savedBtnText]}>
              {saved ? t('jobDetails.actions.savedLabel') : t('jobDetails.actions.saveLabel')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.applyBtn, hasApplied && styles.appliedBtn]}
            onPress={handleApply}
            disabled={isLoading || hasApplied}
            accessibilityRole="button"
            accessibilityLabel={hasApplied ? t('jobDetails.actions.appliedAccessibility') : t('jobDetails.actions.applyAccessibility')}
            accessibilityState={{ disabled: isLoading || hasApplied }}
          >
            <Text style={styles.actionBtnText}>
              {hasApplied ? t('jobDetails.actions.appliedLabel') : isLoading ? t('jobDetails.actions.applyingLabel') : t('jobDetails.actions.applyLabel')}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.actionBtn, styles.messageBtn]} onPress={handleMessageEmployer} accessibilityRole="button" accessibilityLabel={t('jobDetails.actions.messageAccessibility')}>
          <Text style={[styles.actionBtnText, styles.messageBtnText]}>{t('jobDetails.actions.messageLabel')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom nav */}
      <Navigation activeTab={activeTab} onTabPress={handleTabPress} messageBadgeCount={messageBadgeCount} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.signedInCanvas },
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
    backgroundColor: tokens.colors.surface,
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
    backgroundColor: tokens.colors.contentMuted,
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
    color: tokens.colors.brand,
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
    backgroundColor: '#1C4D8D',
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
    color: tokens.colors.surface,
  },
  messageBtnText: {
    color: tokens.colors.surface,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: tokens.layout.tabBarClearance,
    backgroundColor: tokens.colors.signedInCanvas,
    paddingHorizontal: 20,
  },
  successContent: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    backgroundColor: tokens.colors.contentSurface,
    borderRadius: 20,
    padding: 24,
    ...tokens.shadow.card,
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
    color: tokens.colors.surface,
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
    backgroundColor: '#1C4D8D',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  findJobsBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.surface,
  },
  backToHomeText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
});
