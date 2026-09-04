import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Navigation from '../../components/navigation';
import ScrollView from '../../components/ui/SmoothScrollView';
import { useAppSession } from '../../contexts/AppSessionContext';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import { apiRequest, asList, asObject } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import JobCard from '../../components/job/JobCard';
import { toJobCardData } from '../../components/job/jobCardModel';
import CalendarSheet from '../../components/ui/CalendarSheet';
import { isDateDisabled, type DateRange } from '../../lib/calendarModel';
import { useTranslation } from 'react-i18next';

type Category = { _id: string; name: string };
export type Job = {
  _id: string;
  title: string;
  description: string;
  location: string;
  salary: string;
  jobType: string;
  urgent?: boolean;
  skills?: string[];
  createdAt?: string;
  deadline?: string;
  category?: { _id: string; name: string } | string;
  jobPoster?: { _id?: string; id?: string; firstName?: string; lastName?: string; email?: string };
};

type DateFilterPreset = 'all' | '7' | '30' | 'custom';

type JobsProps = {
  onViewDetails?: (job: Job) => void;
  onToggleSave?: (job: Job) => void;
  onOpenSavedJobs?: () => void;
  onOpenAppliedJobs?: () => void;
  onOpenNotifications?: () => void;
  onMessageEmployer?: (payload: { userId?: string; userName?: string; jobId?: string }) => void;
  savedJobIds?: string[];
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  notificationBadgeCount?: number;
  messageBadgeCount?: number;
  initialCategory?: string;
};

