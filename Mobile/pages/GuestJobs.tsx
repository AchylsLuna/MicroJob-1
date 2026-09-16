import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import ScrollView from '../components/ui/SmoothScrollView';
import MicroJobsLogo from '../components/auth/MicroJobsLogo';
import JobCard from '../components/job/JobCard';
import { toJobCardData } from '../components/job/jobCardModel';
import { API_URL } from '../config';
import { apiRequest, asList } from '../lib/api';
import { tokens } from '../theme/tokens';

export type GuestJob = {
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

type Props = {
  onViewDetails: (job: GuestJob) => void;
  onNavigateToSignIn: () => void;
  onNavigateToSignUp: () => void;
};

/**
 * Read-only job search for signed-out visitors, reached from the sign-in
 * screen's "Browse jobs without an account" link. GET /jobs runs behind
 * optionalAuth server-side, so this hits the same endpoint the authenticated
 * Jobs screen uses, just without a token and without any of that screen's
 * profile-dependent filtering (location matching, applied-job exclusion,
 * saved-job state) — those genuinely need a signed-in profile to mean
 * anything. Tapping a card opens the same JobDetails screen used elsewhere,
 * which gates Apply/Save/Message behind sign-in via `onRequireSignIn`.
 */
export default function GuestJobs({ onViewDetails, onNavigateToSignIn, onNavigateToSignUp }: Props) {
  const { t } = useTranslation('worker');
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [jobs, setJobs] = useState<GuestJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      const result = await apiRequest<GuestJob[]>(`${API_URL}/jobs?${params.toString()}`, undefined, t('guestJobs.loadFailed'));
      if (!result.ok) throw new Error(result.message || t('guestJobs.loadFailed'));
      setJobs(asList<GuestJob>(result.raw, ['jobs']));
    } catch (error: any) {
      setErrorMessage(error?.message || t('guestJobs.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, t]);

  useEffect(() => {
    const timer = setTimeout(fetchJobs, searchQuery ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchJobs, searchQuery]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <MicroJobsLogo compact />
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.signInButton} onPress={onNavigateToSignIn} accessibilityRole="button">
            <Text style={styles.signInButtonText}>{t('guestJobs.signInButton')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.signUpButton} onPress={onNavigateToSignUp} accessibilityRole="button">
            <Text style={styles.signUpButtonText}>{t('guestJobs.signUpButton')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('guestJobs.title')}</Text>
        <Text style={styles.subtitle}>{t('guestJobs.subtitle')}</Text>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={tokens.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('guestJobs.searchPlaceholder')}
            placeholderTextColor={tokens.colors.textSubtle}
            returnKeyType="search"
          />
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={tokens.colors.brand} />
          </View>
        ) : jobs.length === 0 ? (
          <Text style={styles.emptyText}>{t('guestJobs.empty')}</Text>
        ) : (
          <View style={styles.list}>
            {jobs.map((job) => (
              <JobCard key={job._id} job={toJobCardData(job)} variant="list" onPress={() => onViewDetails(job)} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.signedInCanvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.layout.gutter,
    paddingBottom: tokens.spacing.sm,
    gap: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs },
  signInButton: {
    minHeight: 40,
    paddingHorizontal: tokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.md,
  },
  signInButtonText: { color: tokens.colors.brand, fontSize: 14, fontWeight: '600' },
  signUpButton: {
    minHeight: 40,
    paddingHorizontal: tokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.brand,
  },
  signUpButtonText: { color: tokens.colors.onBrand, fontSize: 14, fontWeight: '600' },
  scroll: { paddingHorizontal: tokens.layout.gutter, paddingTop: tokens.spacing.lg, paddingBottom: tokens.spacing.xxl },
  title: { fontSize: tokens.typography.h1, fontWeight: '800', color: tokens.colors.onCanvas },
  subtitle: { marginTop: tokens.spacing.xxs, fontSize: tokens.typography.body, color: tokens.colors.textMuted },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.lg,
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.md,
    minHeight: tokens.controls.fieldHeight,
  },
  searchInput: { flex: 1, fontSize: tokens.typography.body, color: tokens.colors.text, paddingVertical: tokens.spacing.sm },
  errorText: { marginTop: tokens.spacing.md, color: tokens.colors.danger, fontSize: tokens.typography.body },
  loadingRow: { marginTop: tokens.spacing.xxl, alignItems: 'center' },
  emptyText: { marginTop: tokens.spacing.xxl, textAlign: 'center', color: tokens.colors.textMuted, fontSize: tokens.typography.body },
  list: { marginTop: tokens.spacing.lg, gap: tokens.spacing.md },
});
