import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Navigation from '../../components/navigation';
import AppHeader from '../../components/AppHeader';
import AddExperience from './AddExperience';
import AddEducation from './AddEducation';
import AddCV from './AddCV';
import { API_URL } from '../../config';
import { apiRequest, asObject } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import { calculateProfileCompletion, getCompletionColor, getCompletionMessage, type ProfileData } from '../../lib/profileCompletion';

type ProfileProps = {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  onOpenSettings?: () => void;
  currentRole?: 'worker' | 'employer';
  onSwitchRole?: (role: 'worker' | 'employer') => void;
  messageBadgeCount?: number;
};

export default function Profile({
  activeTab = 'Profile',
  onTabPress,
  onOpenSettings,
  currentRole = 'worker',
  onSwitchRole,
  messageBadgeCount = 0,
}: ProfileProps) {
  const [profileTab, setProfileTab] = useState(activeTab || 'Profile');
  const [showAddExperience, setShowAddExperience] = useState(false);
  const [showAddEducation, setShowAddEducation] = useState(false);
  const [showAddCV, setShowAddCV] = useState(false);
  const [firstName, setFirstName] = useState('Jonas');
  const [lastName, setLastName] = useState('');
  const [profileData, setProfileData] = useState<ProfileData>({});
  const [completion, setCompletion] = useState({ percentage: 0, completedCount: 0, totalFields: 0 });

  const handleTabPress = (tab: string) => {
    setProfileTab(tab);
    onTabPress?.(tab);
  };

  const handleRoleSwitch = (role: 'worker' | 'employer') => {
    if (role === currentRole) return;
    onSwitchRole?.(role);
  };
  const nextRole: 'worker' | 'employer' = currentRole === 'worker' ? 'employer' : 'worker';

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('auth_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setFirstName(parsed?.firstName || 'Jonas');
          setLastName(parsed?.lastName || '');
        }
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) return;
        const result = await apiRequest(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }, 'Failed to load profile.') as any;
        
        if (!result.ok) return;
        
        // Extract profile from various possible response structures
        let profile: any = null;
        
        // Try different response structures
        if (result.raw?.data?.user) {
          profile = result.raw.data.user;
        } else if (result.raw?.user) {
          profile = result.raw.user;
        } else if (result.data?.user) {
          profile = result.data.user;
        } else if (result.raw) {
          profile = result.raw;
        }
        
        console.log('Loaded profile:', profile);
        
        if (profile) {
          setFirstName(profile.firstName || 'Jonas');
          setLastName(profile.lastName || '');
          
          // Set profile data for completion calculation
          // Make sure to capture all relevant fields
          const profileDataToCalculate: ProfileData = {
            firstName: profile.firstName?.trim() || '',
            lastName: profile.lastName?.trim() || '',
            avatarUrl: profile.avatarUrl?.trim() || '',
            about: profile.about?.trim() || '',
            city: profile.city?.trim() || '',
            country: profile.country?.trim() || '',
            phoneNumber: profile.phoneNumber?.trim() || '',
            linkedin: profile.linkedin?.trim() || '',
            experience: Array.isArray(profile.experience) ? profile.experience : [],
            education: Array.isArray(profile.education) ? profile.education : [],
            cvUrl: (profile.resumeUrl || profile.cvUrl)?.trim() || '',
            skills: Array.isArray(profile.skills) ? profile.skills : [],
          };
          
          console.log('Profile data for calculation:', profileDataToCalculate);
          
          setProfileData(profileDataToCalculate);
          
          // Calculate completion percentage
          const completionStatus = calculateProfileCompletion(profileDataToCalculate);
          console.log('Completion status:', completionStatus);
          setCompletion(completionStatus);
        }
      } catch (error) {
        console.log('Failed to load profile', error);
      }
    };

    loadProfile();
  }, []);

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'Jonas';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'JD';

  return (
    <View style={styles.container}>
      <AppHeader
        title="Details"
        rightLabel={nextRole === 'employer' ? 'Switch to Employer' : 'Switch to Worker'}
        rightIconName="swap-horizontal"
        onRightPress={() => handleRoleSwitch(nextRole)}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <TouchableOpacity style={styles.cameraBtn}>
              <Ionicons name="camera-outline" size={16} color={tokens.colors.brandDark} />
            </TouchableOpacity>
          </View>

          {/* Name */}
          <Text style={styles.name}>{displayName}</Text>
          
          {/* Profile Completion Section */}
          <View style={styles.completionContainer}>
            <View style={styles.completionHeader}>
              <Text style={styles.completionLabel}>Profile Completion</Text>
              <Text style={[styles.completionPercentage, { color: getCompletionColor(completion.percentage) }]}>
                {completion.percentage}%
              </Text>
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
            
            <Text style={styles.completionMessage}>
              {getCompletionMessage(completion.percentage)}
            </Text>
            
            <Text style={styles.completionSubtext}>
              {completion.completedCount} of {completion.totalFields} fields completed
            </Text>
          </View>
          
          <TouchableOpacity onPress={onOpenSettings} style={styles.settingsChip}>
            <Text style={styles.settingsChipText}>Complete Your Profile →</Text>
          </TouchableOpacity>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statCount}>5</Text>
              <Text style={styles.statLabel}>Applied</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statCount}>5</Text>
              <Text style={styles.statLabel}>Shortlisted</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statCount}>5</Text>
              <Text style={styles.statLabel}>Terms</Text>
            </View>
          </View>
        </View>

        {/* Experience Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Experience</Text>
            <TouchableOpacity onPress={() => setShowAddExperience(true)}>
              <Ionicons name="add-circle-outline" size={20} color={tokens.colors.brand} />
            </TouchableOpacity>
          </View>

          {[1, 2].map((item) => (
            <View key={item} style={styles.experienceItem}>
              <View style={styles.expLogo}>
                <Ionicons name="briefcase-outline" size={20} color={tokens.colors.brand} />
              </View>
              <View style={styles.expInfo}>
                <Text style={styles.expTitle}>Mobile Developer Designer</Text>
                <Text style={styles.expCompany}>Company Name</Text>
                <Text style={styles.expDate}>Jan 22 - Feb 23</Text>
              </View>
              <Text style={styles.expLocation}>Pangasinan, PH</Text>
            </View>
          ))}
        </View>

        {/* Education Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Education</Text>
            <TouchableOpacity onPress={() => setShowAddEducation(true)}>
              <Ionicons name="add-circle-outline" size={20} color={tokens.colors.brand} />
            </TouchableOpacity>
          </View>

          <View style={styles.educationItem}>
            <View style={styles.eduLogo}>
              <Ionicons name="school-outline" size={20} color={tokens.colors.brand} />
            </View>
            <View style={styles.eduInfo}>
              <Text style={styles.eduTitle}>Information Technology</Text>
              <Text style={styles.eduSchool}>University's Name</Text>
              <Text style={styles.eduDate}>Jan 22 - Feb 23</Text>
            </View>
            <Text style={styles.eduLocation}>Pangasinan, PH</Text>
          </View>
        </View>

        {/* CV Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>CV</Text>
            <TouchableOpacity onPress={() => setShowAddCV(true)}>
              <Ionicons name="add-circle-outline" size={20} color={tokens.colors.brand} />
            </TouchableOpacity>
          </View>

          <View style={styles.cvFile}>
            <View style={styles.cvIcon}>
              <Ionicons name="document-text-outline" size={20} color={tokens.colors.brand} />
            </View>
            <View style={styles.cvInfo}>
              <Text style={styles.cvFileName}>Enriquez, Jonas CV.PDF</Text>
              <Text style={styles.cvFileSize}>PDF • 2MB</Text>
            </View>
            <TouchableOpacity>
              <Ionicons name="download-outline" size={18} color={tokens.colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom nav */}
      <Navigation
        activeTab={profileTab}
        onTabPress={handleTabPress}
        messageBadgeCount={messageBadgeCount}
        profileInitials={initials}
      />

      {/* Modals */}
      <AddExperience 
        visible={showAddExperience} 
        onClose={() => setShowAddExperience(false)}
        onAdd={(data) => {
          console.log('Add experience:', data);
          setShowAddExperience(false);
        }}
      />
      <AddEducation 
        visible={showAddEducation} 
        onClose={() => setShowAddEducation(false)}
        onAdd={(data) => {
          console.log('Add education:', data);
          setShowAddEducation(false);
        }}
      />
      <AddCV 
        visible={showAddCV} 
        onClose={() => setShowAddCV(false)}
        onAdd={(data) => {
          console.log('Add CV:', data);
          setShowAddCV(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 100 },
  profileCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 24,
    gap: 20,
  },
  avatarContainer: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#3b5a85',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#4a7ba7',
  },
  avatarText: { fontSize: 40, fontWeight: '700', color: '#fff' },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1e3a5f',
  },
  name: { fontSize: 24, fontWeight: '700', color: '#fff' },
  completionContainer: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  completionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  completionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  completionPercentage: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  completionMessage: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    marginTop: 4,
  },
  completionSubtext: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  settingsChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  settingsChipText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statCount: { fontSize: 20, fontWeight: '700', color: '#fff' },
  statLabel: { fontSize: 12, color: '#b0c4de', marginTop: 4 },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#3b5a85',
  },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  experienceItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
    gap: 12,
  },
  expLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expInfo: { flex: 1 },
  expTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937', marginBottom: 2 },
  expCompany: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  expDate: { fontSize: 12, color: '#9ca3af' },
  expLocation: { fontSize: 12, color: '#6b7280' },
  educationItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
    gap: 12,
  },
  eduLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eduInfo: { flex: 1 },
  eduTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937', marginBottom: 2 },
  eduSchool: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  eduDate: { fontSize: 12, color: '#9ca3af' },
  eduLocation: { fontSize: 12, color: '#6b7280' },
  cvFile: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 12,
  },
  cvIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cvInfo: { flex: 1 },
  cvFileName: { fontSize: 14, fontWeight: '700', color: '#1f2937', marginBottom: 2 },
  cvFileSize: { fontSize: 12, color: '#6b7280' },
});
