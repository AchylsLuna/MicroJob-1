import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import EmployerNavigation from '../../components/employerNavigation';
import TabTopNav from '../../components/TabTopNav';
import { useToast } from '../../contexts/ToastContext';
import { apiRequest, asList } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import { formatMinimumPay } from '../../lib/jobCompensation';
import { formatNotificationTime } from '../../lib/notifications';
import { EmployerAction, EmployerInlineState, EmployerModeBanner } from '../../components/employer/EmployerUI';
import StatTile from '../../components/ui/StatTile';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import useReviewSummary from '../../hooks/useReviewSummary';
import { useAppSession } from '../../contexts/AppSessionContext';

type JobItem = {
  _id: string;
  title: string;
  location: string;
  salary: string;
  jobType: string;
  description?: string;
  requirements?: string[];
  responsibilities?: string[];
  skills?: string[];
  deadline?: string;
  status?: string;
  urgent?: boolean;
  applicants?: string[];
  positionsNeeded?: number;
  hiredCount?: number;
  selectedApplicant?: string | { _id?: string } | null;
  category?: { name: string };
  createdAt?: string;
};

type EmployerJobPostsProps = {
  onEditJob?: (job: JobItem) => void;
  onOpenWallet?: () => void;
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  headerSubtitle?: string;
  onOpenLocation?: () => void;
  onOpenApplications?: () => void;
  onPostJob?: () => void;
  onOpenMessages?: () => void;
  onOpenNotifications?: () => void;
  notificationBadgeCount?: number;
};

type JobAction = 'complete' | 'close' | 'reopen' | 'delete';

