import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Navigation from '../../components/navigation';
import ScrollView from '../../components/ui/SmoothScrollView';
import TabTopNav from '../../components/TabTopNav';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import { apiRequest, asList, asObject } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import JobCard from '../../components/job/JobCard';
import { toJobCardData } from '../../components/job/jobCardModel';
import CalendarSheet from '../../components/ui/CalendarSheet';
import { isDateDisabled, type DateRange } from '../../lib/calendarModel';

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

  const jobTypes = ['All', 'Short-term', 'Side hustle', 'Recruiting'];

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

  const fetchCategories = async () => {
    try {
      const result = await apiRequest<Category[]>(`${API_URL}/categories`, undefined, 'Failed to load categories.');
      if (result.ok) {
        setCategories(asList<Category>(result.raw, ['categories']));
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const fetchAppliedJobs = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;
      const result = await apiRequest(`${API_URL}/applications`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }, 'Failed to load applications.');
      if (result.ok) {
        const applications = asList<any>(result.raw, ['applications']);
        const jobIds = applications.map((app: any) => app.job?._id).filter(Boolean);
        setAppliedJobIds(jobIds);
      }
    } catch (error) {
      console.error('Failed to load applied jobs:', error);
    }
  };

  const fetchJobs = useCallback(async () => {
    if (!locationLoaded) return;
    if (!workerLocation.city.trim()) {
      setJobs([]);
      setErrorMessage('Set your city or municipality in Settings before searching for local jobs.');
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
        'Failed to load jobs.'
      );
      if (!result.ok) throw new Error(result.message || 'Failed to load jobs.');
      setJobs(asList<Job>(result.raw, ['jobs']));
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to load jobs.');
    } finally {
      setIsLoading(false);
    }
  }, [locationLoaded, searchQuery, selectedCategory, selectedJobType, workerLocation.city]);

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
  }, []);

  useEffect(() => {
    const loadWorkerLocation = async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const profileResult = await apiRequest<any>(
          `${API_URL}/auth/me`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          },
          'Failed to load profile location.',
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
  }, []);

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
        'Failed to open a conversation with this employer.'
      );

      if (!result.ok) return;

      const payload = asObject<any>(result.data) || asObject<any>(result.raw) || {};
      const conversation = payload.conversation || payload;
      if (!conversation?.otherUserId) return;

      onMessageEmployer?.({
        userId: String(conversation.otherUserId),
        userName: conversation.otherUserName || 'Employer',
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
      }, 'Failed to save job preferences.');
      if (!result.ok) throw new Error(result.message || 'Failed to save job preferences.');
      setShowMatchingPreferences(false);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to save job preferences.');
    } finally {
      setSavingPreferences(false);
    }
  };

  return (
    <View style={styles.container}>
      <TabTopNav
        title="Jobs"
        showNotifications
        onOpenNotifications={onOpenNotifications}
        notificationBadgeCount={notificationBadgeCount}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color={tokens.colors.textSubtle} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search jobs"
            placeholderTextColor={tokens.colors.textSubtle}
            value={searchQuery}
            onChangeText={setSearchQuery}
            accessibilityLabel="Search jobs"
            accessibilityHint="Search by job title, company, or location"
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityRole="button" accessibilityLabel="Clear job search">
              <Ionicons name="close-circle" size={18} color={tokens.colors.textSubtle} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.toolbarRow}>
          <TouchableOpacity style={styles.toolbarButton} onPress={() => fetchJobs()} accessibilityRole="button" accessibilityLabel="Refresh jobs">
            <Ionicons name="refresh-outline" size={15} color={tokens.colors.textMuted} />
            <Text style={styles.toolbarButtonText}>Refresh</Text>
          </TouchableOpacity>

          <View style={styles.toolbarButtonMuted}>
            <Text style={styles.toolbarButtonText}>Sorted by relevance</Text>
          </View>
        </View>

        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={styles.quickActionBtn} onPress={onOpenSavedJobs} accessibilityRole="button" accessibilityLabel="Open saved jobs">
            <Ionicons name="bookmark-outline" size={15} color={tokens.colors.brand} />
            <Text style={styles.quickActionText}>Saved Jobs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={onOpenAppliedJobs} accessibilityRole="button" accessibilityLabel="Open applied jobs">
            <Ionicons name="checkmark-done-outline" size={15} color={tokens.colors.brand} />
            <Text style={styles.quickActionText}>Applied Jobs</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.preferencesCard}>
          <TouchableOpacity style={styles.preferencesHeader} onPress={() => setShowMatchingPreferences((value) => !value)}>
            <View style={styles.preferencesHeadingCopy}>
              <Text style={styles.preferencesTitle}>Improve your job matches</Text>
              <Text style={styles.preferencesSubtitle}>Choose preferred categories and work interests.</Text>
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
                placeholder="repair, installation, maintenance"
                placeholderTextColor={tokens.colors.textSubtle}
              />
              <TouchableOpacity style={[styles.preferenceSave, savingPreferences && styles.preferenceSaveDisabled]} onPress={saveMatchingPreferences} disabled={savingPreferences}>
                {savingPreferences ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.preferenceSaveText}>Save matching preferences</Text>}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Deadline</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {(
            [
              { key: 'all', label: 'Any dates' },
              { key: '7', label: 'Next 7 days' },
              { key: '30', label: 'Next 30 days' },
              {
                key: 'custom',
                label:
                  dateFilter === 'custom' && customDateRange.start
                    ? `${customDateRange.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}${
                        customDateRange.end
                          ? ` – ${customDateRange.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                          : ''
                      }`
                    : 'Custom',
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
          title="Application deadline"
          onChange={setCustomDateRange}
          footer={{
            clearLabel: 'Clear all',
            onClear: () => {
              setCustomDateRange({ start: null, end: null });
              setDateFilter('all');
            },
            primaryLabel: 'Apply',
            onPrimary: () => {
              setDateFilter('custom');
              setShowDateFilterSheet(false);
            },
            primaryDisabled: !customDateRange.start,
          }}
        />

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Categories</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <TouchableOpacity
            style={[styles.filterChip, selectedCategory === 'All' && styles.filterChipActive]}
            onPress={() => setSelectedCategory('All')}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedCategory === 'All' }}
            accessibilityLabel="All categories"
          >
            <Text style={[styles.filterChipText, selectedCategory === 'All' && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map((category) => (
            <TouchableOpacity
              key={category._id}
              style={[styles.filterChip, selectedCategory === category._id && styles.filterChipActive]}
              onPress={() => setSelectedCategory(category._id)}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedCategory === category._id }}
              accessibilityLabel={`${category.name} category`}
            >
              <Text style={[styles.filterChipText, selectedCategory === category._id && styles.filterChipTextActive]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Job Type</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {jobTypes.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.filterChip, selectedJobType === type && styles.filterChipActive]}
              onPress={() => setSelectedJobType(type)}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedJobType === type }}
              accessibilityLabel={`${type} job type`}
            >
              <Text style={[styles.filterChipText, selectedJobType === type && styles.filterChipTextActive]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.jobsCount}>{filteredJobs.length} Jobs Available</Text>

        {nearestJobs.length > 0 ? (
          <View style={styles.nearestCard}>
            <Text style={styles.nearestTitle}>Suggested Near You</Text>
            <View style={styles.nearestList}>
              {nearestJobs.map((job) => (
                <TouchableOpacity
                  key={`near-${job._id}`}
                  style={styles.nearestItem}
                  onPress={() => onViewDetails?.(job)}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${job.title} near ${job.location}`}
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
                      <Text style={styles.messageEmployerButtonText}>Message Employer</Text>
                    </TouchableOpacity>
                  ) : null
                }
              />
            );
          })}
        </View>
      </ScrollView>

      <Navigation activeTab={externalActiveTab || 'Jobs'} onTabPress={handleTabPress} messageBadgeCount={messageBadgeCount} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: tokens.layout.tabBarClearance, gap: 14 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: tokens.colors.text },
  toolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  toolbarButtonMuted: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  toolbarButtonText: { fontSize: 12, color: tokens.colors.textMuted, fontWeight: '600' },
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
  jobsCount: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.text,
    marginTop: 4,
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
