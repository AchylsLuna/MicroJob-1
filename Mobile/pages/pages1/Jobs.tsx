import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import Navigation from '../../components/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';

type Category = { _id: string; name: string };
type Job = {
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
  jobPoster?: { firstName?: string; lastName?: string; email?: string };
};

type JobsProps = {
  onViewDetails?: (job: Job) => void;
  onToggleSave?: (job: Job) => void;
  savedJobIds?: string[];
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  navigation?: any;
};

export default function Jobs(props: JobsProps) {
  const { onViewDetails, onToggleSave, savedJobIds = [], activeTab: externalActiveTab, onTabPress: externalOnTabPress, navigation } = props;
  const [activeTab, setActiveTab] = useState(externalActiveTab || 'Jobs');
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedJobType, setSelectedJobType] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const jobTypes = ['All', 'Remote', 'Fulltime', 'Part-time', 'Freelance'];

  const filteredJobs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return jobs.filter((job) => {
      if (!query) return true;
      return [job.title, job.description, job.location]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [jobs, searchQuery]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/categories`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
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
      params.append('excludeOwn', 'true');

      const response = await fetch(`${API_URL}/jobs?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to load jobs.');
      }
      setJobs(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to load jobs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning, Jonas!</Text>
          <Text style={styles.headerTitle}>Find your drea.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search Job"
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filters */}
        <View style={styles.filtersRow}>
          <View style={styles.dropdown}>
            <Text style={styles.dropdownText}>Most Relevant</Text>
            <Text style={styles.dropdownIcon}>▼</Text>
          </View>
        </View>

        <View style={styles.filterButtons}>
          <TouchableOpacity style={styles.filterBtn} onPress={() => fetchJobs()}>
            <Text style={styles.filterIcon}>☰</Text>
            <Text style={styles.filterText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Categories</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === 'All' && styles.categoryChipActive]}
            onPress={() => setSelectedCategory('All')}
          >
            <Text style={[styles.categoryChipText, selectedCategory === 'All' && styles.categoryChipTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map((category) => (
            <TouchableOpacity
              key={category._id}
              style={[styles.categoryChip, selectedCategory === category._id && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(category._id)}
            >
              <Text
                style={[styles.categoryChipText, selectedCategory === category._id && styles.categoryChipTextActive]}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Job Type</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {jobTypes.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.categoryChip, selectedJobType === type && styles.categoryChipActive]}
              onPress={() => setSelectedJobType(type)}
            >
              <Text style={[styles.categoryChipText, selectedJobType === type && styles.categoryChipTextActive]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Jobs Count */}
        <Text style={styles.jobsCount}>{filteredJobs.length} Jobs Available</Text>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#1e3a5f" />
          </View>
        ) : null}

        {/* Jobs List */}
        <View style={styles.jobsList}>
          {filteredJobs.map((job) => (
            <TouchableOpacity 
              key={job._id} 
              style={styles.jobCard}
              onPress={() => onViewDetails?.(job)}
              activeOpacity={0.7}
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
                  onPress={(e) => {
                    e.stopPropagation?.();
                    handleToggleSave(job);
                  }}
                >
                  <Text style={styles.bookmarkIcon}>
                    {savedJobIds.includes(job._id) ? '🔖' : '📄'}
                  </Text>
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
                  <Text style={styles.timeText}>{job.location}</Text>
                </View>
                <Text style={styles.viewDetails}>View details →</Text>
              </View>

              <View style={styles.jobBottomMeta}>
                <View style={styles.metaTags}>
                  <Text style={styles.metaText}>{job.jobType}</Text>
                  {job.category && typeof job.category !== 'string' ? (
                    <Text style={styles.metaText}>{job.category.name}</Text>
                  ) : null}
                </View>
                <Text style={styles.salary}>{job.salary}</Text>
              </View>

              {/* Message Button */}
              {job.jobPoster && typeof job.jobPoster === 'object' && job.jobPoster.email ? (
                <TouchableOpacity
                  style={{marginTop: 8, backgroundColor: '#3b82f6', borderRadius: 8, padding: 10, alignItems: 'center'}} 
                  onPress={() => {
                    if (navigation && navigation.navigate) {
                      navigation.navigate('ChatScreen', {
                        recipientId: job.jobPoster?.email,
                        recipientName: `${job.jobPoster?.firstName || ''} ${job.jobPoster?.lastName || ''}`.trim() || 'Employer',
                        jobId: job._id,
                      });
                    }
                  }}
                >
                  <Text style={{color: '#fff', fontWeight: '700'}}>Message Employer</Text>
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Bottom nav */}
      <Navigation activeTab={activeTab} onTabPress={handleTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#1e3a5f',
  },
  greeting: { fontSize: 14, color: '#b0c4de', marginBottom: 4 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 90, gap: 16 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  searchIcon: { fontSize: 18 },
  searchInput: { flex: 1, fontSize: 14, color: '#1f2937' },
  filtersRow: {
    marginTop: 4,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dropdownText: { fontSize: 14, color: '#3b82f6', fontWeight: '600' },
  dropdownIcon: { fontSize: 10, color: '#3b82f6' },
  filterButtons: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  categoryChipActive: {
    backgroundColor: '#1e3a5f',
    borderColor: '#1e3a5f',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  filterIcon: { fontSize: 14, color: '#6b7280' },
  filterText: { fontSize: 13, color: '#4b5563', fontWeight: '500' },
  filterDropIcon: { fontSize: 10, color: '#6b7280' },
  jobsCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 8,
  },
  errorText: {
    marginTop: 8,
    color: '#b91c1c',
    fontSize: 12,
  },
  loadingRow: {
    paddingVertical: 12,
  },
  jobsList: { gap: 14 },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  jobCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  jobInfo: { flex: 1 },
  jobTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 2 },
  urgentBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  urgentText: { color: '#b91c1c', fontSize: 10, fontWeight: '700' },
  jobCompany: { fontSize: 13, color: '#6b7280' },
  bookmarkBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkIcon: { fontSize: 18 },
  jobTags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tag: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tagText: { fontSize: 12, color: '#4b5563', fontWeight: '500' },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobMetaLeft: {},
  timeText: { fontSize: 12, color: '#9ca3af' },
  viewDetails: { fontSize: 13, color: '#3b82f6', fontWeight: '600' },
  jobBottomMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  metaTags: { flexDirection: 'row', gap: 12 },
  metaText: { fontSize: 13, color: '#6b7280' },
  salary: { fontSize: 13, fontWeight: '700', color: '#1f2937' },
});