export default function EmployerJobPosts({
  onEditJob,
  onOpenWallet,
  activeTab,
  onTabPress,
  headerSubtitle,
  onOpenLocation,
  onOpenApplications,
  onPostJob,
  onOpenMessages,
  onOpenNotifications,
  notificationBadgeCount = 0,
}: EmployerJobPostsProps) {
  const toast = useToast();
  const { t } = useTranslation('employer');
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionJobId, setActionJobId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: JobAction; job: JobItem } | null>(null);
  const [viewingJob, setViewingJob] = useState<JobItem | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [balanceErrorMessage, setBalanceErrorMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const session = useAppSession();
  const employerId = String(session.user?.id || session.user?._id || '');
  const { averageRating, totalReviews } = useReviewSummary(employerId, 'employer');
  const mountedRef = useRef(true);
  const fetchInFlightRef = useRef(false);
  const actionInFlightRef = useRef(false);

  const activeJobs = jobs.filter((job) => ['Available', 'In Progress'].includes(String(job.status || 'Available'))).length;
  // Seats still open across every posting; never negative if someone over-hires.
  const remainingVacancy = jobs.reduce(
    (sum, job) => sum + Math.max(0, Number(job.positionsNeeded || 1) - Number(job.hiredCount || 0)),
    0,
  );

  const fetchJobs = useCallback(async () => {
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    setLoading(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest<JobItem[]>(`${API_URL}/jobs/mine`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }, t('jobPosts.errors.loadFailed'));
      if (!result.ok) throw new Error(result.message || t('jobPosts.errors.loadFailed'));
      if (mountedRef.current) setJobs(asList<JobItem>(result.raw, ['jobs']));
    } catch (error: any) {
      if (mountedRef.current) setErrorMessage(error?.message || t('jobPosts.errors.loadFailed'));
    } finally {
      fetchInFlightRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useFocusEffect(useCallback(() => {
    void fetchJobs();
  }, [fetchJobs]));

  const requestAction = (job: JobItem, action: JobAction) => setConfirmAction({ job, action });

  const actionFailureKeys: Record<JobAction, string> = {
    complete: 'jobPosts.errors.completeFailed',
    close: 'jobPosts.errors.closeFailed',
    reopen: 'jobPosts.errors.reopenFailed',
    delete: 'jobPosts.errors.deleteFailed',
  };

  const handleConfirmAction = async () => {
    if (!confirmAction || actionInFlightRef.current) return;

    const { action, job } = confirmAction;
    const actionFailureMessage = t(actionFailureKeys[action]);
    actionInFlightRef.current = true;
    setActionJobId(job._id);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const isStatusChange = action === 'complete' || action === 'close';
      const result = await apiRequest(
        action === 'reopen'
          ? `${API_URL}/jobs/${job._id}/reopen`
          : `${API_URL}/jobs/${job._id}${isStatusChange ? '/status' : ''}`,
        {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        headers: {
          ...(isStatusChange ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(isStatusChange
          ? { body: JSON.stringify({ status: action === 'complete' ? 'Completed' : 'Closed' }) }
          : {}),
      }, actionFailureMessage);

      if (!result.ok) throw new Error(result.message || actionFailureMessage);

      if (mountedRef.current) {
        setConfirmAction(null);
        if (viewingJob?._id === job._id) setViewingJob(null);
      }
      await fetchJobs();
      if (mountedRef.current) {
        const successMessage = action === 'complete'
          ? t('jobPosts.toast.completed')
          : action === 'close'
          ? t('jobPosts.toast.closed')
          : action === 'reopen'
          ? t('jobPosts.toast.reopened')
          : t('jobPosts.toast.deleted');
        toast.success(successMessage);
      }
    } catch (error: any) {
      if (mountedRef.current) {
        const message = error?.message || actionFailureMessage;
        setConfirmAction(null);
        if (/(?:insufficient|not have enough) balance/i.test(message)) {
          setBalanceErrorMessage(message);
        } else {
          setErrorMessage(message);
        }
      }
    } finally {
      actionInFlightRef.current = false;
      if (mountedRef.current) setActionJobId(null);
    }
  };

  const actionCopy = confirmAction ? {
    complete: {
      title: t('jobPosts.confirm.complete.title'),
      question: t('jobPosts.confirm.complete.question', { title: confirmAction.job.title }),
      detail: t('jobPosts.confirm.complete.detail'),
      button: t('jobPosts.confirm.complete.button'),
    },
    close: {
      title: t('jobPosts.confirm.close.title'),
      question: t('jobPosts.confirm.close.question', { title: confirmAction.job.title }),
      detail: t('jobPosts.confirm.close.detail'),
      button: t('jobPosts.confirm.close.button'),
    },
    reopen: {
      title: t('jobPosts.confirm.reopen.title'),
      question: t('jobPosts.confirm.reopen.question', { title: confirmAction.job.title }),
      detail: ['Completed', 'Cancelled'].includes(String(confirmAction.job.status || ''))
        ? t('jobPosts.confirm.reopen.detailEscrow')
        : t('jobPosts.confirm.reopen.detailDefault'),
      button: t('jobPosts.confirm.reopen.button'),
    },
    delete: {
      title: t('jobPosts.confirm.delete.title'),
      question: t('jobPosts.confirm.delete.question', { title: confirmAction.job.title }),
      detail: t('jobPosts.confirm.delete.detail'),
      button: t('jobPosts.confirm.delete.button'),
    },
  }[confirmAction.action] : null;

  return (
    <View style={styles.container}>
      <TabTopNav title={t('jobPosts.header.title')} subtitle={headerSubtitle} onSubtitlePress={onOpenLocation} homeContext employerMode showNotifications onOpenNotifications={onOpenNotifications} notificationBadgeCount={notificationBadgeCount} />

      <FlatList
        data={jobs}
        keyExtractor={(job) => job._id}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={7}
        maxToRenderPerBatch={7}
        windowSize={7}
        refreshControl={<RefreshControl refreshing={loading && jobs.length > 0} onRefresh={() => void fetchJobs()} tintColor={tokens.colors.brand} />}
        ListHeaderComponent={<>
        <EmployerModeBanner title={t('jobPosts.banner.title')} detail={t('jobPosts.banner.detail')} />
        <View style={styles.statGrid}>
          <StatTile label={t('jobPosts.metrics.activeJobs')} value={activeJobs} />
          <StatTile label={t('jobPosts.metrics.totalJobs')} value={jobs.length} />
        </View>
        <View style={styles.statGrid}>
          <StatTile
            label={t('jobPosts.metrics.avgRating')}
            value={totalReviews > 0 ? averageRating.toFixed(1) : '—'}
            icon="star"
            iconColor={tokens.colors.warning}
            caption={totalReviews > 0 ? t('jobPosts.metrics.reviewCount', { count: totalReviews }) : undefined}
          />
          <StatTile label={t('jobPosts.metrics.remainingVacancy')} value={remainingVacancy} />
        </View>

        <AnimatedPressable
          containerStyle={styles.postJobButton}
          onPress={onPostJob}
          disabled={!onPostJob}
          accessibilityRole="button"
          accessibilityLabel={t('jobPosts.actions.postJob')}
        >
          <Text style={styles.postJobButtonText}>{t('jobPosts.actions.postJob')}</Text>
        </AnimatedPressable>

        <Text style={styles.operationsTitle}>{t('jobPosts.quickOperations.title')}</Text>
        <View style={styles.operationsGrid}>
          <EmployerAction icon="people-outline" label={t('jobPosts.actions.reviewApplicants')} onPress={onOpenApplications} disabled={!onOpenApplications} />
          <EmployerAction icon="chatbubbles-outline" label={t('jobPosts.actions.messages')} onPress={onOpenMessages} disabled={!onOpenMessages} />
          <EmployerAction icon="wallet-outline" label={t('jobPosts.actions.employerWallet')} onPress={onOpenWallet} disabled={!onOpenWallet} />
        </View>
        <View style={styles.sectionHeadingRow}><Text style={styles.operationsTitle}>{t('jobPosts.openings.title')}</Text><Text style={styles.sectionCount}>{jobs.length}</Text></View>

        {loading ? (
          jobs.length === 0 ? <EmployerInlineState loading title={t('jobPosts.loading.title')} body={t('jobPosts.loading.body')} /> : null
        ) : null}

        {errorMessage ? (
          <EmployerInlineState icon="cloud-offline-outline" title={t('jobPosts.error.title')} body={errorMessage} onRetry={() => void fetchJobs()} />
        ) : null}
        </>}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t('jobPosts.empty.title')}</Text>
            <Text style={styles.emptyText}>{t('jobPosts.empty.body')}</Text>
          </View>
        ) : null}
        renderItem={({ item: job }) => {
          const status = String(job.status || 'Available');
          const hasHiredWorker = Number(job.hiredCount || 0) > 0 || Boolean(job.selectedApplicant);
          const canComplete = status !== 'Completed' && (status === 'In Progress' || hasHiredWorker);
          return (
          <View style={styles.jobCard}>
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
                    <Text style={styles.urgentText}>{t('jobPosts.badges.urgent')}</Text>
                  </View>
                ) : null}
                <View style={styles.statusTag}>
                  <Text style={styles.statusText}>{job.status || t('jobPosts.status.available')}</Text>
                </View>
              </View>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.jobType}>{job.jobType}</Text>
              <Text style={styles.salary}>{formatMinimumPay(job.salary)}</Text>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.appliedText}>
                {t('jobPosts.card.applied', { count: job.applicants?.length || 0 })}
              </Text>
              <Text style={styles.footerText}>
                {t('jobPosts.card.positions', { hired: job.hiredCount || 0, needed: job.positionsNeeded || 1 })}
              </Text>
              <Text style={styles.footerText}>
                {job.createdAt ? formatNotificationTime(job.createdAt) : ''}
              </Text>
            </View>

            <View style={styles.primaryJobActions}>
                <TouchableOpacity style={styles.viewButton} onPress={() => setViewingJob(job)}>
                  <Ionicons name="eye-outline" size={15} color={tokens.colors.brand} />
                  <Text style={styles.viewButtonText}>{t('jobPosts.card.view')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editButton} onPress={() => onEditJob?.(job)}>
                  <Ionicons name="create-outline" size={15} color={tokens.colors.surface} />
                  <Text style={styles.editButtonText}>{t('jobPosts.card.edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.moreButton} onPress={() => setExpandedJobId((id) => id === job._id ? null : job._id)} accessibilityRole="button" accessibilityState={{ expanded: expandedJobId === job._id }} accessibilityLabel={expandedJobId === job._id ? t('jobPosts.card.hideActionsLabel', { title: job.title }) : t('jobPosts.card.showActionsLabel', { title: job.title })}>
                  <Ionicons name={expandedJobId === job._id ? 'chevron-up' : 'ellipsis-horizontal'} size={17} color={tokens.colors.brand} />
                  <Text style={styles.moreButtonText}>{t('jobPosts.card.more')}</Text>
                </TouchableOpacity>
            </View>
            {expandedJobId === job._id ? <View style={styles.footerActions}>
                {status === 'Available' ? (
                  <TouchableOpacity
                    style={styles.closeButton}
                    disabled={actionJobId === job._id}
                    onPress={() => requestAction(job, 'close')}
                  >
                    <Text style={styles.closeButtonText}>{t('jobPosts.card.close')}</Text>
                  </TouchableOpacity>
                ) : null}
                {['Closed', 'Completed', 'Cancelled'].includes(status) ? (
                  <TouchableOpacity
                    style={styles.reopenButton}
                    disabled={actionJobId === job._id}
                    onPress={() => requestAction(job, 'reopen')}
                  >
                    <Ionicons name="refresh-outline" size={15} color="#15803d" />
                    <Text style={styles.reopenButtonText}>{t('jobPosts.card.reopen')}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[styles.doneButton, !canComplete && styles.doneButtonDisabled]}
                  disabled={!canComplete || actionJobId === job._id}
                  onPress={() => requestAction(job, 'complete')}
                >
                  {actionJobId === job._id ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.doneButtonText}>{t('jobPosts.card.markDone')}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  disabled={actionJobId === job._id}
                  onPress={() => requestAction(job, 'delete')}
                >
                  <Ionicons name="trash-outline" size={15} color="#b91c1c" />
                  <Text style={styles.deleteButtonText}>{t('jobPosts.card.delete')}</Text>
                </TouchableOpacity>
            </View> : null}
            {expandedJobId === job._id ? <Text style={styles.autoPayHint}>
              {canComplete
                ? t('jobPosts.card.autoPayHintReady')
                : t('jobPosts.card.autoPayHintBlocked')}
            </Text> : null}
          </View>
          );
        }}
      />

      <Modal
        visible={Boolean(confirmAction)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!actionJobId) setConfirmAction(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{actionCopy?.title}</Text>
            <Text style={styles.modalText}>{actionCopy?.question}</Text>
            <Text style={styles.modalInfo}>{actionCopy?.detail}</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setConfirmAction(null)}
                disabled={Boolean(actionJobId)}
              >
                <Text style={styles.modalCancelText}>{t('jobPosts.confirm.cancelLabel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, confirmAction?.action === 'delete' && styles.modalDeleteBtn]}
                onPress={handleConfirmAction}
                disabled={Boolean(actionJobId)}
              >
                {actionJobId ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>{actionCopy?.button}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(viewingJob)} transparent animationType="slide" onRequestClose={() => setViewingJob(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.detailsCard}>
            <View style={styles.detailsHeader}>
              <View style={styles.detailsHeaderCopy}>
                <Text style={styles.detailsEyebrow}>{t('jobPosts.details.eyebrow')}</Text>
                <Text style={styles.detailsTitle}>{viewingJob?.title}</Text>
              </View>
              <TouchableOpacity style={styles.iconButton} onPress={() => setViewingJob(null)} accessibilityLabel={t('jobPosts.details.closeLabel')}>
                <Ionicons name="close" size={22} color={tokens.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.detailsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.detailTagRow}>
                <Text style={styles.detailTag}>{viewingJob?.status || t('jobPosts.status.available')}</Text>
                <Text style={styles.detailTag}>{viewingJob?.jobType || t('jobPosts.details.jobTypeFallback')}</Text>
                {viewingJob?.urgent ? <Text style={[styles.detailTag, styles.urgentDetailTag]}>{t('jobPosts.badges.urgent')}</Text> : null}
              </View>
              <DetailRow icon="location-outline" label={t('jobPosts.details.labels.location')} value={viewingJob?.location} />
              <DetailRow icon="cash-outline" label={t('jobPosts.details.labels.minimumPay')} value={formatMinimumPay(viewingJob?.salary || '')} />
              <DetailRow icon="people-outline" label={t('jobPosts.details.labels.workers')} value={t('jobPosts.details.hiredOfNeeded', { hired: viewingJob?.hiredCount || 0, needed: viewingJob?.positionsNeeded || 1 })} />
              <DetailRow icon="folder-outline" label={t('jobPosts.details.labels.category')} value={viewingJob?.category?.name || t('jobPosts.details.notSpecified')} />
              <DetailRow
                icon="calendar-outline"
                label={t('jobPosts.details.labels.deadline')}
                value={viewingJob?.deadline ? new Date(viewingJob.deadline).toLocaleString() : t('jobPosts.details.notSpecified')}
              />
              <DetailSection title={t('jobPosts.details.sections.description')} value={viewingJob?.description} />
              <DetailSection title={t('jobPosts.details.sections.requirements')} values={viewingJob?.requirements} />
              <DetailSection title={t('jobPosts.details.sections.responsibilities')} values={viewingJob?.responsibilities} />
              <DetailSection title={t('jobPosts.details.sections.skills')} values={viewingJob?.skills} />
            </ScrollView>
            <View style={styles.detailsActions}>
              <TouchableOpacity style={styles.detailsSecondaryButton} onPress={() => setViewingJob(null)}>
                <Text style={styles.detailsSecondaryText}>{t('jobPosts.card.close')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.detailsPrimaryButton}
                onPress={() => {
                  if (!viewingJob) return;
                  const job = viewingJob;
                  setViewingJob(null);
                  onEditJob?.(job);
                }}
              >
                <Ionicons name="create-outline" size={16} color={tokens.colors.surface} />
                <Text style={styles.detailsPrimaryText}>{t('jobPosts.details.editButton')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(balanceErrorMessage)} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setBalanceErrorMessage('')}>
        <View style={styles.balanceBackdrop}>
          <View style={styles.balanceCard}>
            <View style={styles.balanceIcon}><Text style={styles.balanceIconText}>!</Text></View>
            <Text style={styles.balanceTitle}>{t('jobPosts.balanceModal.title')}</Text>
            <Text style={styles.balanceText}>{balanceErrorMessage}</Text>
            <View style={styles.balanceActions}>
              <TouchableOpacity style={styles.balanceSecondary} onPress={() => setBalanceErrorMessage('')}>
                <Text style={styles.balanceSecondaryText}>{t('jobPosts.balanceModal.notNow')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.balancePrimary} onPress={() => { setBalanceErrorMessage(''); onOpenWallet?.(); }}>
                <Text style={styles.balancePrimaryText}>{t('jobPosts.balanceModal.topUpWallet')}</Text>
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

function DetailRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string }) {
  const { t } = useTranslation('employer');
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}><Ionicons name={icon} size={17} color={tokens.colors.brand} /></View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value || t('jobPosts.details.notSpecified')}</Text>
      </View>
    </View>
  );
}

