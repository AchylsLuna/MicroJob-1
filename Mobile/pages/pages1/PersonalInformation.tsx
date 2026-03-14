import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../../config';
import { apiRequest } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import { useToast } from '../../contexts/ToastContext';

type PersonalInformationProps = {
  onBack?: () => void;
  currentRole?: 'worker' | 'employer' | 'both';
};

export default function PersonalInformation({ onBack }: PersonalInformationProps) {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [city, setCity] = useState('');
  const [about, setAbout] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [originalEmail, setOriginalEmail] = useState('');
  const [originalPhoneNumber, setOriginalPhoneNumber] = useState('');
  const toast = useToast();

  useEffect(() => {
    loadProfile();
  }, []);

  const avatarSource = useMemo(() => {
    if (!avatarUrl) return null;
    return {
      uri: avatarUrl.startsWith('http') ? avatarUrl : `${API_URL.replace(/\/api$/, '')}${avatarUrl}`,
    };
  }, [avatarUrl]);

  const initials = useMemo(() => {
    return fullName
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U';
  }, [fullName]);

  const parseFullName = (value: string) => {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      return { firstName: '', lastName: '' };
    }
    const [firstName, ...rest] = normalized.split(' ');
    return { firstName, lastName: rest.join(' ') };
  };

  const loadProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        toast.error('Please log in again to continue.');
        setIsLoading(false);
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
        const errorText = JSON.stringify(result.raw || {});
        if (errorText.includes('401') || errorText.includes('Unauthorized')) {
          toast.error('Your session has expired. Please log in again.');
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('auth_user');
        }
        return;
      }

      const profile = (result.data || result.raw || {}) as any;
      const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();

      setFullName(name);
      setEmail(profile.email || '');
      setPhoneNumber(profile.phoneNumber || '');
      setCity(profile.city || '');
      setAbout(profile.about || '');
      setAvatarUrl(profile.avatarUrl || '');
      setOriginalEmail(profile.email || '');
      setOriginalPhoneNumber(profile.phoneNumber || '');
    } catch (error) {
      console.log('Failed to load profile', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateFields = (): boolean => {
    const nextErrors: Record<string, string> = {};
    if (email.trim() && !email.includes('@')) {
      nextErrors.email = 'Email must be valid';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleUploadAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast.error('Please allow photo access to update your profile picture.');
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (picked.canceled || !picked.assets?.length) {
        return;
      }

      const asset = picked.assets[0];
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        toast.error('Please log in again.');
        return;
      }

      const ext = (asset.fileName?.split('.').pop() || 'jpg').toLowerCase();
      const mime = asset.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const form = new FormData();
      form.append(
        'avatar',
        {
          uri: asset.uri,
          name: asset.fileName || `avatar.${ext}`,
          type: mime,
        } as any,
      );

      setIsUploadingAvatar(true);
      const result = await apiRequest(
        `${API_URL}/auth/profile/avatar`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        },
        'Failed to upload profile picture.',
      );

      if (!result.ok) {
        throw new Error(result.message || 'Failed to upload profile picture.');
      }

      const payload = (result.data || result.raw || {}) as any;
      const nextAvatarUrl =
        payload?.data?.avatarUrl ||
        payload?.avatarUrl ||
        payload?.user?.avatarUrl ||
        '';

      if (nextAvatarUrl) {
        setAvatarUrl(nextAvatarUrl);
        const storedUser = await AsyncStorage.getItem('auth_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          parsed.avatarUrl = nextAvatarUrl;
          await AsyncStorage.setItem('auth_user', JSON.stringify(parsed));
        }
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to upload profile picture.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!validateFields()) return;

    setIsSaving(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        toast.error('Authentication token not found.');
        return;
      }

      const parsedName = parseFullName(fullName);
      const updateData: any = {
        firstName: parsedName.firstName,
        lastName: parsedName.lastName,
        city: city.trim(),
        about: about.trim(),
      };

      if (email.trim() !== originalEmail) {
        updateData.email = email.trim();
      }
      if (phoneNumber.trim() !== originalPhoneNumber) {
        updateData.phoneNumber = phoneNumber.trim();
      }

      const result = await apiRequest(
        `${API_URL}/auth/me`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updateData),
        },
        'Failed to save personal information.',
      );

      if (!result.ok) {
        let errorMessage = 'Failed to save personal information';
        const errorText = JSON.stringify(result.raw || {});

        if (errorText.includes('401') || errorText.includes('Unauthorized')) {
          errorMessage = 'Your session has expired. Please log in again.';
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('auth_user');
        } else if (errorText.includes('phoneNumber')) {
          errorMessage = 'This phone number is already in use. Please use a different number.';
        } else if (errorText.includes('email')) {
          errorMessage = 'This email is already in use. Please use a different email.';
        }

        toast.error(errorMessage);
        return;
      }

      try {
        const storedUser = await AsyncStorage.getItem('auth_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          parsed.firstName = parsedName.firstName;
          parsed.lastName = parsedName.lastName;
          parsed.email = email.trim();
          parsed.phoneNumber = phoneNumber.trim();
          parsed.city = city.trim();
          parsed.about = about.trim();
          await AsyncStorage.setItem('auth_user', JSON.stringify(parsed));
        }
      } catch (cacheError) {
        console.log('Failed to update cached user', cacheError);
      }

      toast.success('Profile updated successfully.');
      await loadProfile();
    } catch (error) {
      console.log('Error saving personal information:', error);
      toast.error('Failed to save personal information.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) + 10, minHeight: Math.max(insets.top, 10) + 64 }]}>
      <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.9}>
        <Ionicons name="chevron-back" size={22} color="#4B5563" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Edit Profile</Text>
      <TouchableOpacity style={styles.headerSaveButton} onPress={handleSave} disabled={isSaving} activeOpacity={0.9}>
        {isSaving ? <ActivityIndicator size="small" color={tokens.colors.brandAccent} /> : <Text style={styles.headerSaveText}>Save</Text>}
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 24 : 0}
      >
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={tokens.colors.brand} size="large" />
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 24 : 0}
    >
      {renderHeader()}

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 32 + Math.max(insets.bottom, 16) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarSection}>
          <View style={styles.avatarFrame}>
            {avatarSource ? (
              <Image source={avatarSource} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.changeAvatarButton}
              onPress={handleUploadAvatar}
              activeOpacity={0.9}
              disabled={isUploadingAvatar}
            >
              {isUploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.changeAvatarText}>Change</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Alex Morgan"
            value={fullName}
            onChangeText={setFullName}
            editable={!isSaving}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            placeholder="name@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isSaving}
            placeholderTextColor="#9CA3AF"
          />
          {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="+1 (555) 123-4567"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            editable={!isSaving}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            placeholder="City, Country"
            value={city}
            onChangeText={setCity}
            editable={!isSaving}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            placeholder="Tell us a short introduction about you."
            value={about}
            onChangeText={setAbout}
            editable={!isSaving}
            placeholderTextColor="#9CA3AF"
            multiline
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.9}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F5F9',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5EAF1',
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    backgroundColor: '#EEF2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSaveButton: {
    minWidth: 52,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 8,
    height: 40,
  },
  headerSaveText: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.brandAccent,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 48,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 22,
  },
  avatarFrame: {
    width: 144,
    height: 144,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#D6DCE6',
    backgroundColor: '#E8EDF4',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...tokens.shadow.card,
  },
  avatar: {
    width: 126,
    height: 126,
    borderRadius: 22,
    backgroundColor: '#CBD5E1',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0F172A',
  },
  changeAvatarButton: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    minWidth: 98,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: tokens.colors.brandAccent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...tokens.shadow.card,
  },
  changeAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 8,
  },
  input: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: '#D8DFE9',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F4F6FA',
    ...tokens.shadow.card,
  },
  bioInput: {
    minHeight: 136,
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  saveButton: {
    marginTop: 18,
    backgroundColor: tokens.colors.brandAccent,
    borderRadius: 16,
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
