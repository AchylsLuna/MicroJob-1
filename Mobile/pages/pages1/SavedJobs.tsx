import React from 'react';
import { FlatList, Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Navigation from '../../components/navigation';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { formatMinimumPay } from '../../lib/jobCompensation';
import JobCard from '../../components/job/JobCard';
import type { JobCardData } from '../../components/job/jobCardModel';

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
  const handleTabPress = (tab: string) => {
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
        contentContainerStyle={[styles.scroll, { paddingBottom: tokens.layout.tabBarClearance }]}
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
        renderItem={({ item: job }) => {
          const cardData: JobCardData = {
            id: job._id,
            title: job.title,
            posterName: job.company,
            location: job.location,
            jobType: '',
            salaryLabel: formatMinimumPay(job.salary),
            skills: job.tags,
            urgent: false,
          };
          return (
            <JobCard
              job={cardData}
              variant="compact"
              onPress={() => onViewDetails?.(job)}
              footerSlot={
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => onRemoveJob?.(job._id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${job.title} from saved jobs`}
                >
                  <Text style={styles.deleteText}>Remove</Text>
                </TouchableOpacity>
              }
            />
          );
        }}
      />

      {/* Bottom nav */}
      <Navigation activeTab={externalActiveTab || 'Jobs'} onTabPress={handleTabPress} messageBadgeCount={messageBadgeCount} />
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
  deleteBtn: {
    minWidth: 48,
    height: 32,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { color: tokens.colors.danger, fontSize: 12, fontWeight: '700' },
});
