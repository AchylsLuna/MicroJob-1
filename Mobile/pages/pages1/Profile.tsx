import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '../../lib/storage';
import { Ionicons } from '@expo/vector-icons';
import ScrollView from '../../components/ui/SmoothScrollView';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Constants from 'expo-constants';
import Navigation from '../../components/navigation';
import TabTopNav from '../../components/TabTopNav';
import AddCV from './AddCV';
import AddExperience, { type ExperienceDraft } from './AddExperience';
import { API_URL } from '../../config';
import { safeExternalUrl } from '../../lib/safeExternalUrl';
import { apiRequest } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import { useToast } from '../../contexts/ToastContext';
import { calculateProfileCompletion } from '../../lib/profileCompletion';
import { validateMobileAvatar } from '../../lib/profileValidation';
import ProfileReviewsLoader from '../../components/reviews/ProfileReviewsLoader';

type ProfileProps = {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  onOpenSettings?: () => void;
  messageBadgeCount?: number;
  initialAction?: 'resume';
  actionNonce?: number;
};

type ExperienceItem = {
  id: string;
  title: string;
  subtitle: string;
  period?: string;
  description?: string;
  raw?: any;
};

const toMonthInput = (value: unknown) => {
  if (!value) return '';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 7) : date.toISOString().slice(0, 7);
};

const getVerificationMimeType = (name: string, provided?: string | null) => {
  if (provided) return provided;
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
};

