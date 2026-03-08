import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import Navigation from '../../components/navigation';
import AppHeader from '../../components/AppHeader';
import AddExperience from './AddExperience';
import AddEducation from './AddEducation';
import AddCV from './AddCV';
import AddSkills from './AddSkills';
import { API_URL } from '../../config';
import { apiRequest } from '../../lib/api';
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
  const [showAddSkills, setShowAddSkills] = useState(false);
  const [firstName, setFirstName] = useState('Jonas');
  const [lastName, setLastName] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [profileData, setProfileData] = useState<ProfileData>({});
  const [completion, setCompletion] = useState({ percentage: 0, completedCount: 0, totalFields: 0 });
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const API_ORIGIN = API_URL.replace(/\/api$/, '');

  const buildApiCandidates = () => {
    const candidates = new Set<string>([API_URL]);

    const extractHost = (value: unknown): string => {
      if (typeof value !== 'string' || !value.trim()) return '';
      return value.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].trim();
    };

    const hostCandidates = [
      Constants.expoConfig?.hostUri,
      (Constants as any).expoGoConfig?.debuggerHost,
      (Constants.manifest as any)?.debuggerHost,
      (Constants.manifest2 as any)?.extra?.expoClient?.debuggerHost,
    ];
    const detectedHost = hostCandidates.map(extractHost).find(Boolean);

    if (detectedHost) {
      candidates.add(`http://${detectedHost}:5000/api`);
    }

    if (Platform.OS === 'android' && /localhost|127\.0\.0\.1/.test(API_URL)) {
      candidates.add(API_URL.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2'));
    }

    return Array.from(candidates);
  };

  const handleTabPress = (tab: string) => {
    setProfileTab(tab);
    onTabPress?.(tab);
  };

  const handleRoleSwitch = (role: 'worker' | 'employer') => {
    if (role === currentRole) return;
    onSwitchRole?.(role);
  };
  const nextRole: 'worker' | 'employer' = currentRole === 'worker' ? 'employer' : 'worker';

  const handlePickProfilePicture = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your photo library to upload a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const pickedImage = result.assets[0];
        await handleUploadProfilePicture(pickedImage);
      }
    } catch (error) {
      console.log('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleUploadProfilePicture = async (image: ImagePicker.ImagePickerAsset) => {
    try {
      setIsUploadingAvatar(true);
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Error', 'Authentication token not found');
        return;
      }

      let uploadUri = image.uri;
      const extensionFromName = image.fileName?.includes('.')
        ? image.fileName.split('.').pop()?.toLowerCase()
        : undefined;
      const extensionFromMime = image.mimeType?.split('/').pop()?.toLowerCase();
      const extension = extensionFromName || extensionFromMime || 'jpg';

      // Normalize non-file URI schemes (content://, ph://, assets-library://) before multipart upload.
      if (!uploadUri.startsWith('file://') && FileSystem.cacheDirectory) {
        const cachePath = `${FileSystem.cacheDirectory}avatar_upload_${Date.now()}.${extension}`;
        await FileSystem.copyAsync({ from: uploadUri, to: cachePath });
        uploadUri = cachePath;
      }

      const fileInfo = await FileSystem.getInfoAsync(uploadUri);
      if (!fileInfo.exists) {
        throw new Error('Selected image file is not accessible on this device.');
      }

      const formData = new FormData();
      const fileName = image.fileName || `profile_${Date.now()}.${extension}`;
      
      formData.append('avatar', {
        uri: uploadUri,
        type: image.mimeType || `image/${extension === 'jpg' ? 'jpeg' : extension}`,
        name: fileName,
      } as any);

      const apiCandidates = buildApiCandidates();
      let uploadSuccess = false;
      let lastError = 'Network request failed';

      for (const apiBase of apiCandidates) {
        try {
          const response = await fetch(`${apiBase}/auth/profile/avatar`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          });

          const raw = await response.text();
          let parsed: any = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = null;
          }

          if (response.ok) {
            uploadSuccess = true;
            break;
          }

          lastError = parsed?.message || `Failed to upload image (${response.status})`;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          console.log(`Avatar upload failed for ${apiBase}:`, err);
        }
      }

      if (!uploadSuccess) {
        throw new Error(lastError);
      }

      await loadProfile();
      Alert.alert('Success', 'Profile picture updated successfully');
    } catch (error) {
      console.log('Error uploading profile picture:', error);
      Alert.alert('Upload Failed', 'Could not upload profile picture. Please ensure your phone and backend are on the same network and try again.');
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  const loadProfile = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('auth_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setFirstName(parsed?.firstName || 'Jonas');
        setLastName(parsed?.lastName || '');
      }
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        console.log('❌ No auth token found');
        return;
      }
      const result = await apiRequest(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }, 'Failed to load profile.') as any;

      if (!result.ok) {
        console.log('❌ Profile API failed:', result);
        return;
      }

      // The API returns user data directly in result.data
      const profile = result.data as any;

      if (profile) {
        console.log('✅ Profile loaded successfully:', {
          firstName: profile.firstName,
          lastName: profile.lastName,
          city: profile.city,
          phoneNumber: profile.phoneNumber,
          skills: profile.skills?.length || 0,
          totalExperience: profile.totalExperience,
          about: profile.about,
          avatarUrl: profile.avatarUrl,
        });
        
        setFirstName(profile.firstName || 'Jonas');
        setLastName(profile.lastName || '');
        setProfile(profile);

        const profileDataToCalculate: ProfileData = {
          firstName: profile.firstName?.trim() || '',
          lastName: profile.lastName?.trim() || '',
          avatarUrl: profile.avatarUrl?.trim() || '',
          about: profile.about?.trim() || '',
          city: profile.city?.trim() || '',
          phoneNumber: profile.phoneNumber?.trim() || '',
          linkedin: profile.linkedin?.trim() || '',
          totalExperience: profile.totalExperience?.trim() || '',
          resumeUrl: profile.resumeUrl?.trim() || '',
          skills: Array.isArray(profile.skills) ? profile.skills : [],
        };

        setProfileData(profileDataToCalculate);
        const completionStatus = calculateProfileCompletion(profileDataToCalculate);
        setCompletion(completionStatus);
      } else {
        console.log('⚠️ Profile is null or empty');
      }
    } catch (error) {
      console.log('❌ Failed to load profile:', error);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);
  
  // Reload profile when screen becomes focused
  useEffect(() => {
    if (activeTab === 'Profile') {
      loadProfile();
    }
  }, [activeTab]);

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'Jonas';
  const skills = Array.isArray(profile?.skills) ? profile.skills : [];
  const totalExperience = profile?.totalExperience || '';
  const jobsApplied = typeof profile?.jobsApplied === 'number' ? profile.jobsApplied : 0;
  const jobsCompleted = typeof profile?.projectsCompleted === 'number' ? profile.projectsCompleted : 0;
  const successRate = profile?.successRate || '0%';
  const resumeUrl = profile?.resumeUrl || profile?.cvUrl || '';
  const resumeName = profile?.resumeFileName || 'No resume uploaded';
  const aboutText = profile?.about || '';
  const avatarUrl = profile?.avatarUrl
    ? String(profile.avatarUrl).startsWith('http')
      ? profile.avatarUrl
      : `${API_ORIGIN}${profile.avatarUrl}`
    : '';
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

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scroll} 
        showsVerticalScrollIndicator={false}
        bounces={true}
        alwaysBounceVertical={true}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <TouchableOpacity 
              style={styles.avatar}
              onPress={handlePickProfilePicture}
              disabled={isUploadingAvatar}
            >
              {avatarUrl ? (
                <Image 
                  source={{ uri: avatarUrl }} 
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
              {isUploadingAvatar && (
                <View style={styles.avatarUploadingOverlay}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.cameraBtn}
              onPress={handlePickProfilePicture}
              disabled={isUploadingAvatar}
            >
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
              <Text style={styles.statCount}>{jobsApplied}</Text>
              <Text style={styles.statLabel}>Applied</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statCount}>{jobsCompleted}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statCount}>{successRate}</Text>
              <Text style={styles.statLabel}>Success</Text>
            </View>
          </View>

          <View style={styles.skillsBlock}>
            <View style={styles.skillsHeader}>
              <Text style={styles.skillsLabel}>Skills</Text>
              <TouchableOpacity onPress={() => setShowAddSkills(true)}>
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.skillsWrap}>
              {skills.length ? (
                skills.slice(0, 8).map((skill: any) => (
                  <View key={skill?._id || skill?.id || skill?.name} style={styles.skillPill}>
                    <Text style={styles.skillPillText}>{skill?.name || 'Skill'}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyInlineText}>No skills added yet</Text>
              )}
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

          {totalExperience ? (
            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons name="briefcase-outline" size={20} color={tokens.colors.brand} />
              </View>
              <Text style={styles.infoText}>{totalExperience}</Text>
            </View>
          ) : (
            <Text style={styles.emptySectionText}>No experience added yet</Text>
          )}
        </View>

        {/* Education Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>About / Education</Text>
            <TouchableOpacity onPress={() => setShowAddEducation(true)}>
              <Ionicons name="add-circle-outline" size={20} color={tokens.colors.brand} />
            </TouchableOpacity>
          </View>

          {aboutText ? (
            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons name="school-outline" size={20} color={tokens.colors.brand} />
              </View>
              <Text style={styles.infoText}>{aboutText}</Text>
            </View>
          ) : (
            <Text style={styles.emptySectionText}>No education added yet</Text>
          )}
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
              <Text style={styles.cvFileName}>{resumeName}</Text>
              <Text style={styles.cvFileSize}>{resumeUrl ? 'Uploaded from server' : 'No resume uploaded'}</Text>
            </View>
            {resumeUrl ? (
              <TouchableOpacity>
                <Ionicons name="download-outline" size={18} color={tokens.colors.textMuted} />
              </TouchableOpacity>
            ) : null}
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
        initialTotalExperience={profile?.totalExperience || ''}
        onClose={() => setShowAddExperience(false)}
        onAdd={async (data) => {
          try {
            const token = await AsyncStorage.getItem('auth_token');
            if (!token) return;
            await apiRequest(`${API_URL}/auth/me`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ totalExperience: data.totalExperience }),
            }, 'Failed to update experience.');
            await loadProfile();
          } catch (error) {
            console.log('Failed to update experience', error);
          } finally {
            setShowAddExperience(false);
          }
        }}
      />
      <AddSkills
        visible={showAddSkills}
        onClose={() => setShowAddSkills(false)}
        onAdd={async (data) => {
          try {
            const token = await AsyncStorage.getItem('auth_token');
            if (!token) return;
            const result = await apiRequest(`${API_URL}/auth/profile/skills`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ name: data.skillName, level: data.level }),
            }, 'Failed to add skill.') as any;
            
            if (result.ok) {
              console.log('✅ Skill added successfully');
              await loadProfile();
            } else {
              console.error('❌ Failed to add skill:', result.raw);
            }
          } catch (error) {
            console.log('Failed to add skill', error);
          } finally {
            setShowAddSkills(false);
          }
        }}
      />
      <AddEducation 
        visible={showAddEducation} 
        onClose={() => setShowAddEducation(false)}
        onAdd={async (data) => {
          try {
            const token = await AsyncStorage.getItem('auth_token');
            if (!token) return;
            await apiRequest(`${API_URL}/auth/me`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                about: data.schoolName ? `Studied ${data.degree} in ${data.fieldOfStudy} at ${data.schoolName}` : '',
              }),
            }, 'Failed to add education.');
            await loadProfile();
          } catch (error) {
            console.log('Failed to add education:', error);
          } finally {
            setShowAddEducation(false);
          }
        }}
      />
      <AddCV 
        visible={showAddCV} 
        onClose={() => setShowAddCV(false)}
        onAdd={async (data) => {
          console.log('Resume uploaded successfully:', data);
          // Reload profile to show the new resume
          await loadProfile();
          setShowAddCV(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  scrollView: { flex: 1 },
  scroll: { 
    flexGrow: 1,
    paddingHorizontal: 20, 
    paddingTop: 24, 
    paddingBottom: 120,
  },
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarUploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
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
  skillsBlock: {
    width: '100%',
    gap: 8,
  },
  skillsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skillsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d1dce6',
  },
  skillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillPill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  skillPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyInlineText: {
    color: '#d1dce6',
    fontSize: 12,
  },
  emptySectionText: {
    color: '#6b7280',
    fontSize: 13,
    fontStyle: 'italic',
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
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'flex-start',
    gap: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 20,
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
