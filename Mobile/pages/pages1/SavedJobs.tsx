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
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (onViewAppliedJobs) {
              onViewAppliedJobs();
              return;
            }
            handleTabPress('Jobs');
          }}
        >
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Saved jobs</Text>
          <Text style={styles.headerSubtitle}>{savedJobs.length} jobs saved for later</Text>
        </View>
        <View style={styles.headerRightSpacer} />
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
                <View style={styles.waveOne} />
                <View style={styles.waveTwo} />
                <View style={styles.waveThree} />

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
                    <Text style={styles.deleteText}>Remove</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.jobFooter}>
                  <View style={styles.jobTags}>
                    {job.tags.slice(0, 3).map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                    ))}
                  </View>
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
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 14,
    backgroundColor: '#1e3a5f',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRightSpacer: { width: 32 },
  headerTitle: { fontSize: 46, fontWeight: '700', color: '#fff', lineHeight: 50 },
  headerSubtitle: { fontSize: 16, color: '#9ca3af', marginTop: 2, fontWeight: '600' },
  scroll: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 90 },
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
    backgroundColor: '#1b3c72',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  waveOne: {
    position: 'absolute',
    width: 260,
    height: 160,
    borderRadius: 130,
    backgroundColor: 'rgba(94,165,224,0.16)',
    top: -50,
    right: -40,
  },
  waveTwo: {
    position: 'absolute',
    width: 280,
    height: 120,
    borderRadius: 120,
    backgroundColor: 'rgba(66,137,206,0.16)',
    bottom: -40,
    left: -80,
  },
  waveThree: {
    position: 'absolute',
    width: 260,
    height: 120,
    borderRadius: 120,
    backgroundColor: 'rgba(35,90,162,0.25)',
    bottom: -55,
    right: -70,
  },
  jobCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 2,
  },
  jobInfo: { flex: 1, paddingLeft: 2 },
  jobTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  jobCompany: { fontSize: 15, color: '#d1dce6', marginBottom: 4 },
  jobLocation: { fontSize: 14, color: '#d1dce6' },
  deleteBtn: {
    minWidth: 48,
    height: 32,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  deleteText: { color: '#9ca3af', fontSize: 12, fontWeight: '700' },
  jobTags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', flex: 1 },
  tag: {
    backgroundColor: '#9bb6cc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tagText: { fontSize: 14, color: '#111827', fontWeight: '700' },
  jobFooter: {
    paddingTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    zIndex: 2,
  },
  jobSalary: { fontSize: 28, fontWeight: '700', color: '#fff' },
});