export default function Profile({
  activeTab = 'Profile',
  onTabPress,
  onOpenSettings,
  messageBadgeCount = 0,
  initialAction,
  actionNonce,
}: ProfileProps) {
  const [showAddExperience, setShowAddExperience] = useState(false);
  const [editingExperience, setEditingExperience] = useState<(ExperienceDraft & { id: string }) | null>(null);
  const [showAddCV, setShowAddCV] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingGovernmentId, setIsUploadingGovernmentId] = useState(false);
  const [isUploadingAddressDocument, setIsUploadingAddressDocument] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [deletingExperienceId, setDeletingExperienceId] = useState<string | null>(null);
  const [isDeletingResume, setIsDeletingResume] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (initialAction === 'resume') setShowAddCV(true);
  }, [actionNonce, initialAction]);

  const API_ORIGIN = API_URL.replace(/\/api$/, '');
  const apiPort = (() => {
    try {
      const parsed = new URL(API_ORIGIN);
      if (parsed.port) return parsed.port;
      return parsed.protocol === 'https:' ? '443' : '80';
    } catch {
      return '5050';
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
    onTabPress?.(tab);
  };

  const handlePickProfilePicture = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast.error('We need access to your photo library to upload a profile picture.');
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
      toast.error('Failed to pick image.');
    }
  };

  const handleUploadProfilePicture = async (image: ImagePicker.ImagePickerAsset) => {
    try {
      const { extension, mimeType, error: avatarError } = validateMobileAvatar(image);
      if (avatarError) {
        toast.error(avatarError);
        return;
      }
      setIsUploadingAvatar(true);
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        toast.error('Authentication token not found.');
        return;
      }

      let uploadUri = image.uri;
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
        type: mimeType,
        name: fileName,
      } as any);

      const apiCandidates = buildApiCandidates();
      let uploadSuccess = false;
      let lastError = 'Network request failed';

      for (const apiBase of apiCandidates) {
        const controller = new AbortController();
        const timeoutId = globalThis.setTimeout(() => controller.abort(), 12000);
        try {
          const response = await fetch(`${apiBase}/auth/profile/avatar`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
            signal: controller.signal,
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
          lastError = err instanceof Error && err.name === 'AbortError'
            ? 'The upload took too long. Please try again.'
            : err instanceof Error ? err.message : String(err);
          console.log(`Avatar upload failed for ${apiBase}:`, err);
        } finally {
          globalThis.clearTimeout(timeoutId);
        }
      }

      if (!uploadSuccess) {
        throw new Error(lastError);
      }

      await loadProfile();
      toast.success('Profile picture updated successfully.');
    } catch (error) {
      console.log('Error uploading profile picture:', error);
      toast.error(error instanceof Error ? error.message : 'Could not upload profile picture. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const loadProfile = useCallback(async () => {
    setIsProfileLoading(true);
    try {
      const storedUser = await AsyncStorage.getItem('auth_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setFirstName(parsed?.firstName || '');
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
        setProfileError(result.message || 'Failed to load profile.');
        return;
      }

      const nextProfile = result.data as any;
      if (!nextProfile) {
        return;
      }

      setFirstName(nextProfile.firstName || '');
      setLastName(nextProfile.lastName || '');
      setProfile(nextProfile);
      setProfileError('');
    } catch (error) {
      console.log('Failed to load profile:', error);
      setProfileError('Could not refresh your profile. Pull down to try again.');
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadProfile();
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (activeTab === 'Profile') {
      loadProfile();
    }
  }, [activeTab, loadProfile]);

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'User';
  const locationLabel = [profile?.city, profile?.province, profile?.country].filter(Boolean).join(', ') || 'Location not set';
  const jobsApplied = typeof profile?.jobsApplied === 'number' ? profile.jobsApplied : 0;
  const jobsCompleted = typeof profile?.projectsCompleted === 'number' ? profile.projectsCompleted : 0;

  const resumeUrl = profile?.resumeUrl || profile?.cvUrl || '';
  const resumeCandidate = resumeUrl
    ? String(resumeUrl).startsWith('http')
      ? resumeUrl
      : `${API_ORIGIN}${resumeUrl}`
    : '';
  const absoluteResumeUrl = safeExternalUrl(resumeCandidate, {
    purpose: 'asset',
    trustedOrigins: [API_ORIGIN],
  });
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
      .toUpperCase() || 'U';

  const verification = profile?.verification || {};
  const identityStatus = verification?.identityDocument?.status || 'pending';
  const addressStatus = verification?.addressDocument?.status || 'pending';
  const verificationItems = [
    { label: 'Email', complete: verification?.emailVerified === true },
    { label: 'Phone', complete: verification?.phoneVerified === true },
    { label: 'Gov ID', complete: verification?.identityVerified === true },
    { label: 'Address', complete: verification?.addressVerified === true },
  ];
  const hasGovernmentId = verification?.identityVerified === true;
  const hasVerifiedAddress = verification?.addressVerified === true;

  const verifiedCount = verificationItems.filter((item) => item.complete).length;
  const verificationStrength = Math.round((verifiedCount / verificationItems.length) * 100);
  const isFullyVerified = verifiedCount === verificationItems.length;
  const profileCompletion = calculateProfileCompletion({
    ...profile,
    totalExperience: profile?.totalExperience || (profile?.workExperience?.length ? 'Added' : ''),
  });

  const totalExperience = profile?.totalExperience || '';
  const experienceItems: ExperienceItem[] = useMemo(() => {
    const normalize = (entry: any): ExperienceItem | null => {
      const title = entry?.title || entry?.position || entry?.role || entry?.jobTitle || '';
      const company = entry?.company || entry?.companyName || '';
      const location = entry?.location || entry?.city || '';
      const formatDate = (value: unknown) => {
        if (!value) return '';
        const date = new Date(String(value));
        return Number.isNaN(date.getTime())
          ? String(value)
          : date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      };
      const periodFromDates = [formatDate(entry?.startDate), entry?.current ? 'Present' : formatDate(entry?.endDate)].filter(Boolean).join(' – ');
      const period = entry?.period || entry?.duration || periodFromDates || '';
      const subtitle = [company, location].filter(Boolean).join(' • ');

      if (!title && !subtitle && !period) {
        return null;
      }

      return {
        id: String(entry?._id || entry?.id || ''),
        title: title || 'Work Experience',
        subtitle: subtitle || 'Professional background',
        period,
        description: entry?.description || '',
        raw: entry,
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
          id: 'experience-summary',
          title: 'Experience Summary',
          subtitle: totalExperience,
          period: '',
        },
      ];
    }

    return [];
  }, [profile, totalExperience]);

  const handleOpenResume = async () => {
    const resumeFileName = profile?.resumeFileName || String(resumeUrl || '').split('/').pop();
    if (!absoluteResumeUrl || !resumeFileName) {
      toast.info('Upload a CV in Documents first.');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        toast.error('Please sign in again.');
        return;
      }
      const result = await apiRequest<{ url?: string }>(
        `${API_URL}/auth/files/${encodeURIComponent(resumeFileName)}/access-link`,
        { headers: { Authorization: `Bearer ${token}` } },
        'Could not create a secure résumé link.',
      );
      if (!result.ok || !result.data?.url) {
        throw new Error(result.message);
      }
      const candidate = result.data.url.startsWith('http')
        ? result.data.url
        : `${API_ORIGIN}${result.data.url}`;
      const secureResumeUrl = safeExternalUrl(candidate, {
        purpose: 'asset',
        trustedOrigins: [API_ORIGIN],
      });
      if (!secureResumeUrl) throw new Error('Invalid résumé URL');
      const canOpen = await Linking.canOpenURL(secureResumeUrl);
      if (!canOpen) {
        throw new Error('Unsupported URL');
      }
      await Linking.openURL(secureResumeUrl);
    } catch {
      toast.error('Could not open the uploaded document.');
    }
  };

  const deleteExperience = async (experienceId: string) => {
    if (!experienceId || experienceId === 'experience-summary') return;
    try {
      setDeletingExperienceId(experienceId);
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) throw new Error('Please sign in again.');
      const result = await apiRequest(
        `${API_URL}/auth/profile/experience/${encodeURIComponent(experienceId)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
        'Failed to remove work experience.',
      );
      if (!result.ok) throw new Error(result.message);
      await loadProfile();
      toast.success('Work experience removed.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove work experience.');
    } finally {
      setDeletingExperienceId(null);
    }
  };

  const handleDeleteExperience = (item: ExperienceItem) => {
    if (!item.id || item.id === 'experience-summary') return;
    Alert.alert('Remove experience?', `${item.title} will be removed from your profile.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void deleteExperience(item.id) },
    ]);
  };

  const deleteResume = async () => {
    try {
      setIsDeletingResume(true);
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) throw new Error('Please sign in again.');
      const result = await apiRequest(
        `${API_URL}/auth/profile/resume`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
        'Failed to remove résumé.',
      );
      if (!result.ok) throw new Error(result.message);
      await loadProfile();
      toast.success('Résumé removed.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove résumé.');
    } finally {
      setIsDeletingResume(false);
    }
  };

  const handleDeleteResume = () => {
    Alert.alert('Remove résumé?', 'This document will be removed from your profile.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void deleteResume() },
    ]);
  };

  const handleGovernmentIdAction = async () => {
    if (identityStatus === 'in-review') {
      toast.info('Your government ID is already under review.');
      return;
    }
    if (hasGovernmentId) {
      toast.info('Your government ID is verified.');
      return;
    }

    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.length) return;

      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        toast.error('Please sign in again.');
        return;
      }

      const asset = picked.assets[0];
      const documentName = asset.name || `identity-${Date.now()}.jpg`;
      const form = new FormData();
      form.append('document', {
        uri: asset.uri,
        name: documentName,
        type: getVerificationMimeType(documentName, asset.mimeType),
      } as any);

      setIsUploadingGovernmentId(true);
      const result = await apiRequest(
        `${API_URL}/auth/verification/documents/identity`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        },
        'Failed to upload government ID.',
      );
      if (!result.ok) throw new Error(result.message);

      toast.success('Government ID uploaded for review.');
      await loadProfile();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to upload government ID.');
    } finally {
      setIsUploadingGovernmentId(false);
    }
  };

  const handleAddressDocumentAction = async () => {
    if (addressStatus === 'in-review') {
      toast.info('Your proof of address is already under review.');
      return;
    }
    if (hasVerifiedAddress) {
      toast.info('Your address is verified.');
      return;
    }

    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.length) return;

      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        toast.error('Please sign in again.');
        return;
      }

      const asset = picked.assets[0];
      const documentName = asset.name || `address-${Date.now()}.jpg`;
      const form = new FormData();
      form.append('document', {
        uri: asset.uri,
        name: documentName,
        type: getVerificationMimeType(documentName, asset.mimeType),
      } as any);

      setIsUploadingAddressDocument(true);
      const result = await apiRequest(
        `${API_URL}/auth/verification/documents/address`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        },
        'Failed to upload proof of address.',
      );
      if (!result.ok) throw new Error(result.message);

      toast.success('Proof of address uploaded for review.');
      await loadProfile();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to upload proof of address.');
    } finally {
      setIsUploadingAddressDocument(false);
    }
  };

  return (
    <View style={styles.container}>
      <TabTopNav
        title="My Profile"
        onOpenSettings={onOpenSettings}
        showSettings
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#1C4D8D" colors={["#1C4D8D"]} />}
      >
        {isProfileLoading && !profile ? (
          <View style={styles.loadingCard} accessibilityRole="progressbar" accessibilityLabel="Loading your profile">
            <ActivityIndicator color="#1C4D8D" />
            <Text style={styles.loadingCardText}>Loading your profile...</Text>
          </View>
        ) : null}
        {profileError ? (
          <TouchableOpacity style={styles.errorCard} onPress={handleRefresh} accessibilityRole="button" accessibilityLabel="Retry loading profile" accessibilityLiveRegion="assertive">
            <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
            <Text style={styles.errorCardText}>{profileError} Tap to retry.</Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.profileHero}>
          <View style={styles.avatarFrame}>
            <TouchableOpacity style={styles.avatar} onPress={handlePickProfilePicture} disabled={isUploadingAvatar} accessibilityRole="button" accessibilityLabel="Change profile picture" accessibilityHint="Opens your photo library" accessibilityState={{ disabled: isUploadingAvatar, busy: isUploadingAvatar }}>
              {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarImage} accessibilityLabel="Current profile photo" /> : <Text style={styles.avatarInitials}>{initials}</Text>}
              {isUploadingAvatar ? (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              ) : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editAvatarButton}
              onPress={handlePickProfilePicture}
              accessibilityRole="button"
              accessibilityState={{ disabled: isUploadingAvatar }}
              disabled={isUploadingAvatar}
              activeOpacity={0.9}
              accessibilityLabel="Edit profile photo"
              accessible={false}
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

        <View style={styles.completionCard}>
          <View style={styles.completionHeader}>
            <View>
              <Text style={styles.completionTitle}>Profile completeness</Text>
              <Text style={styles.completionSubtitle}>
                {profileCompletion.percentage === 100 ? 'Your profile is ready for employers.' : `${profileCompletion.incompleteFields[0] || 'More details'} is the next useful addition.`}
              </Text>
            </View>
            <Text style={styles.completionValue}>{profileCompletion.percentage}%</Text>
          </View>
          <View style={styles.completionTrack} accessibilityRole="progressbar" accessibilityLabel="Profile completeness" accessibilityValue={{ min: 0, max: 100, now: profileCompletion.percentage, text: `${profileCompletion.percentage}% complete` }}>
            <View style={[styles.completionFill, { width: `${profileCompletion.percentage}%` }]} />
          </View>
        </View>

        <View style={styles.verificationCard}>
          <View style={styles.verificationHeader}>
            <View style={styles.verificationIconWrap}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#1C4D8D" />
            </View>
            <View style={styles.verificationTextBlock}>
              <View style={styles.verificationTitleRow}>
                <Text style={styles.verificationTitle}>{isFullyVerified ? 'Account verified' : 'Verification incomplete'}</Text>
                <Ionicons
                  name={isFullyVerified ? 'checkmark-circle' : 'alert-circle-outline'}
                  size={16}
                  color={isFullyVerified ? '#16A34A' : '#D97706'}
                />
              </View>
              <Text style={styles.verificationSubtitle}>
                {isFullyVerified ? 'All account verification checks are complete' : 'Complete the remaining account checks'}
              </Text>
            </View>
          </View>

          <View style={styles.verificationScoreRow}>
            <Text style={styles.verificationScoreLabel}>Verification Strength</Text>
            <Text style={styles.verificationScoreValue}>{verificationStrength}%</Text>
          </View>

          <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityLabel="Verification strength" accessibilityValue={{ min: 0, max: 100, now: verificationStrength, text: `${verificationStrength}% complete` }}>
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
            <Text style={styles.statValue}>{jobsCompleted}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Work Experience</Text>
            <TouchableOpacity style={styles.sectionAction} onPress={() => {
              if ((profile?.workExperience?.length || 0) >= 25) {
                toast.error('You can add up to 25 work experience entries.');
                return;
              }
              setEditingExperience(null);
              setShowAddExperience(true);
            }} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="Add work experience">
              <Ionicons name="add" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {experienceItems.length ? (
            experienceItems.map((item, index) => (
              <View style={styles.listCard} key={item.id || `${item.title}-${index}`}>
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
                  {item.description ? <Text style={styles.experienceDescription}>{item.description}</Text> : null}
                </View>
                {item.id && item.id !== 'experience-summary' ? (
                  <View style={styles.itemActions}>
                    <TouchableOpacity
                      style={styles.itemEditButton}
                      onPress={() => {
                        setEditingExperience({
                          id: item.id,
                          title: item.raw?.title || item.title,
                          company: item.raw?.company || '',
                          location: item.raw?.location || '',
                          startDate: toMonthInput(item.raw?.startDate),
                          endDate: item.raw?.current ? '' : toMonthInput(item.raw?.endDate),
                          current: Boolean(item.raw?.current),
                          description: item.raw?.description || '',
                        });
                        setShowAddExperience(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${item.title} experience`}
                    >
                      <Ionicons name="create-outline" size={18} color="#1C4D8D" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.itemDeleteButton} onPress={() => handleDeleteExperience(item)} disabled={deletingExperienceId === item.id} accessibilityRole="button" accessibilityLabel={`Remove ${item.title} experience`}>
                      {deletingExperienceId === item.id ? <ActivityIndicator size="small" color="#DC2626" /> : <Ionicons name="trash-outline" size={18} color="#DC2626" />}
                    </TouchableOpacity>
                  </View>
                ) : null}
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
            <TouchableOpacity style={styles.sectionAction} onPress={() => setShowAddCV(true)} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="Add CV or resume">
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
                <View style={styles.documentActions}>
                  <TouchableOpacity style={styles.downloadButton} onPress={handleOpenResume} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="Open resume">
                    <Ionicons name="download-outline" size={20} color="#E11D48" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.downloadButton} onPress={handleDeleteResume} disabled={isDeletingResume} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="Remove resume">
                    {isDeletingResume ? <ActivityIndicator size="small" color="#DC2626" /> : <Ionicons name="trash-outline" size={19} color="#DC2626" />}
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            <View style={styles.identityCard}>
              <View style={styles.identityTopRow}>
                <View style={[styles.listIconWrap, styles.identityIconWrap]}>
                  <Ionicons name="card-outline" size={20} color="#1C4D8D" />
                </View>

                <View style={styles.listContent}>
                  <Text style={styles.listTitle}>Government ID</Text>
                  <Text style={styles.listSubtitle}>
                    {hasGovernmentId
                      ? 'Identity verified'
                      : identityStatus === 'in-review'
                        ? 'Document under review'
                        : identityStatus === 'rejected'
                          ? 'Document rejected — upload a replacement'
                          : 'Upload an ID for verification'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.identityActionButton}
                  onPress={handleGovernmentIdAction}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel="Manage government ID"
                  disabled={isUploadingGovernmentId}
                >
                  {isUploadingGovernmentId ? (
                    <ActivityIndicator size="small" color="#1C4D8D" />
                  ) : (
                    <Ionicons
                      name={hasGovernmentId ? 'checkmark-circle-outline' : identityStatus === 'in-review' ? 'time-outline' : 'cloud-upload-outline'}
                      size={20}
                      color="#1C4D8D"
                    />
                  )}
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

            <View style={styles.identityCard}>
              <View style={styles.identityTopRow}>
                <View style={[styles.listIconWrap, styles.identityIconWrap]}>
                  <Ionicons name="home-outline" size={20} color="#1C4D8D" />
                </View>
                <View style={styles.listContent}>
                  <Text style={styles.listTitle}>Proof of Address</Text>
                  <Text style={styles.listSubtitle}>
                    {hasVerifiedAddress
                      ? 'Address verified'
                      : addressStatus === 'in-review'
                        ? 'Document under review'
                        : addressStatus === 'rejected'
                          ? 'Document rejected — upload a replacement'
                          : 'Upload a recent bill or bank statement'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.identityActionButton}
                  onPress={handleAddressDocumentAction}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel="Manage proof of address"
                  disabled={isUploadingAddressDocument}
                >
                  {isUploadingAddressDocument ? (
                    <ActivityIndicator size="small" color="#1C4D8D" />
                  ) : (
                    <Ionicons
                      name={hasVerifiedAddress ? 'checkmark-circle-outline' : addressStatus === 'in-review' ? 'time-outline' : 'cloud-upload-outline'}
                      size={20}
                      color="#1C4D8D"
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <ProfileReviewsLoader
          profileOwnerId={String(profile?._id || profile?.id || '')}
          profileOwnerName={displayName}
          viewAs="worker"
        />
      </ScrollView>

      <Navigation
        activeTab={activeTab || 'Profile'}
        onTabPress={handleTabPress}
        messageBadgeCount={messageBadgeCount}
      />

      <AddExperience
        visible={showAddExperience}
        initialValue={editingExperience}
        onClose={() => { setShowAddExperience(false); setEditingExperience(null); }}
        onAdd={async (data) => {
          const token = await AsyncStorage.getItem('auth_token');
          if (!token) throw new Error('Please sign in again.');
          const result = await apiRequest(
            editingExperience
              ? `${API_URL}/auth/profile/experience/${encodeURIComponent(editingExperience.id)}`
              : `${API_URL}/auth/profile/experience`,
            {
              method: editingExperience ? 'PATCH' : 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(data),
            },
            editingExperience ? 'Failed to update work experience.' : 'Failed to add work experience.',
          );
          if (!result.ok) throw new Error(result.message);
          await loadProfile();
          toast.success(editingExperience ? 'Work experience updated.' : 'Work experience added.');
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
    backgroundColor: tokens.colors.signedInCanvas,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: tokens.layout.tabBarClearance,
    gap: 24,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 13,
  },
  loadingCard: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  loadingCardText: {
    fontSize: 13,
    color: '#64748B',
  },
  errorCardText: {
    flex: 1,
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 18,
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
    borderColor: tokens.colors.surface,
    backgroundColor: tokens.colors.brand,
    ...tokens.shadow.card,
  },
  profileName: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: tokens.colors.text,
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
  completionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    padding: 16,
    gap: 12,
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  completionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C4D8D',
  },
  completionSubtitle: {
    marginTop: 3,
    maxWidth: 260,
    fontSize: 12,
    lineHeight: 17,
    color: '#475569',
  },
  completionValue: {
    fontSize: 22,
    fontWeight: '800',
    color: tokens.colors.brand,
  },
  completionTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: tokens.colors.surface,
  },
  completionFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: tokens.colors.brand,
  },
  verificationCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border,
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
    color: tokens.colors.text,
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
    color: tokens.colors.brand,
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
    backgroundColor: tokens.colors.brand,
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
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: tokens.colors.text,
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
    color: tokens.colors.text,
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
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
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
    color: tokens.colors.text,
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
  experienceDescription: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
  },
  itemDeleteButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
  },
  itemActions: {
    gap: 7,
  },
  itemEditButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderStyle: 'dashed',
    backgroundColor: tokens.colors.surface,
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
    backgroundColor: tokens.colors.surface,
  },
  documentCardActive: {
    borderColor: '#F2C9D4',
    backgroundColor: '#FFF8FA',
  },
  documentCardEmpty: {
    borderColor: tokens.colors.border,
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
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
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
    backgroundColor: tokens.colors.contentMuted,
    borderWidth: 1,
    borderColor: tokens.colors.border,
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
  documentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
});
