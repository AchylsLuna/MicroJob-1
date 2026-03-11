import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import Navigation from '../../components/navigation';
import TabTopNav from '../../components/TabTopNav';
import AddCV from './AddCV';
import AddExperience from './AddExperience';
import { API_URL } from '../../config';
import { apiRequest } from '../../lib/api';
import { tokens } from '../../theme/tokens';

type ProfileProps = {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  onOpenSettings?: () => void;
  currentRole?: 'worker' | 'employer';
  onSwitchRole?: (role: 'worker' | 'employer') => void;
  messageBadgeCount?: number;
};

type ExperienceItem = {
  title: string;
  subtitle: string;
  period?: string;
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
  const [showAddCV, setShowAddCV] = useState(false);
  const [firstName, setFirstName] = useState('Jonas');
  const [lastName, setLastName] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showGovernmentScanModal, setShowGovernmentScanModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isToastVisible, setIsToastVisible] = useState(false);

  const API_ORIGIN = API_URL.replace(/\/api$/, '');
  const apiPort = (() => {
    try {
      const parsed = new URL(API_ORIGIN);
      if (parsed.port) return parsed.port;
      return parsed.protocol === 'https:' ? '443' : '80';
    } catch {
      return '5055';
    }
  })();
  const apiProtocol = (() => {
    try {
      return new URL(API_ORIGIN).protocol.replace(':', '');
    } catch {
      return 'http';
    }
  })();

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
      candidates.add(`${apiProtocol}://${detectedHost}:${apiPort}/api`);
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
        await handleUploadProfilePicture(result.assets[0]);
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
      Alert.alert('Upload Failed', 'Could not upload profile picture. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

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
        return;
      }

      const result = (await apiRequest(
        `${API_URL}/auth/me`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        'Failed to load profile.',
      )) as any;

      if (!result.ok) {
        return;
      }

      const nextProfile = result.data as any;
      if (!nextProfile) {
        return;
      }

      setFirstName(nextProfile.firstName || 'Jonas');
      setLastName(nextProfile.lastName || '');
      setProfile(nextProfile);
    } catch (error) {
      console.log('Failed to load profile:', error);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (activeTab === 'Profile') {
      loadProfile();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!isToastVisible) return;
    const timeout = setTimeout(() => {
      setIsToastVisible(false);
    }, 2600);
    return () => clearTimeout(timeout);
  }, [isToastVisible, toastMessage]);

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'Jonas';
  const locationLabel = [profile?.city, profile?.province, profile?.country].filter(Boolean).join(', ') || 'Location not set';
  const jobsApplied = typeof profile?.jobsApplied === 'number' ? profile.jobsApplied : 0;
  const jobsReviewed =
    typeof profile?.jobsReviewed === 'number'
      ? profile.jobsReviewed
      : typeof profile?.projectsCompleted === 'number'
      ? profile.projectsCompleted
      : 0;
  const interviews =
    typeof profile?.interviewsCount === 'number'
      ? profile.interviewsCount
      : typeof profile?.interviews === 'number'
      ? profile.interviews
      : 0;

  const resumeUrl = profile?.resumeUrl || profile?.cvUrl || '';
  const absoluteResumeUrl = resumeUrl
    ? String(resumeUrl).startsWith('http')
      ? resumeUrl
      : `${API_ORIGIN}${resumeUrl}`
    : '';
  const resumeName = profile?.resumeFileName || 'No document uploaded';
  const resumeExtension = useMemo(() => {
    if (!resumeName || !resumeName.includes('.')) return 'FILE';
    return resumeName.split('.').pop()?.toUpperCase() || 'FILE';
  }, [resumeName]);

  const avatarUrl = profile?.avatarUrl
    ? String(profile.avatarUrl).startsWith('http')
      ? profile.avatarUrl
      : `${API_ORIGIN}${profile.avatarUrl}`
    : '';

  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'JD';

  const verificationItems = [
    { label: 'Email', complete: Boolean(profile?.email) },
    { label: 'Phone', complete: Boolean(profile?.phoneNumber) },
    {
      label: 'Gov ID',
      complete: Boolean(profile?.governmentId || profile?.govId || profile?.idNumber || profile?.nationalId),
    },
    { label: 'Resume', complete: Boolean(absoluteResumeUrl) },
  ];
  const hasGovernmentId = Boolean(profile?.governmentId || profile?.govId || profile?.idNumber || profile?.nationalId);

  const verifiedCount = verificationItems.filter((item) => item.complete).length;
  const verificationStrength = Math.round((verifiedCount / verificationItems.length) * 100);

  const totalExperience = profile?.totalExperience || '';
  const experienceItems: ExperienceItem[] = useMemo(() => {
    const normalize = (entry: any): ExperienceItem | null => {
      const title = entry?.title || entry?.position || entry?.role || entry?.jobTitle || '';
      const company = entry?.company || entry?.companyName || '';
      const location = entry?.location || entry?.city || '';
      const periodFromDates = [entry?.startDate, entry?.endDate].filter(Boolean).join(' - ');
      const period = entry?.period || entry?.duration || periodFromDates || '';
      const subtitle = [company, location].filter(Boolean).join(' • ');

      if (!title && !subtitle && !period) {
        return null;
      }

      return {
        title: title || 'Work Experience',
        subtitle: subtitle || 'Professional background',
        period,
      };
    };

    const rawList = Array.isArray(profile?.workExperience)
      ? profile.workExperience
      : Array.isArray(profile?.experiences)
      ? profile.experiences
      : [];

    const normalized = rawList.map(normalize).filter(Boolean) as ExperienceItem[];
    if (normalized.length) {
      return normalized;
    }

    if (totalExperience) {
      return [
        {
          title: 'Experience Summary',
          subtitle: totalExperience,
          period: '',
        },
      ];
    }

    return [];
  }, [profile, totalExperience]);

  const handleOpenResume = async () => {
    if (!absoluteResumeUrl) {
      Alert.alert('No document', 'Upload a CV in Documents first.');
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(absoluteResumeUrl);
      if (!canOpen) {
        throw new Error('Unsupported URL');
      }
      await Linking.openURL(absoluteResumeUrl);
    } catch {
      Alert.alert('Unable to open', 'Could not open the uploaded document.');
    }
  };

  const showGovernmentIdUnavailableToast = () => {
    setShowGovernmentScanModal(false);
    setToastMessage('Still not available. This will be improved in Capstone 2.');
    setIsToastVisible(true);
  };

  const handleGovernmentIdAction = () => {
    setShowGovernmentScanModal(true);
  };

  return (
    <View style={styles.container}>
      <TabTopNav
        title="My Profile"
        currentRole={currentRole}
        onSwitchRole={onSwitchRole}
        onOpenSettings={onOpenSettings}
        showModeSwitch
        showSettings
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <View style={styles.profileHero}>
          <View style={styles.avatarFrame}>
            <TouchableOpacity style={styles.avatar} onPress={handlePickProfilePicture} disabled={isUploadingAvatar}>
              {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarInitials}>{initials}</Text>}
              {isUploadingAvatar ? (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              ) : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editAvatarButton}
              onPress={handlePickProfilePicture}
              disabled={isUploadingAvatar}
              activeOpacity={0.9}
              accessibilityLabel="Edit profile photo"
            >
              <Ionicons name="create-outline" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.profileName}>{displayName}</Text>

          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color="#64748B" />
            <Text style={styles.locationText}>{locationLabel}</Text>
          </View>
        </View>

        <View style={styles.verificationCard}>
          <View style={styles.verificationHeader}>
            <View style={styles.verificationIconWrap}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#2563EB" />
            </View>
            <View style={styles.verificationTextBlock}>
              <View style={styles.verificationTitleRow}>
                <Text style={styles.verificationTitle}>Verified Identity</Text>
                <Ionicons name="checkmark-circle" size={16} color="#2563EB" />
              </View>
              <Text style={styles.verificationSubtitle}>Comprehensive profile checks completed</Text>
            </View>
          </View>

          <View style={styles.verificationScoreRow}>
            <Text style={styles.verificationScoreLabel}>Verification Strength</Text>
            <Text style={styles.verificationScoreValue}>{verificationStrength}%</Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${verificationStrength}%` }]} />
          </View>

          <View style={styles.verificationItemsRow}>
            {verificationItems.map((item) => (
              <View key={item.label} style={styles.verificationItem}>
                <Ionicons
                  name={item.complete ? 'checkmark-circle' : 'ellipse-outline'}
                  size={15}
                  color={item.complete ? '#22C55E' : '#94A3B8'}
                />
                <Text style={[styles.verificationItemText, !item.complete && styles.verificationItemTextIncomplete]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{jobsApplied}</Text>
            <Text style={styles.statLabel}>Applied</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{jobsReviewed}</Text>
            <Text style={styles.statLabel}>Reviewed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{interviews}</Text>
            <Text style={styles.statLabel}>Interviews</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Work Experience</Text>
            <TouchableOpacity style={styles.sectionAction} onPress={() => setShowAddExperience(true)} activeOpacity={0.9}>
              <Ionicons name="add" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {experienceItems.length ? (
            experienceItems.map((item, index) => (
              <View style={styles.listCard} key={`${item.title}-${index}`}>
                <View style={styles.listIconWrap}>
                  <Ionicons name="briefcase-outline" size={20} color="#111827" />
                </View>
                <View style={styles.listContent}>
                  <Text style={styles.listTitle}>{item.title}</Text>
                  <Text style={styles.listSubtitle}>{item.subtitle}</Text>
                  {item.period ? (
                    <View style={styles.listPeriodPill}>
                      <Text style={styles.listPeriodText}>{item.period}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>Add your work experience to strengthen your profile.</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Documents</Text>
            <TouchableOpacity style={styles.sectionAction} onPress={() => setShowAddCV(true)} activeOpacity={0.9}>
              <Ionicons name="add" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.documentsStack}>
            <View style={[styles.documentCard, absoluteResumeUrl ? styles.documentCardActive : styles.documentCardEmpty]}>
              <View style={[styles.listIconWrap, styles.documentIconWrap]}>
                <Ionicons name="document-text-outline" size={20} color={absoluteResumeUrl ? '#E11D48' : '#64748B'} />
              </View>

              <View style={styles.listContent}>
                <Text style={styles.listTitle}>{resumeName}</Text>
                <Text style={styles.listSubtitle}>{absoluteResumeUrl ? `${resumeExtension} • Uploaded` : 'No document uploaded yet'}</Text>
              </View>

              {absoluteResumeUrl ? (
                <TouchableOpacity style={styles.downloadButton} onPress={handleOpenResume} activeOpacity={0.9}>
                  <Ionicons name="download-outline" size={20} color="#E11D48" />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.identityCard}>
              <View style={styles.identityTopRow}>
                <View style={[styles.listIconWrap, styles.identityIconWrap]}>
                  <Ionicons name="card-outline" size={20} color="#2563EB" />
                </View>

                <View style={styles.listContent}>
                  <Text style={styles.listTitle}>Government ID</Text>
                  <Text style={styles.listSubtitle}>{hasGovernmentId ? 'Identity verified' : 'Verify your identity'}</Text>
                </View>

                <TouchableOpacity style={styles.identityActionButton} onPress={handleGovernmentIdAction} activeOpacity={0.9}>
                  <Ionicons name={hasGovernmentId ? 'checkmark-circle-outline' : 'scan-outline'} size={20} color="#2563EB" />
                </TouchableOpacity>
              </View>

              <View style={styles.identityDivider} />

              <Text style={styles.identityAcceptedTitle}>ACCEPTED DOCUMENTS</Text>
              <View style={styles.identityDocumentsRow}>
                {['Passport', "Driver's License", 'National ID'].map((doc) => (
                  <View key={doc} style={styles.identityDocumentPill}>
                    <Text style={styles.identityDocumentPillText}>{doc}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showGovernmentScanModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGovernmentScanModal(false)}
      >
        <View style={styles.scanModalBackdrop}>
          <View style={styles.scanModalCard}>
            <View style={styles.scanModalHandle} />
            <Text style={styles.scanModalTitle}>Scan Government ID</Text>
            <Text style={styles.scanModalSubtitle}>
              Position your ID within the frame. The scan will happen automatically.
            </Text>

            <View style={styles.scanPreviewOuter}>
              <View style={styles.scanPreviewInner} />
            </View>

            <View style={styles.scanActionsRow}>
              <TouchableOpacity style={styles.scanSecondaryButton} onPress={showGovernmentIdUnavailableToast} activeOpacity={0.9}>
                <Text style={styles.scanSecondaryButtonText}>Upload File</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.scanPrimaryButton} onPress={showGovernmentIdUnavailableToast} activeOpacity={0.9}>
                <Text style={styles.scanPrimaryButtonText}>Capture Manually</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {isToastVisible ? (
        <View style={styles.toastWrapper}>
          <View style={styles.toastCard}>
            <Ionicons name="information-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      ) : null}

      <Navigation
        activeTab={profileTab}
        onTabPress={handleTabPress}
        messageBadgeCount={messageBadgeCount}
        profileInitials={initials}
      />

      <AddExperience
        visible={showAddExperience}
        initialTotalExperience={profile?.totalExperience || ''}
        onClose={() => setShowAddExperience(false)}
        onAdd={async (data) => {
          try {
            const token = await AsyncStorage.getItem('auth_token');
            if (!token) return;

            await apiRequest(
              `${API_URL}/auth/me`,
              {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ totalExperience: data.totalExperience }),
              },
              'Failed to update experience.',
            );

            await loadProfile();
          } catch (error) {
            console.log('Failed to update experience', error);
          } finally {
            setShowAddExperience(false);
          }
        }}
      />

      <AddCV
        visible={showAddCV}
        onClose={() => setShowAddCV(false)}
        onAdd={async () => {
          await loadProfile();
          setShowAddCV(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 24,
  },
  profileHero: {
    alignItems: 'center',
    gap: 10,
  },
  avatarFrame: {
    width: 142,
    height: 142,
    borderRadius: 28,
    backgroundColor: '#EEF2F7',
    borderWidth: 1,
    borderColor: '#D7DEE9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatar: {
    width: 122,
    height: 122,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  editAvatarButton: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#2563EB',
    ...tokens.shadow.card,
  },
  profileName: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: '#111827',
    textAlign: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  verificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D9E0EA',
    padding: 18,
    gap: 14,
    ...tokens.shadow.card,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  verificationIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF2FF',
  },
  verificationTextBlock: {
    flex: 1,
    gap: 4,
  },
  verificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verificationTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  verificationSubtitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 22,
  },
  verificationScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verificationScoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  verificationScoreValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2563EB',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#DDE7FF',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  verificationItemsRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5EAF2',
    paddingTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  verificationItem: {
    minWidth: '22%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  verificationItemText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  verificationItemTextIncomplete: {
    color: '#94A3B8',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E0EA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: '#111827',
  },
  sectionAction: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2F7',
  },
  listCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9E0EA',
    backgroundColor: '#FFFFFF',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  listIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F6FA',
    borderWidth: 1,
    borderColor: '#E3E8F0',
  },
  listContent: {
    flex: 1,
    gap: 2,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.4,
  },
  listSubtitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 20,
  },
  listPeriodPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#EEF2F7',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  listPeriodText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9E0EA',
    borderStyle: 'dashed',
    backgroundColor: '#FFFFFF',
    padding: 18,
  },
  emptyCardText: {
    fontSize: 16,
    color: '#64748B',
  },
  documentCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  documentCardActive: {
    borderColor: '#F2C9D4',
    backgroundColor: '#FFF8FA',
  },
  documentCardEmpty: {
    borderColor: '#D9E0EA',
  },
  documentsStack: {
    gap: 12,
  },
  documentIconWrap: {
    backgroundColor: '#FFF1F4',
    borderColor: '#F5CFD9',
  },
  identityCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9E0EA',
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  identityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  identityIconWrap: {
    backgroundColor: '#EAF2FF',
    borderColor: '#D2E3FF',
  },
  identityActionButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EDF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D9E8FF',
  },
  identityDivider: {
    marginTop: 14,
    marginBottom: 12,
    height: 1,
    backgroundColor: '#E5EAF2',
  },
  identityAcceptedTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#64748B',
    marginBottom: 10,
  },
  identityDocumentsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  identityDocumentPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D9E0EA',
  },
  identityDocumentPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  downloadButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFE9EF',
  },
  scanModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  scanModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E5EAF2',
  },
  scanModalHandle: {
    alignSelf: 'center',
    width: 78,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#EEF2F7',
    marginBottom: 16,
  },
  scanModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  scanModalSubtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: '#64748B',
    textAlign: 'center',
  },
  scanPreviewOuter: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: '#12233F',
    borderWidth: 2,
    borderColor: '#1E3A63',
    padding: 10,
  },
  scanPreviewInner: {
    height: 200,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: '#0F1D37',
  },
  scanActionsRow: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 10,
  },
  scanSecondaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  scanSecondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  scanPrimaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  scanPrimaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  toastWrapper: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 92,
    zIndex: 120,
  },
  toastCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  toastText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
});
