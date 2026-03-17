import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Navigation from '../../components/navigation';
import TabTopNav from '../../components/TabTopNav';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';
import { apiRequest, asList } from '../../lib/api';
import { tokens } from '../../theme/tokens';

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
  category?: { _id: string; name: string } | string;
  jobPoster?: { _id?: string; id?: string; firstName?: string; lastName?: string; email?: string };
};

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
  } = props;
  const [activeTab, setActiveTab] = useState(externalActiveTab || 'Jobs');
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedJobType, setSelectedJobType] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>([]);
  const [workerLocation, setWorkerLocation] = useState({ province: '', city: '', barangay: '' });

  const jobTypes = ['All', 'Remote', 'Fulltime', 'Part-time', 'Freelance'];

  const normalizeToken = (value?: string) =>
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const locationScore = (jobLocation: string) => {
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
  };

  const filteredJobs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return jobs.filter((job) => {
      // Exclude jobs already applied to
      if (appliedJobIds.includes(job._id)) return false;
      
      if (!query) return true;
      return [job.title, job.description, job.location]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [jobs, searchQuery, appliedJobIds]);

  const nearestJobs = useMemo(
    () =>
      [...filteredJobs]
        .filter((job) => locationScore(job.location) > 0)
        .sort((a, b) => locationScore(b.location) - locationScore(a.location))
        .slice(0, 4),
    [filteredJobs, workerLocation.province, workerLocation.city, workerLocation.barangay],
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

  const fetchJobs = async () => {
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
  };

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
      } catch {
        setWorkerLocation({ province: '', city: '', barangay: '' });
      }
    };

    loadWorkerLocation();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchJobs();
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedCategory, selectedJobType, searchQuery]);

  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
    externalOnTabPress?.(tab);
  };

  const handleToggleSave = (job: Job) => {
    onToggleSave?.(job);
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
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={tokens.colors.textSubtle} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.toolbarRow}>
          <TouchableOpacity style={styles.toolbarButton} onPress={() => fetchJobs()}>
            <Ionicons name="refresh-outline" size={15} color={tokens.colors.textMuted} />
            <Text style={styles.toolbarButtonText}>Refresh</Text>
          </TouchableOpacity>

          <View style={styles.toolbarButtonMuted}>
            <Text style={styles.toolbarButtonText}>Most Relevant</Text>
            <Ionicons name="chevron-down-outline" size={14} color={tokens.colors.textMuted} />
          </View>
        </View>

        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={styles.quickActionBtn} onPress={onOpenSavedJobs}>
            <Ionicons name="bookmark-outline" size={15} color={tokens.colors.brand} />
            <Text style={styles.quickActionText}>Saved Jobs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={onOpenAppliedJobs}>
            <Ionicons name="checkmark-done-outline" size={15} color={tokens.colors.brand} />
            <Text style={styles.quickActionText}>Applied Jobs</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Categories</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <TouchableOpacity
            style={[styles.filterChip, selectedCategory === 'All' && styles.filterChipActive]}
            onPress={() => setSelectedCategory('All')}
          >
            <Text style={[styles.filterChipText, selectedCategory === 'All' && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map((category) => (
            <TouchableOpacity
              key={category._id}
              style={[styles.filterChip, selectedCategory === category._id && styles.filterChipActive]}
              onPress={() => setSelectedCategory(category._id)}
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
          {filteredJobs.map((job) => (
            <TouchableOpacity
              key={job._id}
              style={styles.jobCard}
              onPress={() => onViewDetails?.(job)}
              activeOpacity={0.86}
            >
              <View style={styles.jobCardHeader}>
                <View style={styles.jobInfo}>
                  <View style={styles.titleRow}>
                    <Text style={styles.jobTitle}>{job.title}</Text>
                    {job.urgent ? (
                      <View style={styles.urgentBadge}>
                        <Text style={styles.urgentText}>Urgent</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.jobCompany}>
                    {job.jobPoster?.firstName ? `${job.jobPoster.firstName} ${job.jobPoster.lastName || ''}`.trim() : 'Job Poster'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.bookmarkBtn}
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    handleToggleSave(job);
                  }}
                >
                  <Ionicons
                    name={savedJobIds.includes(job._id) ? 'bookmark' : 'bookmark-outline'}
                    size={18}
                    color={savedJobIds.includes(job._id) ? tokens.colors.brand : tokens.colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.jobTags}>
                {(job.skills || []).slice(0, 3).map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.jobFooter}>
                <View style={styles.jobMetaLeft}>
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={12} color={tokens.colors.textSubtle} />
                    <Text style={styles.timeText}>{job.location}</Text>
                  </View>
                </View>
                <View style={styles.viewDetailsRow}>
                  <Text style={styles.viewDetails}>View details</Text>
                  <Ionicons name="arrow-forward-outline" size={13} color={tokens.colors.brandAccent} />
                </View>
              </View>

              <View style={styles.jobBottomMeta}>
                <View style={styles.metaTags}>
                  <View style={styles.metaPill}>
                    <Ionicons name="time-outline" size={12} color={tokens.colors.textMuted} />
                    <Text style={styles.metaText}>{job.jobType}</Text>
                  </View>
                  {job.category && typeof job.category !== 'string' ? (
                    <View style={styles.metaPill}>
                      <Ionicons name="grid-outline" size={12} color={tokens.colors.textMuted} />
                      <Text style={styles.metaText}>{job.category.name}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.salary}>{job.salary}</Text>
              </View>

              {job.jobPoster && currentUserId && !((typeof job.jobPoster === 'string' && job.jobPoster === currentUserId) || (typeof job.jobPoster === 'object' && (job.jobPoster._id === currentUserId || job.jobPoster.id === currentUserId))) ? (
                <TouchableOpacity
                  style={styles.messageEmployerButton}
                  onPress={async () => {
                    const recipientCandidate = job.jobPoster as any;
                    const recipientId =
                      typeof recipientCandidate === 'string'
                        ? recipientCandidate
                        : recipientCandidate && (recipientCandidate._id || recipientCandidate.id || recipientCandidate.email);

                    const recipientName =
                      typeof recipientCandidate === 'string'
                        ? 'Employer'
                        : `${recipientCandidate?.firstName || ''} ${recipientCandidate?.lastName || ''}`.trim() || 'Employer';

                    const defaultMessage = `Hi ${recipientName}, I'm interested in your job "${job.title}".`;

                    try {
                      const token = await AsyncStorage.getItem('auth_token');
                      if (recipientId && token) {
                        await apiRequest(
                          `${API_URL}/messages`,
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({ receiverId: recipientId, content: defaultMessage, jobId: job._id }),
                          },
                          'Failed to send message.'
                        );
                      }
                    } catch (e) {
                      console.warn('Initial message send failed', e);
                    } finally {
                      onMessageEmployer?.({
                        userId: recipientId,
                        userName: recipientName,
                        jobId: job._id,
                      });
                    }
                  }}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color={tokens.colors.onBrand} />
                  <Text style={styles.messageEmployerButtonText}>Message Employer</Text>
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Navigation activeTab={activeTab} onTabPress={handleTabPress} messageBadgeCount={messageBadgeCount} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 94, gap: 14 },
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
    color: '#1D4ED8',
  },
  nearestList: {
    gap: 6,
  },
  nearestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  nearestText: {
    flex: 1,
    fontSize: 12,
    color: '#1E3A8A',
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
  jobCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    ...tokens.shadow.card,
  },
  jobCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  jobInfo: { flex: 1 },
  jobTitle: { fontSize: 15, fontWeight: '700', color: tokens.colors.text, marginBottom: 2, flexShrink: 1 },
  urgentBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  urgentText: { color: '#B91C1C', fontSize: 10, fontWeight: '700' },
  jobCompany: { fontSize: 13, color: tokens.colors.textMuted },
  bookmarkBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobTags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tag: {
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagText: { fontSize: 11, color: tokens.colors.textMuted, fontWeight: '600' },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobMetaLeft: {
    flex: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: { fontSize: 12, color: tokens.colors.textSubtle },
  viewDetailsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewDetails: { fontSize: 12, color: tokens.colors.brandAccent, fontWeight: '700' },
  jobBottomMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    gap: 8,
  },
  metaTags: { flexDirection: 'row', gap: 8, flex: 1, flexWrap: 'wrap' },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
  },
  metaText: { fontSize: 11, color: tokens.colors.textMuted, fontWeight: '600' },
  salary: { fontSize: 13, fontWeight: '700', color: tokens.colors.text },
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
