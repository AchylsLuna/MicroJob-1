import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '../../config';
import EmployerNavigation from '../../components/employerNavigation';
import TabTopNav from '../../components/TabTopNav';
import { apiRequest, asObject } from '../../lib/api';
import { tokens } from '../../theme/tokens';

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
};

export default function EmployerProfile({
  employer,
  activeTab,
  onTabPress,
  onOpenWallet,
  onOpenSettings,
  currentRole = 'employer',
  onSwitchRole,
}: EmployerProfileProps) {
  const [firstName, setFirstName] = useState(employer?.firstName || '');
  const [lastName, setLastName] = useState(employer?.lastName || '');
  const [email, setEmail] = useState(employer?.email || '');
  const [phone, setPhone] = useState(employer?.phone || '');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const employerName = firstName || lastName
    ? `${firstName} ${lastName}`.trim()
    : 'Employer';
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
        const result = await apiRequest(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }, 'Failed to load profile.');
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
      Alert.alert('Error', 'Name and email are required.');
      return;
    }

    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/auth/me`, {
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
      }, 'Failed to update profile.');

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
      Alert.alert('Success', 'Profile updated.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update profile.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please allow photo access to upload a profile picture.');
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
        Alert.alert('Error', 'Please sign in again.');
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
      const result = await apiRequest(`${API_URL}/auth/profile/avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      }, 'Failed to upload profile picture.');

      if (!result.ok) {
        throw new Error(result.message || 'Failed to upload profile picture.');
      }

      const payload = asObject<any>(result.raw) || {};
      const dataPayload = asObject<any>(result.data) || {};
      const nextAvatarUrl = dataPayload?.data?.avatarUrl || payload?.data?.avatarUrl || dataPayload?.avatarUrl;
      if (nextAvatarUrl) {
        setAvatarUrl(nextAvatarUrl);
      }
      Alert.alert('Success', 'Profile picture updated.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to upload profile picture.');
    } finally {
      setIsLoading(false);
    }
  };
  const avatarSource = avatarUrl
    ? { uri: avatarUrl.startsWith('http') ? avatarUrl : `${API_URL.replace(/\/api$/, '')}${avatarUrl}` }
    : null;

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
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <TouchableOpacity style={styles.avatar} onPress={handleUploadAvatar}>
            {avatarSource ? (
              <Image source={avatarSource} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleUploadAvatar}>
            <Text style={styles.changePhotoText}>Change profile photo</Text>
          </TouchableOpacity>
          <Text style={styles.name}>{employerName}</Text>
          <Text style={styles.subtitle}>Employer account</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Name</Text>
          <View style={styles.nameRow}>
            <TextInput
              style={[styles.input, styles.nameInput]}
              placeholder="First Name"
              placeholderTextColor="#9ca3af"
              value={firstName}
              onChangeText={setFirstName}
            />
            <TextInput
              style={[styles.input, styles.nameInput]}
              placeholder="Last Name"
              placeholderTextColor="#9ca3af"
              value={lastName}
              onChangeText={setLastName}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Add phone number"
            placeholderTextColor="#9ca3af"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <TextInput
            style={styles.input}
            placeholder="City / Location"
            placeholderTextColor="#9ca3af"
            value={city}
            onChangeText={setCity}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Full address"
            placeholderTextColor="#9ca3af"
            value={address}
            onChangeText={setAddress}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Profile</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={onOpenSettings}
          disabled={!onOpenSettings}
        >
          <Text style={styles.settingsButtonText}>⚙ Open Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.walletButton}
          onPress={onOpenWallet}
          disabled={!onOpenWallet}
        >
          <Text style={styles.walletButtonText}>💼 View E-Wallet</Text>
        </TouchableOpacity>

      </ScrollView>

      <EmployerNavigation activeTab={activeTab} onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 90 },
  profileCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    ...tokens.shadow.card,
    marginBottom: 20,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1e3a5f',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarText: { color: '#ffffff', fontWeight: '700', fontSize: 20 },
  changePhotoText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
    marginBottom: 6,
  },
  name: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 8 },
  meta: { fontSize: 12, color: '#9ca3af' },
  statRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 16,
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#1e3a5f' },
  statLabel: { fontSize: 12, color: '#6b7280' },
  section: {
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
  nameRow: { flexDirection: 'row', gap: 10 },
  nameInput: { flex: 1 },
  saveButton: {
    marginTop: 8,
    backgroundColor: '#1e3a5f',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  walletButton: {
    marginTop: 12,
    backgroundColor: '#1e5a3f',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  walletButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  settingsButton: {
    marginTop: 12,
    backgroundColor: '#1e3a8a',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  settingsButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
