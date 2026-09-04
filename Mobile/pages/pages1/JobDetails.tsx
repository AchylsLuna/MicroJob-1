import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Navigation from '../../components/navigation';
import ScrollView from '../../components/ui/SmoothScrollView';
import CategoryTile from '../../components/ui/CategoryTile';
import ProfileReviewsLoader from '../../components/reviews/ProfileReviewsLoader';
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
  onBack,
  onSaveJob,
  onMessageEmployer,
  isSaved = false,
  activeTab = 'Jobs',
  onTabPress,
  messageBadgeCount = 0,
}: JobDetailsProps) {
  const [activeSection, setActiveSection] = useState<'description' | 'company' | 'review'>('description');
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
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

  const handleShare = async () => {
    const title = jobDetails?.title || t('jobDetails.titleFallback');
    const pay = formatMinimumPay(jobDetails?.salary, t('jobDetails.common.notAvailable'));
    try {
      await Share.share({
        message: t('jobDetails.share.message', {
          title,
          pay,
          location: jobDetails?.location || t('jobDetails.common.notAvailable'),
        }),
      });
    } catch {
      // A dismissed or unavailable share sheet is not an error worth interrupting for.
    }
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
          </View>
        </View>
        <Navigation activeTab={activeTab} onTabPress={handleTabPress} messageBadgeCount={messageBadgeCount} />
      </View>
    );
  }

  const posterName = jobDetails?.jobPoster?.firstName
    ? `${jobDetails.jobPoster.firstName} ${jobDetails.jobPoster.lastName || ''}`.trim()
    : t('jobDetails.postedBy.employerFallback');
  const categoryValue = jobDetails?.category;
  const categoryId = typeof categoryValue === 'string' ? categoryValue : categoryValue?._id;
  const categoryName = typeof categoryValue === 'string' ? undefined : categoryValue?.name;

  // Only fields this app actually stores become chips — no invented experience/work-mode.
  const allChips = [
    jobDetails?.jobType ? { key: 'type', label: String(jobDetails.jobType) } : null,
    categoryName ? { key: 'category', label: categoryName } : null,
    jobDetails?.location ? { key: 'location', label: String(jobDetails.location) } : null,
    jobDetails?.deadline
      ? { key: 'deadline', label: t('jobDetails.chips.closes', { date: new Date(jobDetails.deadline).toLocaleDateString() }) }
      : null,
    jobDetails?.urgent ? { key: 'urgent', label: t('jobDetails.urgentBadge'), urgent: true } : null,
  ].filter(Boolean) as { key: string; label: string; urgent?: boolean }[];
  const visibleChips = allChips.slice(0, 4);
  const overflowChipCount = allChips.length - visibleChips.length;
  // Only offer the toggle when there is plausibly more than the 5 collapsed lines.
  const isDescriptionLong = String(jobDetails?.description || '').length > 240;
  const employerId = resolveEmployerId(jobDetails) || resolveEmployerId(job);

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity
          style={styles.topBarButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('jobDetails.actions.backAccessibility')}
        >
          <Ionicons name="chevron-back" size={22} color={tokens.colors.onCanvas} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>{t('jobDetails.headerTitle')}</Text>
        <TouchableOpacity
          style={styles.topBarButton}
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel={t('jobDetails.actions.shareAccessibility')}
        >
          <Ionicons name="share-social-outline" size={20} color={tokens.colors.onCanvas} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.identityRow}>
          <CategoryTile category={{ id: categoryId, name: categoryName }} size="md" />
          <View style={styles.identityCopy}>
            <Text style={styles.jobTitle} numberOfLines={2}>{jobDetails?.title || t('jobDetails.titleFallback')}</Text>
            <Text style={styles.identityMeta} numberOfLines={1}>
              {[posterName, jobDetails?.location].filter(Boolean).join('  •  ')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.identitySave}
            onPress={handleSave}
            accessibilityRole="button"
            accessibilityLabel={saved ? t('jobDetails.actions.removeSavedAccessibility') : t('jobDetails.actions.saveAccessibility')}
            accessibilityState={{ selected: saved }}
          >
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color={saved ? tokens.colors.brand : tokens.colors.onCanvasMuted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.heroSalary}>{formatMinimumPay(jobDetails?.salary, t('jobDetails.common.notAvailable'))}</Text>

        <View style={styles.heroChips}>
          {visibleChips.map((chip) => (
            <View key={chip.key} style={[styles.heroChip, chip.urgent && styles.heroChipUrgent]}>
              <Text style={[styles.heroChipText, chip.urgent && styles.heroChipUrgentText]} numberOfLines={1}>{chip.label}</Text>
            </View>
          ))}
          {overflowChipCount > 0 ? (
            <View style={styles.heroChip}><Text style={styles.heroChipText}>+{overflowChipCount}</Text></View>
          ) : null}
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={tokens.colors.brand} />
          </View>
        ) : null}

        <View style={styles.tabsRow}>
          {(['description', 'company', 'review'] as const).map((section) => {
            const selected = activeSection === section;
            return (
              <TouchableOpacity
                key={section}
                style={[styles.tabButton, selected && styles.tabButtonActive]}
                onPress={() => setActiveSection(section)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={t(`jobDetails.tabs.${section}`)}
              >
                <Text style={[styles.tabButtonText, selected && styles.tabButtonTextActive]}>
                  {t(`jobDetails.tabs.${section}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeSection === 'description' ? (
          <>
            {(jobDetails?.skills || []).length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>{t('jobDetails.sections.skills')}</Text>
                <View style={styles.skillsGrid}>
                  {(jobDetails?.skills || []).map((skill: string, index: number) => (
                    <View key={index} style={styles.skillTag}>
                      <Text style={styles.skillText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            <Text style={styles.sectionTitle}>{t('jobDetails.sections.aboutRole')}</Text>
            <Text style={styles.description} numberOfLines={descriptionExpanded ? undefined : 5}>
              {jobDetails?.description || t('jobDetails.common.noDescription')}
            </Text>
            {isDescriptionLong ? (
              <TouchableOpacity
                onPress={() => setDescriptionExpanded((value) => !value)}
                accessibilityRole="button"
                accessibilityState={{ expanded: descriptionExpanded }}
                style={styles.readMoreButton}
              >
                <Text style={styles.readMoreText}>
                  {descriptionExpanded ? t('jobDetails.actions.readLess') : t('jobDetails.actions.readMore')}
                </Text>
              </TouchableOpacity>
            ) : null}

            {jobDetails?.requirements?.length ? (
              <>
                <Text style={styles.sectionTitle}>{t('jobDetails.sections.requirements')}</Text>
                <View style={styles.requirementsList}>
                  {jobDetails.requirements.map((req: string, index: number) => (
                    <Text key={index} style={styles.requirementItem}>{'\u2022'} {req}</Text>
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : activeSection === 'company' ? (
          <View style={styles.postedInfoContainer}>
            {(() => {
              const [postedByPrefix, postedBySuffix] = t('jobDetails.postedBy.text', { name: '\u0000' }).split('\u0000');
              return (
                <Text style={styles.postedInfo}>
                  {postedByPrefix}
                  <Text style={styles.highlight}>{posterName}</Text>
                  {postedBySuffix}
                </Text>
              );
            })()}

            {previewLoading ? (
              <ActivityIndicator size="small" color={tokens.colors.textMuted} style={styles.previewLoader} />
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

            <TouchableOpacity style={[styles.actionBtn, styles.messageBtn]} onPress={handleMessageEmployer} accessibilityRole="button" accessibilityLabel={t('jobDetails.actions.messageAccessibility')}>
              <Text style={[styles.actionBtnText, styles.messageBtnText]}>{t('jobDetails.actions.messageLabel')}</Text>
            </TouchableOpacity>
          </View>
        ) : employerId ? (
          /* Reviews are stored against the employer, not the job, so this shows the poster's record. */
          <ProfileReviewsLoader
            profileOwnerId={employerId}
            profileOwnerName={posterName}
            viewAs="employer"
          />
        ) : (
          <Text style={styles.description}>{t('jobDetails.reviews.unavailable')}</Text>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, tokens.spacing.md) }]}>
        <TouchableOpacity
          style={[styles.bottomApplyButton, (isLoading || hasApplied) && styles.bottomApplyButtonDisabled]}
          onPress={handleApply}
          disabled={isLoading || hasApplied}
          accessibilityRole="button"
          accessibilityLabel={hasApplied ? t('jobDetails.actions.appliedAccessibility') : t('jobDetails.actions.applyAccessibility')}
          accessibilityState={{ disabled: isLoading || hasApplied }}
        >
          <Text style={styles.bottomApplyText}>
            {hasApplied ? t('jobDetails.actions.appliedLabel') : isLoading ? t('jobDetails.actions.applyingLabel') : t('jobDetails.actions.applyLabel')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.signedInCanvas },
  scroll: { paddingHorizontal: 20, paddingBottom: tokens.spacing.xl },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.layout.gutter,
    paddingBottom: tokens.spacing.sm,
    gap: tokens.spacing.sm,
    backgroundColor: tokens.colors.signedInCanvas,
  },
  topBarButton: {
    width: tokens.controls.minimumTouch,
    height: tokens.controls.minimumTouch,
    borderRadius: tokens.controls.minimumTouch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: tokens.colors.onCanvas },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, marginBottom: tokens.spacing.md },
  identityCopy: { flex: 1, gap: 3 },
  identityMeta: { color: tokens.colors.textMuted, fontSize: 13, fontWeight: '600' },
  identitySave: {
    width: tokens.controls.minimumTouch,
    height: tokens.controls.minimumTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readMoreButton: { alignSelf: 'flex-start', minHeight: tokens.controls.minimumTouch, justifyContent: 'center' },
  readMoreText: { color: tokens.colors.brand, fontSize: 14, fontWeight: '800' },
  hero: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    borderRadius: 24,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    ...tokens.shadow.card,
  },
  heroSalary: { fontSize: 18, fontWeight: '800', color: tokens.colors.brand, marginBottom: tokens.spacing.sm },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs, marginBottom: tokens.spacing.md },
  heroChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  heroChipText: { fontSize: 12, fontWeight: '600', color: tokens.colors.onCanvasMuted },
  heroChipUrgent: { backgroundColor: tokens.colors.dangerSoft, borderColor: tokens.colors.dangerSoft },
  heroChipUrgentText: { color: tokens.colors.danger, fontWeight: '800' },
  tabsRow: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    padding: 4,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surfaceMuted,
    marginBottom: tokens.spacing.md,
  },
  tabButton: {
    flex: 1,
    height: tokens.controls.compactHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.sm,
  },
  tabButtonActive: { backgroundColor: tokens.colors.brand },
  tabButtonText: { fontSize: 14, fontWeight: '700', color: tokens.colors.onCanvasMuted },
  tabButtonTextActive: { color: tokens.colors.onBrand },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.layout.gutter,
    paddingTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  bottomSaveButton: {
    width: tokens.controls.buttonHeight,
    height: tokens.controls.buttonHeight,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  bottomSaveButtonActive: { borderColor: tokens.colors.brand, backgroundColor: tokens.colors.brandSoft },
  bottomApplyButton: {
    flex: 1,
    height: tokens.controls.buttonHeight,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.brand,
  },
  bottomApplyButtonDisabled: { backgroundColor: tokens.colors.textSubtle },
  bottomApplyText: { fontSize: 16, fontWeight: '800', color: tokens.colors.onBrand },
  headerContainer: {
    backgroundColor: '#c8d4d8',
    borderRadius: 12,
    padding: 10,
    marginBottom: 24,
  },
  jobTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: tokens.colors.onCanvas,
    lineHeight: 26,
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
});
