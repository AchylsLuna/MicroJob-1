import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../config';
import EmployerNavigation from '../../components/employerNavigation';
import TabTopNav from '../../components/TabTopNav';
import { apiRequest, asObject } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import { useToast } from '../../contexts/ToastContext';

type EmployerProfileProps = {
  employer?: {
    firstName?: string;
    lastName?: string;
    title?: string;
    location?: string;
    bio?: string;
    rating?: number;
    hires?: number;
    email?: string;
    phone?: string;
  };
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  onOpenWallet?: () => void;
  onOpenSettings?: () => void;
  currentRole?: 'worker' | 'employer';
  onSwitchRole?: (role: 'worker' | 'employer') => void;
  canSwitchRole?: boolean;
};

export default function EmployerProfile({
  employer,
  activeTab,
  onTabPress,
  onOpenWallet,
  onOpenSettings,
  currentRole = 'employer',
  onSwitchRole,
  canSwitchRole = false,
}: EmployerProfileProps) {
  const [firstName, setFirstName] = useState(employer?.firstName || '');
  const [lastName, setLastName] = useState(employer?.lastName || '');
  const [email, setEmail] = useState(employer?.email || '');
  const [phone, setPhone] = useState(employer?.phone || '');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const employerName = firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Employer';
  const initials = employerName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('auth_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setFirstName(parsed?.firstName || '');
          setLastName(parsed?.lastName || '');
          setEmail(parsed?.email || '');
          setPhone(parsed?.phoneNumber || '');
          setCity(parsed?.city || '');
          setAddress(parsed?.address || '');
          setAvatarUrl(parsed?.avatarUrl || '');
        }
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) return;
        const result = await apiRequest(
          `${API_URL}/auth/me`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
          'Failed to load profile.',
        );
        if (!result.ok) return;
        const payload = asObject<any>(result.raw) || {};
        const dataPayload = asObject<any>(result.data) || {};
        const profile = dataPayload?.user || payload?.user || dataPayload?.profile || payload?.profile || dataPayload;
        if (profile) {
          setFirstName(profile.firstName || '');
          setLastName(profile.lastName || '');
          setEmail(profile.email || '');
          setPhone(profile.phoneNumber || '');
          setCity(profile.city || '');
          setAddress(profile.address || '');
          setAvatarUrl(profile.avatarUrl || '');
        }
      } catch (error) {
        console.log('Failed to load employer profile', error);
      }
    };

    loadProfile();
  }, []);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error('Name and email are required.');
      return;
    }

    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(
        `${API_URL}/auth/me`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim().toLowerCase(),
            phoneNumber: phone.trim(),
            city: city.trim(),
            address: address.trim(),
          }),
        },
        'Failed to update profile.',
      );

      if (!result.ok) {
        throw new Error(result.message || 'Failed to update profile.');
      }

      const payload = asObject<any>(result.raw) || {};
      const dataPayload = asObject<any>(result.data) || {};
      const user = dataPayload?.user || payload?.user || dataPayload;
      if (user) {
        setAvatarUrl(user.avatarUrl || avatarUrl);
        await AsyncStorage.setItem('auth_user', JSON.stringify(user));
      }
      toast.success('Profile updated.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update profile.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast.error('Please allow photo access to upload a profile picture.');
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (picked.canceled || !picked.assets?.length) {
        return;
      }

      const asset = picked.assets[0];
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        toast.error('Please sign in again.');
        return;
      }

      const ext = (asset.fileName?.split('.').pop() || 'jpg').toLowerCase();
      const mime = asset.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const form = new FormData();
      form.append('avatar', {
        uri: asset.uri,
        name: asset.fileName || `avatar.${ext}`,
        type: mime,
      } as any);

      setIsLoading(true);
      const result = await apiRequest(
        `${API_URL}/auth/profile/avatar`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: form,
        },
        'Failed to upload profile picture.',
      );

      if (!result.ok) {
        throw new Error(result.message || 'Failed to upload profile picture.');
      }

      const payload = asObject<any>(result.raw) || {};
      const dataPayload = asObject<any>(result.data) || {};
      const nextAvatarUrl = dataPayload?.data?.avatarUrl || payload?.data?.avatarUrl || dataPayload?.avatarUrl;
      if (nextAvatarUrl) {
        setAvatarUrl(nextAvatarUrl);
      }
      toast.success('Profile picture updated.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to upload profile picture.');
    } finally {
      setIsLoading(false);
    }
  };

  const avatarSource = useMemo(
    () => (avatarUrl ? { uri: avatarUrl.startsWith('http') ? avatarUrl : `${API_URL.replace(/\/api$/, '')}${avatarUrl}` } : null),
    [avatarUrl],
  );

  const completionItems = useMemo(
    () => [
      { label: 'Photo', complete: Boolean(avatarUrl) },
      { label: 'Name', complete: Boolean(firstName.trim() && lastName.trim()) },
      { label: 'Email', complete: Boolean(email.trim()) },
      { label: 'Phone', complete: Boolean(phone.trim()) },
      { label: 'City', complete: Boolean(city.trim()) },
      { label: 'Address', complete: Boolean(address.trim()) },
    ],
    [address, avatarUrl, city, email, firstName, lastName, phone],
  );

  const completedCount = completionItems.filter((item) => item.complete).length;
  const completionRate = Math.round((completedCount / completionItems.length) * 100);

  return (
    <View style={styles.container}>
      <TabTopNav
        title="My Profile"
        currentRole={currentRole}
        onSwitchRole={onSwitchRole}
        onOpenSettings={onOpenSettings}
        showModeSwitch={canSwitchRole}
        showSettings
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />

          <View style={styles.heroTopRow}>
            <View style={styles.avatarFrame}>
              <TouchableOpacity style={styles.avatar} onPress={handleUploadAvatar} disabled={isLoading} activeOpacity={0.92}>
                {avatarSource ? <Image source={avatarSource} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials}</Text>}
                {isLoading ? (
                  <View style={styles.avatarLoadingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                ) : null}
              </TouchableOpacity>
              <TouchableOpacity style={styles.avatarEditButton} onPress={handleUploadAvatar} disabled={isLoading} activeOpacity={0.92}>
                <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroMeta}>
              <View style={styles.heroBadge}>
                <Ionicons name="business-outline" size={15} color="#2563EB" />
                <Text style={styles.heroBadgeText}>Employer account</Text>
              </View>
              <Text style={styles.name}>{employerName}</Text>
              <Text style={styles.subtitle}>Manage the profile workers see before they apply, message, or accept an offer.</Text>
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{completionRate}%</Text>
              <Text style={styles.heroStatLabel}>Profile complete</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{completedCount}/{completionItems.length}</Text>
              <Text style={styles.heroStatLabel}>Ready items</Text>
            </View>
          </View>

          <View style={styles.heroActionRow}>
            <TouchableOpacity
              style={[styles.secondaryAction, !onOpenSettings && styles.disabledAction]}
              onPress={onOpenSettings}
              disabled={!onOpenSettings}
              activeOpacity={0.9}
            >
              <Ionicons name="settings-outline" size={18} color="#334155" />
              <Text style={styles.secondaryActionText}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryAction, !onOpenWallet && styles.disabledAction]}
              onPress={onOpenWallet}
              disabled={!onOpenWallet}
              activeOpacity={0.9}
            >
              <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>Wallet</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Employer readiness</Text>
            <Text style={styles.sectionHint}>{completionRate}%</Text>
          </View>
          <Text style={styles.progressSubtitle}>Complete your public details so workers can trust the profile behind every job post.</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${completionRate}%` }]} />
          </View>
          <View style={styles.checklistRow}>
            {completionItems.map((item) => (
              <View key={item.label} style={styles.checklistItem}>
                <Ionicons
                  name={item.complete ? 'checkmark-circle' : 'ellipse-outline'}
                  size={15}
                  color={item.complete ? '#22C55E' : '#94A3B8'}
                />
                <Text style={[styles.checklistText, !item.complete && styles.checklistTextMuted]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Identity</Text>
            <Text style={styles.sectionHint}>Visible on employer profile</Text>
          </View>

          <Text style={styles.fieldLabel}>Name</Text>
          <View style={styles.nameRow}>
            <TextInput
              style={[styles.input, styles.nameInput]}
              placeholder="First Name"
              placeholderTextColor="#94A3B8"
              value={firstName}
              onChangeText={setFirstName}
            />
            <TextInput
              style={[styles.input, styles.nameInput]}
              placeholder="Last Name"
              placeholderTextColor="#94A3B8"
              value={lastName}
              onChangeText={setLastName}
            />
          </View>

          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#94A3B8"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Contact & location</Text>
            <Text style={styles.sectionHint}>Used for support and job context</Text>
          </View>

          <Text style={styles.fieldLabel}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Add phone number"
            placeholderTextColor="#94A3B8"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.fieldLabel}>City</Text>
          <TextInput
            style={styles.input}
            placeholder="City / Location"
            placeholderTextColor="#94A3B8"
            value={city}
            onChangeText={setCity}
          />

          <Text style={styles.fieldLabel}>Address</Text>
          <TextInput
            style={[styles.input, styles.addressInput]}
            placeholder="Full address"
            placeholderTextColor="#94A3B8"
            value={address}
            onChangeText={setAddress}
            multiline
          />
        </View>

        <TouchableOpacity style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} onPress={handleSave} disabled={isLoading} activeOpacity={0.92}>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Save Profile</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <EmployerNavigation activeTab={activeTab} onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 112,
    gap: 18,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D9E0EA',
    backgroundColor: '#FFFFFF',
    padding: 18,
    gap: 18,
    overflow: 'hidden',
    ...tokens.shadow.card,
  },
  heroGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: '#EAF2FF',
    top: -60,
    right: -36,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarFrame: {
    width: 120,
    height: 120,
    borderRadius: 28,
    backgroundColor: '#EEF2F7',
    borderWidth: 1,
    borderColor: '#D7DEE9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CBD5E1',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 28,
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  avatarEditButton: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadow.card,
  },
  heroMeta: {
    flex: 1,
    gap: 8,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EAF2FF',
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: '#64748B',
    fontWeight: '500',
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heroStatCard: {
    flex: 1,
    minHeight: 88,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9E0EA',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  heroStatValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#111827',
  },
  heroStatLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E0EA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  primaryAction: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#1C4D8D',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...tokens.shadow.card,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabledAction: {
    opacity: 0.55,
  },
  progressCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D9E0EA',
    backgroundColor: '#FFFFFF',
    padding: 18,
    gap: 12,
    ...tokens.shadow.card,
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D9E0EA',
    backgroundColor: '#FFFFFF',
    padding: 18,
    gap: 10,
    ...tokens.shadow.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: '#111827',
  },
  sectionHint: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  progressSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: '#64748B',
    fontWeight: '500',
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
  checklistRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5EAF2',
    paddingTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  checklistItem: {
    minWidth: '29%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checklistText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  checklistTextMuted: {
    color: '#94A3B8',
  },
  fieldLabel: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  nameRow: {
    flexDirection: 'row',
    gap: 10,
  },
  nameInput: {
    flex: 1,
  },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E0EA',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
  addressInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  saveButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
    ...tokens.shadow.card,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
