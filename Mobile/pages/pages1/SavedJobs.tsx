import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Navigation from '../../components/navigation';

type SavedJob = {
  _id: string;
  title: string;
  company: string;
  location: string;
  tags: string[];
  salary: string;
  logo?: string;
};

export default function SavedJobs({ 
  savedJobs = [],
  onRemoveJob,
  onViewDetails,
  activeTab: externalActiveTab,
  onTabPress: externalOnTabPress,
  onViewAppliedJobs,
  messageBadgeCount = 0,
}: { 
  savedJobs?: SavedJob[];
  onRemoveJob?: (jobId: string) => void;
  onViewDetails?: (job: SavedJob) => void;
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  onViewAppliedJobs?: () => void;
  messageBadgeCount?: number;
}) {
  const [activeTab, setActiveTab] = useState(externalActiveTab || 'Jobs');

  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
    externalOnTabPress?.(tab);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Saved jobs</Text>
          <Text style={styles.headerSubtitle}>{savedJobs.length} jobs saved for later</Text>
        </View>
      </View>

      {/* Toggle Buttons */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity 
          style={[styles.toggleBtn, styles.toggleBtnInactive]}
          onPress={onViewAppliedJobs}
        >
          <Text style={styles.toggleBtnTextInactive}>Applied Job details</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleBtn, styles.toggleBtnActive]}>
          <Text style={styles.toggleBtnTextActive}>Save job</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {savedJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔖</Text>
            <Text style={styles.emptyTitle}>No saved jobs yet</Text>
            <Text style={styles.emptyText}>Jobs you save will appear here</Text>
          </View>
        ) : (
          <View style={styles.jobsList}>
            {savedJobs.map((job) => (
              <TouchableOpacity 
                key={job._id} 
                style={styles.jobCard}
                onPress={() => onViewDetails?.(job)}
              >
                <View style={styles.jobCardHeader}>
                  <View style={styles.jobInfo}>
                    <Text style={styles.jobTitle}>{job.title}</Text>
                    <Text style={styles.jobCompany}>{job.company}</Text>
                    <Text style={styles.jobLocation}>{job.location}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.deleteBtn}
                    onPress={() => onRemoveJob?.(job._id)}
                  >
                    <Text style={styles.deleteIcon}>🗑️</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.jobTags}>
                  {job.tags.map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.jobFooter}>
                  <Text style={styles.jobSalary}>{job.salary}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom nav */}
      <Navigation activeTab={activeTab} onTabPress={handleTabPress} messageBadgeCount={messageBadgeCount} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: '#b0c4de', marginTop: 2 },
  toggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#fff',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  toggleBtnActive: {
    backgroundColor: '#1e3a5f',
    borderColor: '#1e3a5f',
  },
  toggleBtnInactive: {
    backgroundColor: '#f5f7fa',
    borderColor: '#d1d5db',
  },
  toggleBtnTextActive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  toggleBtnTextInactive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 90 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6b7280' },
  jobsList: { gap: 14 },
  jobCard: {
    backgroundColor: '#3b5a85',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  jobCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  jobInfo: { flex: 1 },
  jobTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 4 },
  jobCompany: { fontSize: 13, color: '#d1dce6', marginBottom: 2 },
  jobLocation: { fontSize: 13, color: '#d1dce6' },
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: { fontSize: 18 },
  jobTags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tag: {
    backgroundColor: '#4a6f9a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tagText: { fontSize: 12, color: '#fff', fontWeight: '500' },
  jobFooter: {
    paddingTop: 8,
  },
  jobSalary: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
