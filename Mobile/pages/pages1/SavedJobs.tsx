import React, { useState } from 'react';
import { FlatList, Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Navigation from '../../components/navigation';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';

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
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(externalActiveTab || 'Jobs');

  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
    externalOnTabPress?.(tab);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) + 10 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (onViewAppliedJobs) {
              onViewAppliedJobs();
              return;
            }
            handleTabPress('Jobs');
          }}
          accessibilityRole="button"
          accessibilityLabel="Back to jobs"
        >
          <Ionicons name="chevron-back" size={20} color={tokens.colors.brand} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Saved jobs</Text>
          <Text style={styles.headerSubtitle}>{savedJobs.length} jobs saved for later</Text>
        </View>
        <View style={styles.headerRightSpacer} />
      </View>

      <FlatList
        data={savedJobs}
        keyExtractor={(job) => job._id}
        style={styles.list}
        contentContainerStyle={[styles.scroll, { paddingBottom: 96 + Math.max(insets.bottom, 10) }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔖</Text>
            <Text style={styles.emptyTitle}>No saved jobs yet</Text>
            <Text style={styles.emptyText}>Jobs you save will appear here</Text>
          </View>
        )}
        renderItem={({ item: job }) => (
              <TouchableOpacity
                style={styles.jobCard}
                onPress={() => onViewDetails?.(job)}
                accessibilityRole="button"
                accessibilityLabel={`View saved job ${job.title}`}
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
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${job.title} from saved jobs`}
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
        )}
      />

      {/* Bottom nav */}
      <Navigation activeTab={activeTab} onTabPress={handleTabPress} messageBadgeCount={messageBadgeCount} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRightSpacer: { width: 44, height: 44 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: tokens.colors.text, lineHeight: 26, letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 13, color: tokens.colors.textMuted, marginTop: 2, fontWeight: '500' },
  list: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 14 },
  itemSeparator: { height: 14 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: tokens.colors.contentSurface,
    ...tokens.shadow.card,
  },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6b7280' },
  jobCard: {
    backgroundColor: tokens.colors.contentSurface,
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
  jobTitle: { fontSize: 18, fontWeight: '700', color: tokens.colors.text, marginBottom: 4 },
  jobCompany: { fontSize: 15, color: tokens.colors.textMuted, marginBottom: 4 },
  jobLocation: { fontSize: 14, color: tokens.colors.textMuted },
  deleteBtn: {
    minWidth: 48,
    height: 32,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  deleteText: { color: tokens.colors.danger, fontSize: 12, fontWeight: '700' },
  jobTags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', flex: 1 },
  tag: {
    backgroundColor: tokens.colors.brandSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tagText: { fontSize: 14, color: tokens.colors.text, fontWeight: '700' },
  jobFooter: {
    paddingTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    zIndex: 2,
  },
  jobSalary: { fontSize: 28, fontWeight: '700', color: tokens.colors.brand },
});
