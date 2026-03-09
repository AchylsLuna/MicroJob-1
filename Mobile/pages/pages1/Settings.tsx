import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokens } from '../../theme/tokens';
import { API_URL } from '../../config';
import { apiRequest, asObject } from '../../lib/api';
import { calculateProfileCompletion, getCompletionColor, type ProfileData } from '../../lib/profileCompletion';
import PersonalInformation from './PersonalInformation';

type SettingsProps = {
  onBack?: () => void;
  onLogout?: () => void;
  onNavigatePersonalDetails?: () => void;
  onNavigateChangePassword?: () => void;
  onNavigateNotifications?: () => void;
  onNavigateEWallet?: () => void;
  onNavigateLocation?: () => void;
  onNavigateMfa?: () => void;
  onNavigateAbout?: () => void;
  onNavigateDeleteAccount?: () => void;
  onNavigateSupport?: () => void;
  currentRole?: 'worker' | 'employer' | 'both';
};

export default function Settings({
  onBack,
  onLogout,
  onNavigatePersonalDetails,
  onNavigateChangePassword,
  onNavigateNotifications,
  onNavigateEWallet,
  onNavigateLocation,
  onNavigateMfa,
  onNavigateAbout,
  onNavigateDeleteAccount,
  onNavigateSupport,
  currentRole = 'worker',
}: SettingsProps) {
  const [completion, setCompletion] = useState({ percentage: 0, incompleteFields: [] as string[], completedFields: [] as string[] });
  const [profileSummary, setProfileSummary] = useState({
    totalExperience: '',
    projectsCompleted: 0,
    jobsApplied: 0,
    successRate: '0%',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showPersonalInfo, setShowPersonalInfo] = useState(false);

  useEffect(() => {
    const loadProfileCompletion = async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) {
          setIsLoading(false);
          return;
        }

        const result = await apiRequest(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }, 'Failed to load profile.') as any;

        if (result.ok) {
          // The API returns user data directly in result.data
          const profile = result.data as any;

          if (profile) {
            const profileDataToCalculate: ProfileData = {
              firstName: profile.firstName?.trim() || '',
              lastName: profile.lastName?.trim() || '',
              avatarUrl: profile.avatarUrl?.trim() || '',
              about: profile.about?.trim() || '',
              city: profile.city?.trim() || '',
              phoneNumber: profile.phoneNumber?.trim() || '',
              linkedin: profile.linkedin?.trim() || '',
              totalExperience: profile.totalExperience?.trim() || '',
              resumeUrl: (profile.resumeUrl || profile.cvUrl)?.trim() || '',
              skills: Array.isArray(profile.skills) ? profile.skills : [],
            };

            const completionStatus = calculateProfileCompletion(profileDataToCalculate);
            setCompletion({
              percentage: completionStatus.percentage,
              incompleteFields: completionStatus.incompleteFields,
              completedFields: completionStatus.completedFields,
            });

            setProfileSummary({
              totalExperience: profile.totalExperience || '',
              projectsCompleted: profile.projectsCompleted || 0,
              jobsApplied: profile.jobsApplied || 0,
              successRate: profile.successRate || '0%',
            });
          }
        }
      } catch (error) {
        console.log('Failed to load profile completion', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfileCompletion();
  }, []);

  const handleLogout = () => {
    onLogout?.();
  };

  if (showPersonalInfo) {
    return <PersonalInformation key="personal-info" onBack={() => setShowPersonalInfo(false)} currentRole={currentRole} />;
  }

  const settingsMenus = [
    { title: 'Personal Information', onPress: () => setShowPersonalInfo(true), icon: 'person-outline' as const },
    { title: 'Change Password', onPress: onNavigateChangePassword, icon: 'lock-closed-outline' as const },
    { title: 'Notifications', onPress: onNavigateNotifications, icon: 'notifications-outline' as const },
    { title: 'E-Wallet & Payments', onPress: onNavigateEWallet, icon: 'wallet-outline' as const },
    { title: 'Location Services', onPress: onNavigateLocation, icon: 'location-outline' as const },
    { title: 'Two-Factor Authentication', onPress: onNavigateMfa, icon: 'shield-checkmark-outline' as const },
    { title: 'Contact Support', onPress: onNavigateSupport, icon: 'help-circle-outline' as const },
    { title: 'About', onPress: onNavigateAbout, icon: 'information-circle-outline' as const },
    { title: 'Delete Account', onPress: onNavigateDeleteAccount, icon: 'trash-outline' as const, danger: true },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="chevron-back" size={20} color="#6B7280" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile Completion Section */}
        {!isLoading && (
          <View style={[styles.completionCard, { borderColor: getCompletionColor(completion.percentage) }]}>
            <View style={styles.completionTop}>
              <View style={styles.completionInfo}>
                <Text style={styles.completionTitle}>Profile Strength</Text>
                <Text style={styles.completionSubtitle}>Complete your profile to get better matches</Text>
              </View>
              <View
                style={[
                  styles.completionCircle,
                  { borderColor: getCompletionColor(completion.percentage) },
                ]}
              >
                <Text style={[styles.completionPercent, { color: getCompletionColor(completion.percentage) }]}>
                  {completion.percentage}%
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${completion.percentage}%`,
                    backgroundColor: getCompletionColor(completion.percentage),
                  },
                ]}
              />
            </View>

            <View style={styles.quickStatsRow}>
              <View style={styles.quickStatItem}>
                <Text style={styles.quickStatValue}>{profileSummary.jobsApplied}</Text>
                <Text style={styles.quickStatLabel}>Applied</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStatItem}>
                <Text style={styles.quickStatValue}>{profileSummary.projectsCompleted}</Text>
                <Text style={styles.quickStatLabel}>Completed</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStatItem}>
                <Text style={styles.quickStatValue}>{profileSummary.successRate}</Text>
                <Text style={styles.quickStatLabel}>Success</Text>
              </View>
            </View>

            {profileSummary.totalExperience ? (
              <Text style={styles.totalExperienceText}>Total Experience: {profileSummary.totalExperience}</Text>
            ) : null}

            {/* Incomplete Fields */}
            {completion.incompleteFields.length > 0 && (
              <View style={styles.incompleteSectionContainer}>
                <Text style={styles.incompleteTitle}>Missing: {completion.incompleteFields.length}</Text>
                <View style={styles.fieldsList}>
                  {completion.incompleteFields.slice(0, 3).map((field, index) => (
                    <View key={index} style={styles.fieldItem}>
                      <Ionicons name="checkbox-outline" size={16} color="#EF4444" />
                      <Text style={styles.fieldText}>{field}</Text>
                    </View>
                  ))}
                  {completion.incompleteFields.length > 3 && (
                    <Text style={styles.moreText}>+{completion.incompleteFields.length - 3} more</Text>
                  )}
                </View>
              </View>
            )}
          </View>
        )}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={tokens.colors.brand} size="large" />
          </View>
        )}
        <View style={styles.menuCard}>
          {settingsMenus.map((menu, index) => (
            <View key={menu.title}>
              <TouchableOpacity style={styles.menuItem} onPress={menu.onPress}>
                <View style={styles.menuLeft}>
                  <View style={styles.iconWrap}>
                    <Ionicons
                      name={menu.icon}
                      size={19}
                      color={menu.danger ? tokens.colors.danger : '#4B5563'}
                    />
                  </View>
                  <Text style={[styles.menuTitle, menu.danger && styles.menuTitleDanger]}>{menu.title}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C5CCD7" />
              </TouchableOpacity>
              {index < settingsMenus.length - 1 && <View style={styles.divider} />}
            </View>
          ))}

          <View style={styles.divider} />
          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <View style={styles.menuLeft}>
              <View style={styles.iconWrap}>
                <Ionicons name="log-out-outline" size={19} color={tokens.colors.danger} />
              </View>
              <Text style={[styles.menuTitle, styles.menuTitleDanger]}>Log out</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C5CCD7" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7FB',
  },
  header: {
    paddingTop: 54,
    paddingHorizontal: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 100 },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    marginBottom: 20,
    ...tokens.shadow.card,
  },
  completionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  completionInfo: {
    flex: 1,
    marginRight: 12,
  },
  completionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  completionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  completionCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  completionPercent: {
    fontSize: 18,
    fontWeight: '800',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#E5EAF0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  quickStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  quickStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  quickStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5EAF0',
  },
  totalExperienceText: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 8,
  },
  incompleteSectionContainer: {
    marginTop: 8,
  },
  incompleteTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  fieldsList: {
    gap: 6,
  },
  fieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  fieldText: {
    fontSize: 12,
    color: '#7F1D1D',
    fontWeight: '500',
  },
  moreText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 4,
  },
  menuCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5EAF0',
    ...tokens.shadow.card,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 72,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexShrink: 1,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3F5F9',
    borderWidth: 1,
    borderColor: '#ECEFF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: { fontSize: 18, fontWeight: '700', color: '#111827', flexShrink: 1 },
  menuTitleDanger: { color: tokens.colors.danger },
  divider: {
    height: 1,
    backgroundColor: '#EEF2F7',
  },
});