export default function Jobs(props: JobsProps) {
  const {
    onViewDetails,
    onToggleSave,
    onOpenSavedJobs,
    onOpenAppliedJobs,
    onOpenNotifications,
    onMessageEmployer,
    savedJobIds = [],
    activeTab: externalActiveTab,
    onTabPress: externalOnTabPress,
    notificationBadgeCount = 0,
    messageBadgeCount = 0,
    initialCategory,
  } = props;
  const { t } = useTranslation('worker');
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedJobType, setSelectedJobType] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>('all');
  const [customDateRange, setCustomDateRange] = useState<DateRange>({ start: null, end: null });
  const [showDateFilterSheet, setShowDateFilterSheet] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>([]);
  const [workerLocation, setWorkerLocation] = useState({ province: '', city: '', barangay: '' });
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [preferredCategoryIds, setPreferredCategoryIds] = useState<string[]>([]);
  const [jobPreferenceText, setJobPreferenceText] = useState('');
  const [showMatchingPreferences, setShowMatchingPreferences] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const session = useAppSession();
  const firstName = String(session.user?.firstName || '').trim() || t('jobs.home.fallbackName');

  const activeFilterCount = useMemo(() => (
    (selectedCategory !== 'All' ? 1 : 0) +
    (selectedJobType !== 'All' ? 1 : 0) +
    (dateFilter !== 'all' ? 1 : 0)
  ), [selectedCategory, selectedJobType, dateFilter]);

  const resetFilters = useCallback(() => {
    setSelectedCategory('All');
    setSelectedJobType('All');
    setDateFilter('all');
    setCustomDateRange({ start: null, end: null });
  }, []);

  const jobTypeOptions = useMemo(() => ([
    { value: 'All', label: t('jobs.jobTypes.all') },
    { value: 'Short-term', label: t('jobs.jobTypes.shortTerm') },
    { value: 'Side hustle', label: t('jobs.jobTypes.sideHustle') },
    { value: 'Recruiting', label: t('jobs.jobTypes.recruiting') },
  ]), [t]);

  useEffect(() => {
    setSelectedCategory(initialCategory || 'All');
  }, [initialCategory]);

  const normalizeToken = useCallback((value?: string) =>
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim(), []);

  const locationScore = useCallback((jobLocation: string) => {
    const text = normalizeToken(jobLocation);
    if (!text) return 0;

    const province = normalizeToken(workerLocation.province);
    const city = normalizeToken(workerLocation.city);
    const barangay = normalizeToken(workerLocation.barangay);

    let score = 0;
    if (province && text.includes(province)) score += 1;
    if (city && text.includes(city)) score += 2;
    if (barangay && text.includes(barangay)) score += 3;
    return score;
  }, [normalizeToken, workerLocation]);

  const deadlineRange = useMemo((): DateRange | null => {
    if (dateFilter === 'all') return null;
    if (dateFilter === '7' || dateFilter === '30') {
      const days = dateFilter === '7' ? 7 : 30;
      const end = new Date();
      end.setDate(end.getDate() + days);
      return { start: new Date(), end };
    }
    if (dateFilter === 'custom' && customDateRange.start) {
      return { start: customDateRange.start, end: customDateRange.end || customDateRange.start };
    }
    return null;
  }, [dateFilter, customDateRange]);

  const filteredJobs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return jobs.filter((job) => {
      // Exclude jobs already applied to
      if (appliedJobIds.includes(job._id)) return false;

      if (deadlineRange && deadlineRange.start && deadlineRange.end) {
        if (!job.deadline) return false;
        const deadlineDate = new Date(job.deadline);
        if (Number.isNaN(deadlineDate.getTime())) return false;
        if (isDateDisabled(deadlineDate, { minDate: deadlineRange.start, maxDate: deadlineRange.end })) return false;
      }

      if (!query) return true;
      return [job.title, job.description, job.location]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [jobs, searchQuery, appliedJobIds, deadlineRange]);

  const nearestJobs = useMemo(
    () =>
      [...filteredJobs]
        .filter((job) => locationScore(job.location) > 0)
        .sort((a, b) => locationScore(b.location) - locationScore(a.location))
        .slice(0, 4),
    [filteredJobs, locationScore],
  );

  const fetchCategories = useCallback(async () => {
    try {
      const result = await apiRequest<Category[]>(`${API_URL}/categories`, undefined, t('jobs.apiFallback.loadCategoriesFailed'));
      if (result.ok) {
        setCategories(asList<Category>(result.raw, ['categories']));
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, [t]);

  const fetchAppliedJobs = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;
      const result = await apiRequest(`${API_URL}/applications`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }, t('jobs.apiFallback.loadApplicationsFailed'));
      if (result.ok) {
        const applications = asList<any>(result.raw, ['applications']);
        const jobIds = applications.map((app: any) => app.job?._id).filter(Boolean);
        setAppliedJobIds(jobIds);
      }
    } catch (error) {
      console.error('Failed to load applied jobs:', error);
    }
  }, [t]);

  const fetchJobs = useCallback(async () => {
    if (!locationLoaded) return;
    if (!workerLocation.city.trim()) {
      setJobs([]);
      setErrorMessage(t('jobs.errors.locationRequired'));
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const params = new URLSearchParams();
      if (selectedCategory !== 'All') {
        params.append('category', selectedCategory);
      }
      if (selectedJobType !== 'All') {
        params.append('jobType', selectedJobType);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      // Always exclude own jobs for all users
      params.append('excludeOwn', 'true');

      const result = await apiRequest<Job[]>(
        `${API_URL}/jobs?${params.toString()}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
        t('jobs.apiFallback.loadJobsFailed')
      );
      if (!result.ok) throw new Error(result.message || t('jobs.apiFallback.loadJobsFailed'));
      setJobs(asList<Job>(result.raw, ['jobs']));
    } catch (error: any) {
      setErrorMessage(error?.message || t('jobs.apiFallback.loadJobsFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [locationLoaded, searchQuery, selectedCategory, selectedJobType, workerLocation.city, t]);

  useEffect(() => {
    fetchCategories();
    fetchAppliedJobs();
    // Load current user ID to prevent messaging self
    const loadCurrentUserId = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('auth_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setCurrentUserId(parsed?._id || parsed?.id || null);
        }
      } catch (error) {
        console.log('Failed to load current user ID', error);
      }
    };
    loadCurrentUserId();
  }, [fetchCategories, fetchAppliedJobs]);

  useEffect(() => {
    const loadWorkerLocation = async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const profileResult = await apiRequest<any>(
          `${API_URL}/auth/me`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          },
          t('jobs.apiFallback.loadProfileLocationFailed'),
        );

        const raw = (profileResult.raw || {}) as any;
        const profile = (raw?.data && typeof raw.data === 'object' ? raw.data : raw?.user || raw) as any;

        setWorkerLocation({
          province: String(profile?.province || ''),
          city: String(profile?.city || ''),
          barangay: String(profile?.barangay || ''),
        });
        setPreferredCategoryIds(
          Array.isArray(profile?.preferredCategories)
            ? profile.preferredCategories.map((item: any) => String(item?._id || item)).filter(Boolean)
            : []
        );
        setJobPreferenceText(Array.isArray(profile?.jobPreferences) ? profile.jobPreferences.join(', ') : '');
      } catch {
        setWorkerLocation({ province: '', city: '', barangay: '' });
      } finally {
        setLocationLoaded(true);
      }
    };

    loadWorkerLocation();
  }, [t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchJobs();
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedCategory, selectedJobType, searchQuery, fetchJobs]);

  const handleTabPress = (tab: string) => {
    externalOnTabPress?.(tab);
  };

  const handleToggleSave = (job: Job) => {
    onToggleSave?.(job);
  };

  // Resolve the employer from the job post server-side so the inquiry opens the
  // worker <-> job poster thread rather than the Admin/Support channel.
  const handleMessageEmployer = async (job: Job) => {
    if (!job?._id) return;
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const result = await apiRequest(
        `${API_URL}/messages/inquiries/${job._id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sendInitialMessage: false }),
        },
        t('jobs.apiFallback.openConversationFailed')
      );

      if (!result.ok) return;

      const payload = asObject<any>(result.data) || asObject<any>(result.raw) || {};
      const conversation = payload.conversation || payload;
      if (!conversation?.otherUserId) return;

      onMessageEmployer?.({
        userId: String(conversation.otherUserId),
        userName: conversation.otherUserName || t('jobs.common.employerFallback'),
        jobId: String(conversation.jobId || job._id),
      });
    } catch (error) {
      console.warn('Job inquiry could not be started', error);
    }
  };

  const saveMatchingPreferences = async () => {
    setSavingPreferences(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/auth/profile/job-preferences`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          preferredCategories: preferredCategoryIds,
          jobPreferences: jobPreferenceText.split(',').map((item) => item.trim()).filter(Boolean),
        }),
      }, t('jobs.apiFallback.saveJobPreferencesFailed'));
      if (!result.ok) throw new Error(result.message || t('jobs.apiFallback.saveJobPreferencesFailed'));
      setShowMatchingPreferences(false);
    } catch (error: any) {
      setErrorMessage(error?.message || t('jobs.apiFallback.saveJobPreferencesFailed'));
    } finally {
      setSavingPreferences(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.greeting} numberOfLines={1}>{t('jobs.home.greeting', { name: firstName })}</Text>
            <Text style={styles.headline}>{t('jobs.home.headline')}</Text>
          </View>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={onOpenNotifications}
            accessibilityRole="button"
            accessibilityLabel={t('jobs.home.notificationsAccessibility')}
          >
            <Ionicons name="notifications-outline" size={20} color={tokens.colors.onCanvas} />
            {notificationBadgeCount > 0 ? (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{notificationBadgeCount > 99 ? '99+' : notificationBadgeCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color={tokens.colors.textSubtle} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('jobs.search.placeholder')}
            placeholderTextColor={tokens.colors.textSubtle}
            value={searchQuery}
            onChangeText={setSearchQuery}
            accessibilityLabel={t('jobs.search.accessibility')}
            accessibilityHint={t('jobs.search.hint')}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityRole="button" accessibilityLabel={t('jobs.search.clearAccessibility')}>
              <Ionicons name="close-circle" size={18} color={tokens.colors.textSubtle} />
            </TouchableOpacity>
          ) : null}
        </View>

          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilterSheet(true)}
            accessibilityRole="button"
            accessibilityLabel={activeFilterCount > 0 ? t('jobs.filters.activeAccessibility', { count: activeFilterCount }) : t('jobs.filters.openAccessibility')}
          >
            <Ionicons name="options-outline" size={20} color={tokens.colors.onBrand} />
            {activeFilterCount > 0 ? (
              <View style={styles.filterCountBadge}>
                <Text style={styles.filterCountText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={styles.quickActionBtn} onPress={onOpenSavedJobs} accessibilityRole="button" accessibilityLabel={t('jobs.quickActions.savedAccessibility')}>
            <Ionicons name="bookmark-outline" size={15} color={tokens.colors.brand} />
            <Text style={styles.quickActionText}>{t('jobs.quickActions.savedLabel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={onOpenAppliedJobs} accessibilityRole="button" accessibilityLabel={t('jobs.quickActions.appliedAccessibility')}>
            <Ionicons name="checkmark-done-outline" size={15} color={tokens.colors.brand} />
            <Text style={styles.quickActionText}>{t('jobs.quickActions.appliedLabel')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('jobs.sections.recent')}</Text>
          <Text style={styles.sectionCount}>{t('jobs.jobsAvailable', { count: filteredJobs.length })}</Text>
        </View>

        {nearestJobs.length > 0 ? (
          <View style={styles.nearestCard}>
            <Text style={styles.nearestTitle}>{t('jobs.nearest.title')}</Text>
            <View style={styles.nearestList}>
              {nearestJobs.map((job) => (
                <TouchableOpacity
                  key={`near-${job._id}`}
                  style={styles.nearestItem}
                  onPress={() => onViewDetails?.(job)}
                  accessibilityRole="button"
                  accessibilityLabel={t('jobs.nearest.viewAccessibility', { title: job.title, location: job.location })}
                >
                  <Ionicons name="navigate-outline" size={14} color={tokens.colors.brand} />
                  <Text numberOfLines={1} style={styles.nearestText}>
                    {job.title} - {job.location}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={tokens.colors.brand} />
          </View>
        ) : null}

        <View style={styles.jobsList}>
          {filteredJobs.map((job) => {
            const canMessageEmployer = Boolean(
              job.jobPoster &&
                currentUserId &&
                !(
                  (typeof job.jobPoster === 'string' && job.jobPoster === currentUserId) ||
                  (typeof job.jobPoster === 'object' && (job.jobPoster._id === currentUserId || job.jobPoster.id === currentUserId))
                ),
            );
            return (
              <JobCard
                key={job._id}
                job={toJobCardData(job)}
                variant="list"
                saved={savedJobIds.includes(job._id)}
                onPress={() => onViewDetails?.(job)}
                onToggleSave={() => handleToggleSave(job)}
                footerSlot={
                  canMessageEmployer ? (
                    <TouchableOpacity
                      style={styles.messageEmployerButton}
                      onPress={(e: any) => {
                        e?.stopPropagation?.();
                        handleMessageEmployer(job);
                      }}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={14} color={tokens.colors.onBrand} />
                      <Text style={styles.messageEmployerButtonText}>{t('jobs.jobCard.messageEmployerButton')}</Text>
                    </TouchableOpacity>
                  ) : null
                }
              />
            );
          })}
        </View>
      </ScrollView>

      <Navigation activeTab={externalActiveTab || 'Jobs'} onTabPress={handleTabPress} messageBadgeCount={messageBadgeCount} />
      <Modal
        visible={showFilterSheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilterSheet(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('jobs.filters.title')}</Text>
              <TouchableOpacity
                style={styles.sheetCloseButton}
                onPress={() => setShowFilterSheet(false)}
                accessibilityRole="button"
                accessibilityLabel={t('jobs.filters.close')}
              >
                <Ionicons name="close" size={20} color={tokens.colors.onCanvas} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
        <View style={styles.preferencesCard}>
          <TouchableOpacity style={styles.preferencesHeader} onPress={() => setShowMatchingPreferences((value) => !value)}>
            <View style={styles.preferencesHeadingCopy}>
              <Text style={styles.preferencesTitle}>{t('jobs.preferences.title')}</Text>
              <Text style={styles.preferencesSubtitle}>{t('jobs.preferences.subtitle')}</Text>
            </View>
            <Ionicons name={showMatchingPreferences ? 'chevron-up' : 'chevron-down'} size={18} color={tokens.colors.brand} />
          </TouchableOpacity>
          {showMatchingPreferences ? (
            <View style={styles.preferencesBody}>
              <View style={styles.preferenceChips}>
                {categories.map((category) => {
                  const selected = preferredCategoryIds.includes(category._id);
                  return (
                    <TouchableOpacity
                      key={`preference-${category._id}`}
                      style={[styles.preferenceChip, selected && styles.preferenceChipActive]}
                      onPress={() => setPreferredCategoryIds((current) => selected ? current.filter((id) => id !== category._id) : [...current, category._id])}
                    >
                      <Text style={[styles.preferenceChipText, selected && styles.preferenceChipTextActive]}>{category.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                style={styles.preferenceInput}
                value={jobPreferenceText}
                onChangeText={setJobPreferenceText}
                placeholder={t('jobs.preferences.inputPlaceholder')}
                placeholderTextColor={tokens.colors.textSubtle}
              />
              <TouchableOpacity style={[styles.preferenceSave, savingPreferences && styles.preferenceSaveDisabled]} onPress={saveMatchingPreferences} disabled={savingPreferences}>
                {savingPreferences ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.preferenceSaveText}>{t('jobs.preferences.saveButton')}</Text>}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>{t('jobs.sections.deadline')}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {(
            [
              { key: 'all', label: t('jobs.datePresets.any') },
              { key: '7', label: t('jobs.datePresets.next7') },
              { key: '30', label: t('jobs.datePresets.next30') },
              {
                key: 'custom',
                label:
                  dateFilter === 'custom' && customDateRange.start
                    ? `${customDateRange.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}${
                        customDateRange.end
                          ? ` – ${customDateRange.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                          : ''
                      }`
                    : t('jobs.datePresets.custom'),
              },
            ] as const
          ).map((preset) => (
            <TouchableOpacity
              key={preset.key}
              style={[styles.filterChip, dateFilter === preset.key && styles.filterChipActive]}
              onPress={() => {
                if (preset.key === 'custom') {
                  setShowDateFilterSheet(true);
                  return;
                }
                setDateFilter(preset.key);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: dateFilter === preset.key }}
              accessibilityLabel={preset.label}
            >
              <Text style={[styles.filterChipText, dateFilter === preset.key && styles.filterChipTextActive]}>{preset.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <CalendarSheet
          open={showDateFilterSheet}
          onClose={() => setShowDateFilterSheet(false)}
          mode="range"
          range={customDateRange}
          minDate={new Date()}
          title={t('jobs.dateSheet.title')}
          onChange={setCustomDateRange}
          footer={{
            clearLabel: t('jobs.dateSheet.clearAll'),
            onClear: () => {
              setCustomDateRange({ start: null, end: null });
              setDateFilter('all');
            },
            primaryLabel: t('jobs.dateSheet.apply'),
            onPrimary: () => {
              setDateFilter('custom');
              setShowDateFilterSheet(false);
            },
            primaryDisabled: !customDateRange.start,
          }}
        />

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>{t('jobs.sections.categories')}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <TouchableOpacity
            style={[styles.filterChip, selectedCategory === 'All' && styles.filterChipActive]}
            onPress={() => setSelectedCategory('All')}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedCategory === 'All' }}
            accessibilityLabel={t('jobs.categoriesFilter.allAccessibility')}
          >
            <Text style={[styles.filterChipText, selectedCategory === 'All' && styles.filterChipTextActive]}>{t('jobs.categoriesFilter.allLabel')}</Text>
          </TouchableOpacity>
          {categories.map((category) => (
            <TouchableOpacity
              key={category._id}
              style={[styles.filterChip, selectedCategory === category._id && styles.filterChipActive]}
              onPress={() => setSelectedCategory(category._id)}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedCategory === category._id }}
              accessibilityLabel={t('jobs.categoriesFilter.categoryAccessibility', { name: category.name })}
            >
              <Text style={[styles.filterChipText, selectedCategory === category._id && styles.filterChipTextActive]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>{t('jobs.sections.jobType')}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {jobTypeOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.filterChip, selectedJobType === option.value && styles.filterChipActive]}
              onPress={() => setSelectedJobType(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedJobType === option.value }}
              accessibilityLabel={t('jobs.jobTypeFilter.accessibility', { type: option.label })}
            >
              <Text style={[styles.filterChipText, selectedJobType === option.value && styles.filterChipTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
            </ScrollView>
            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={styles.sheetResetButton}
                onPress={resetFilters}
                accessibilityRole="button"
                accessibilityLabel={t('jobs.filters.reset')}
              >
                <Text style={styles.sheetResetText}>{t('jobs.filters.reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sheetApplyButton}
                onPress={() => setShowFilterSheet(false)}
                accessibilityRole="button"
                accessibilityLabel={t('jobs.filters.apply')}
              >
                <Text style={styles.sheetApplyText}>{t('jobs.filters.apply')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: tokens.layout.tabBarClearance, gap: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
    paddingTop: tokens.spacing.sm,
  },
  headerCopy: { flex: 1, gap: 2 },
  greeting: { fontSize: 26, fontWeight: '800', color: tokens.colors.onCanvas, lineHeight: 32 },
  headline: { fontSize: 26, fontWeight: '800', color: tokens.colors.onCanvas, lineHeight: 32 },
  headerIconButton: {
    width: tokens.controls.minimumTouch,
    height: tokens.controls.minimumTouch,
    borderRadius: tokens.controls.minimumTouch / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  headerBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.danger,
    borderWidth: 1,
    borderColor: tokens.colors.surface,
  },
  headerBadgeText: { color: tokens.colors.white, fontSize: 9, fontWeight: '800' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: tokens.colors.text },
  filterButton: {
    width: 52,
    height: 52,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.brand,
  },
  filterCountBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.warning,
  },
  filterCountText: { color: tokens.colors.brandDark, fontSize: 9, fontWeight: '800' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: tokens.colors.onCanvas },
  sectionCount: { fontSize: 12, fontWeight: '600', color: tokens.colors.textMuted },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,41,84,0.45)' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: tokens.spacing.sm,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.border,
    marginBottom: tokens.spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.layout.gutter,
    paddingBottom: tokens.spacing.sm,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: tokens.colors.onCanvas },
  sheetCloseButton: {
    width: tokens.controls.minimumTouch,
    height: tokens.controls.minimumTouch,
    borderRadius: tokens.controls.minimumTouch / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
  },
  sheetBody: { paddingHorizontal: tokens.layout.gutter, paddingBottom: tokens.spacing.lg, gap: 14 },
  sheetFooter: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.layout.gutter,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  sheetResetButton: {
    paddingHorizontal: tokens.spacing.xl,
    height: tokens.controls.buttonHeight,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
  },
  sheetResetText: { fontSize: 15, fontWeight: '700', color: tokens.colors.onCanvasMuted },
  sheetApplyButton: {
    flex: 1,
    height: tokens.controls.buttonHeight,
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.brand,
  },
  sheetApplyText: { fontSize: 15, fontWeight: '800', color: tokens.colors.onBrand },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.brand,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  preferencesCard: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 16, backgroundColor: tokens.colors.surface, padding: 14 },
  preferencesHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  preferencesHeadingCopy: { flex: 1 },
  preferencesTitle: { color: tokens.colors.text, fontSize: 14, fontWeight: '800' },
  preferencesSubtitle: { marginTop: 3, color: tokens.colors.textMuted, fontSize: 11 },
  preferencesBody: { marginTop: 12, gap: 10 },
  preferenceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  preferenceChip: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  preferenceChipActive: { borderColor: tokens.colors.brand, backgroundColor: tokens.colors.brandSoft },
  preferenceChipText: { color: tokens.colors.textMuted, fontSize: 11, fontWeight: '600' },
  preferenceChipTextActive: { color: tokens.colors.brand, fontWeight: '800' },
  preferenceInput: { minHeight: 48, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12, paddingHorizontal: 12, color: tokens.colors.text, fontSize: 13 },
  preferenceSave: { minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.brand },
  preferenceSaveDisabled: { opacity: 0.6 },
  preferenceSaveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  filterChipActive: {
    backgroundColor: tokens.colors.brand,
    borderColor: tokens.colors.brand,
  },
  filterChipText: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: tokens.colors.onBrand,
  },
  nearestCard: {
    marginTop: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 10,
    gap: 8,
  },
  nearestTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.brand,
  },
  nearestList: {
    gap: 6,
  },
  nearestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  nearestText: {
    flex: 1,
    fontSize: 12,
    color: '#1C4D8D',
    fontWeight: '600',
  },
  errorText: {
    marginTop: 8,
    color: tokens.colors.danger,
    fontSize: 12,
  },
  loadingRow: {
    paddingVertical: 12,
  },
  jobsList: { gap: 12 },
  messageEmployerButton: {
    marginTop: 2,
    backgroundColor: tokens.colors.brandAccent,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  messageEmployerButtonText: {
    color: tokens.colors.onBrand,
    fontWeight: '700',
    fontSize: 12,
  },
});