function DetailSection({ title, value, values }: { title: string; value?: string; values?: string[] }) {
  const items = Array.isArray(values) ? values.filter(Boolean) : [];
  if (!value && !items.length) return null;
  return (
    <View style={styles.detailSection}>
      <Text style={styles.detailSectionTitle}>{title}</Text>
      {value ? <Text style={styles.detailSectionText}>{value}</Text> : null}
      {items.map((item, index) => <Text key={`${title}-${index}`} style={styles.detailListItem}>• {item}</Text>)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.signedInCanvas },
  scroll: { paddingHorizontal: tokens.layout.gutterWide, paddingTop: tokens.layout.sectionGap, paddingBottom: tokens.layout.tabBarClearance + 16 },
  statGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  postJobButton: {
    minHeight: tokens.controls.buttonHeight,
    justifyContent: 'center',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brand,
    marginBottom: tokens.spacing.md,
  },
  postJobButtonText: { color: tokens.colors.onBrand, fontSize: 16, fontWeight: '800' },
  metricRow: { marginTop: 14, marginBottom: 16, flexDirection: 'row', gap: 9 },
  operationsTitle: { marginBottom: 10, color: tokens.colors.brandDark, fontSize: 17, fontWeight: '900' },
  operationsGrid: { marginBottom: 18, gap: 9 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionCount: { minWidth: 24, height: 24, borderRadius: 12, overflow: 'hidden', paddingHorizontal: 7, paddingTop: 4, backgroundColor: tokens.colors.brand, color: tokens.colors.onBrand, fontSize: 11, fontWeight: '900', textAlign: 'center' },
  emptyCard: {
    backgroundColor: tokens.colors.cardSoft,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: tokens.colors.brandDark, marginBottom: 6 },
  emptyText: { fontSize: 13, color: tokens.colors.textMuted, textAlign: 'center' },
  jobCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: tokens.colors.brandDark,
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
  jobTitle: { fontSize: 16, fontWeight: '700', color: tokens.colors.brandDark },
  jobLocation: { fontSize: 13, color: tokens.colors.textMuted, marginTop: 4 },
  categoryTag: {
    marginTop: 6,
    backgroundColor: tokens.colors.brandSoft,
    color: tokens.colors.brand,
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
  jobType: { color: tokens.colors.brand, fontWeight: '700', fontSize: 12 },
  salary: { color: '#16a34a', fontWeight: '700', fontSize: 12 },
  appliedText: { color: tokens.colors.brand, fontSize: 12, fontWeight: '800' },
  footerRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  footerText: { color: tokens.colors.textMuted, fontSize: 12 },
  footerActions: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  primaryJobActions: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  moreButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, borderWidth: 1, borderColor: tokens.colors.brandMuted, backgroundColor: tokens.colors.brandSoft, paddingHorizontal: 12 },
  moreButtonText: { color: tokens.colors.brand, fontSize: 12, fontWeight: '800' },
  doneButton: {
    minHeight: 44,
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  doneButtonDisabled: {
    backgroundColor: tokens.colors.textSubtle,
  },
  doneButtonText: { color: tokens.colors.surface, fontSize: 12, fontWeight: '700' },
  editButton: {
    minHeight: 44,
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    justifyContent: 'center',
    borderRadius: 10,
  },
  editButtonText: { color: tokens.colors.surface, fontSize: 12, fontWeight: '700' },
  viewButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', paddingHorizontal: 12, justifyContent: 'center' },
  viewButtonText: { color: tokens.colors.brand, fontSize: 12, fontWeight: '700' },
  closeButton: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc', paddingHorizontal: 12, justifyContent: 'center' },
  closeButtonText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  reopenButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0', backgroundColor: '#f0fdf4', paddingHorizontal: 12, justifyContent: 'center' },
  reopenButtonText: { color: '#15803d', fontSize: 12, fontWeight: '700' },
  deleteButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fef2f2', paddingHorizontal: 12, justifyContent: 'center' },
  deleteButtonText: { color: '#b91c1c', fontSize: 12, fontWeight: '700' },
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
    backgroundColor: tokens.colors.surface,
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
    color: '#1C4D8D',
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
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  modalConfirmBtn: {
    minHeight: 52,
    backgroundColor: '#1C4D8D',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 110,
    alignItems: 'center',
  },
  modalDeleteBtn: { backgroundColor: '#b91c1c' },
  modalConfirmText: {
    color: tokens.colors.surface,
    fontSize: 13,
    fontWeight: '700',
  },
  detailsCard: { width: '100%', maxWidth: 520, maxHeight: '88%', borderRadius: 22, backgroundColor: tokens.colors.surface, overflow: 'hidden' },
  detailsHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 18, borderBottomWidth: 1, borderBottomColor: tokens.colors.border },
  detailsHeaderCopy: { flex: 1, paddingRight: 12 },
  detailsEyebrow: { color: tokens.colors.brand, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  detailsTitle: { marginTop: 5, color: tokens.colors.text, fontSize: 21, fontWeight: '800' },
  iconButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.surfaceMuted },
  detailsScroll: { padding: 18, gap: 12 },
  detailTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  detailTag: { borderRadius: 999, backgroundColor: tokens.colors.brandSoft, color: tokens.colors.brand, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: '700' },
  urgentDetailTag: { backgroundColor: '#fee2e2', color: '#b91c1c' },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 4 },
  detailIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.brandSoft },
  detailCopy: { flex: 1 },
  detailLabel: { color: tokens.colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { marginTop: 3, color: tokens.colors.text, fontSize: 14, lineHeight: 20 },
  detailSection: { marginTop: 4, borderTopWidth: 1, borderTopColor: tokens.colors.border, paddingTop: 14 },
  detailSectionTitle: { color: tokens.colors.text, fontSize: 14, fontWeight: '800', marginBottom: 7 },
  detailSectionText: { color: tokens.colors.textMuted, fontSize: 13, lineHeight: 20 },
  detailListItem: { color: tokens.colors.textMuted, fontSize: 13, lineHeight: 21 },
  detailsActions: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: tokens.colors.border },
  detailsSecondaryButton: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.border, alignItems: 'center', justifyContent: 'center' },
  detailsSecondaryText: { color: tokens.colors.text, fontSize: 13, fontWeight: '700' },
  detailsPrimaryButton: { flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: tokens.colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  detailsPrimaryText: { color: tokens.colors.surface, fontSize: 13, fontWeight: '700' },
  balanceBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(107, 114, 128, 0.72)', padding: 24 },
  balanceCard: { width: '100%', maxWidth: 400, alignItems: 'center', borderRadius: 24, backgroundColor: tokens.colors.surface, padding: 24 },
  balanceIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fee2e2' },
  balanceIconText: { color: '#dc2626', fontSize: 28, fontWeight: '800' },
  balanceTitle: { marginTop: 16, color: tokens.colors.text, fontSize: 20, fontWeight: '800' },
  balanceText: { marginTop: 8, color: tokens.colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  balanceActions: { width: '100%', flexDirection: 'row', gap: 12, marginTop: 24 },
  balanceSecondary: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12 },
  balanceSecondaryText: { color: tokens.colors.text, fontSize: 14, fontWeight: '700' },
  balancePrimary: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: tokens.colors.brand },
  balancePrimaryText: { color: tokens.colors.surface, fontSize: 14, fontWeight: '700' },
});
