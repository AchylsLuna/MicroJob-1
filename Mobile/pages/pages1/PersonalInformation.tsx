import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '../../lib/storage';
import { Ionicons } from '@expo/vector-icons';
import ScrollView from '../../components/ui/SmoothScrollView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../../config';
import { apiRequest, asObject } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import { useToast } from '../../contexts/ToastContext';
import {
  PROFILE_LIMITS,
  isValidOptionalProfileUrl,
  isValidProfileName,
  isValidProfilePhone,
  normalizeProfileName,
  normalizeProfilePhone,
  validateMobileAvatar,
} from '../../lib/profileValidation';
import {
  getPhilippineBarangays,
  getPhilippineLocationOptions,
  type BarangayOption,
  type CityOption,
  type ProvinceOption,
} from '../../lib/philippineLocations';

type PersonalInformationProps = {
  onBack?: () => void;
  currentRole?: 'worker' | 'employer' | 'both';
  onSaved?: (profile: Record<string, any>) => void;
};

export default function PersonalInformation({ onBack, onSaved }: PersonalInformationProps) {
  const loadProfileRef = useRef<() => Promise<void>>(async () => undefined);
  const originalProfileRef = useRef<Record<string, string> | null>(null);
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [barangay, setBarangay] = useState('');
  const [about, setAbout] = useState('');
  const [jobPosition, setJobPosition] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [formError, setFormError] = useState('');
  const [provinceOptions, setProvinceOptions] = useState<ProvinceOption[]>([]);
  const [cityOptions, setCityOptions] = useState<CityOption[]>([]);
  const [barangayOptions, setBarangayOptions] = useState<BarangayOption[]>([]);
  const [showProvinceOptions, setShowProvinceOptions] = useState(false);
  const [showCityOptions, setShowCityOptions] = useState(false);
  const [showBarangayOptions, setShowBarangayOptions] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [isLoadingBarangays, setIsLoadingBarangays] = useState(false);
  const [locationDataError, setLocationDataError] = useState('');
  const [locationReloadKey, setLocationReloadKey] = useState(0);
  const toast = useToast();

  useEffect(() => {
    setFormError('');
  }, [about, barangay, city, fullName, jobPosition, linkedin, phoneNumber, province, website]);

  const selectedProvince = useMemo(
    () => provinceOptions.find((item) => item.name.toLowerCase() === province.trim().toLowerCase()),
    [provinceOptions, province],
  );

  const filteredCities = useMemo(() => {
    if (selectedProvince?.code) {
      return cityOptions.filter((item) => item.provinceCode === selectedProvince.code);
    }
    return [];
  }, [cityOptions, selectedProvince?.code]);

  const selectedCity = useMemo(
    () => filteredCities.find((item) => item.name.toLowerCase() === city.trim().toLowerCase()),
    [filteredCities, city],
  );

  const selectedBarangay = useMemo(
    () => barangayOptions.find((item) => item.name.toLowerCase() === barangay.trim().toLowerCase()),
    [barangayOptions, barangay],
  );

  useEffect(() => {
    void loadProfileRef.current();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadLocationData = async () => {
      setIsLoadingLocations(true);
      setLocationDataError('');
      try {
        const { provinces, cities } = await getPhilippineLocationOptions();
        if (!isMounted) return;
        setProvinceOptions(provinces);
        setCityOptions(cities);
      } catch {
        if (isMounted) {
          setLocationDataError('Philippine location options are unavailable.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingLocations(false);
        }
      }
    };

    loadLocationData();

    return () => {
      isMounted = false;
    };
  }, [locationReloadKey]);

  useEffect(() => {
    let isMounted = true;

    const loadBarangays = async () => {
      if (!selectedCity?.code) {
        setBarangayOptions([]);
        return;
      }

      setIsLoadingBarangays(true);
      try {
        const items = await getPhilippineBarangays(selectedCity.code);
        if (!isMounted) return;
        setBarangayOptions(items);
      } catch {
        if (isMounted) {
          setBarangayOptions([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingBarangays(false);
        }
      }
    };

    loadBarangays();

    return () => {
      isMounted = false;
    };
  }, [selectedCity?.code]);

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

  const loadProfile = useCallback(async () => {
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
        let message = result.message || 'Failed to load profile.';
        if (errorText.includes('401') || errorText.includes('Unauthorized')) {
          message = 'Your session has expired. Please log in again.';
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('auth_user');
        }
        setFormError(message);
        toast.error(message);
        return;
      }

      const profile =
        asObject<any>(result.data, ['user', 'profile']) ||
        asObject<any>(result.raw, ['user', 'profile']) ||
        {};
      const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();

      setFullName(name);
      setEmail(profile.email || '');
      setPhoneNumber(profile.phoneNumber || '');
      setCity(profile.city || '');
      setProvince(profile.province || '');
      setBarangay(profile.barangay || '');
      setAbout(profile.about || '');
      setJobPosition(profile.jobPosition || '');
      setLinkedin(profile.linkedin || '');
      setWebsite(profile.website || '');
      setAvatarUrl(profile.avatarUrl || '');
      originalProfileRef.current = {
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        phoneNumber: normalizeProfilePhone(profile.phoneNumber || ''),
        city: profile.city || '',
        province: profile.province || '',
        barangay: profile.barangay || '',
        about: profile.about || '',
        jobPosition: profile.jobPosition || '',
        linkedin: profile.linkedin || '',
        website: profile.website || '',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load profile.';
      setFormError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  loadProfileRef.current = loadProfile;

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
      const { extension, mimeType, error: avatarError } = validateMobileAvatar(asset);
      if (avatarError) {
        toast.error(avatarError);
        return;
      }
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        toast.error('Please log in again.');
        return;
      }

      const ext = extension;
      const mime = mimeType;
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
    if (isSaving) return;
    setFormError('');
    const parsedName = parseFullName(fullName);
    parsedName.firstName = normalizeProfileName(parsedName.firstName);
    parsedName.lastName = normalizeProfileName(parsedName.lastName);
    if (!isValidProfileName(parsedName.firstName) || !isValidProfileName(parsedName.lastName)) {
      const message = "Enter both first and last name using letters, spaces, apostrophes, periods, or hyphens.";
      setFormError(message);
      toast.error(message);
      return;
    }
    const normalizedPhone = normalizeProfilePhone(phoneNumber);
    if (phoneNumber.trim() && !isValidProfilePhone(normalizedPhone)) {
      const message = 'Phone number must be a Philippine mobile number in 09XXXXXXXXX format.';
      setFormError(message);
      toast.error(message);
      return;
    }
    const lengthChecks: Array<[string, string, number]> = [
      ['Province', province, PROFILE_LIMITS.province],
      ['City', city, PROFILE_LIMITS.city],
      ['Barangay', barangay, PROFILE_LIMITS.barangay],
      ['Professional headline', jobPosition, PROFILE_LIMITS.jobPosition],
      ['Bio', about, PROFILE_LIMITS.about],
    ];
    const invalidLength = lengthChecks.find(([, value, max]) => value.trim().length > max);
    if (invalidLength) {
      const message = `${invalidLength[0]} must be ${invalidLength[2]} characters or fewer.`;
      setFormError(message);
      toast.error(message);
      return;
    }
    if (!isValidOptionalProfileUrl(linkedin) || !isValidOptionalProfileUrl(website)) {
      const message = 'LinkedIn and website links must be valid HTTPS URLs.';
      setFormError(message);
      toast.error(message);
      return;
    }
    const originalProfile = originalProfileRef.current;
    if (!originalProfile) {
      const message = 'Your profile is still loading. Please wait and try again.';
      setFormError(message);
      toast.error(message);
      return;
    }
    const locationChanged =
      province.trim() !== originalProfile.province.trim() ||
      city.trim() !== originalProfile.city.trim() ||
      barangay.trim() !== originalProfile.barangay.trim();
    if (locationChanged && (isLoadingLocations || isLoadingBarangays)) {
      const message = 'Please wait for the Philippine location options to finish loading.';
      setFormError(message);
      toast.error(message);
      return;
    }
    if (locationChanged && locationDataError) {
      const message = 'Location options are unavailable. Retry before saving location changes.';
      setFormError(message);
      toast.error(message);
      return;
    }
    const hasAnyLocation = Boolean(province.trim() || city.trim() || barangay.trim());
    if (locationChanged && hasAnyLocation && (!selectedProvince || !selectedCity || !selectedBarangay)) {
      const message = 'Select a valid Province, City/Municipality, and Barangay from the suggestions.';
      setFormError(message);
      toast.error(message);
      return;
    }

    setIsSaving(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        toast.error('Authentication token not found.');
        return;
      }

      const nextValues: Record<string, string> = {
        firstName: parsedName.firstName,
        lastName: parsedName.lastName,
        city: city.trim(),
        province: province.trim(),
        barangay: barangay.trim(),
        about: about.trim(),
        jobPosition: jobPosition.trim(),
        linkedin: linkedin.trim(),
        website: website.trim(),
      };
      const updateData = Object.fromEntries(
        Object.entries(nextValues).filter(([key, value]) => value !== String(originalProfile[key] || '').trim()),
      );

      if (Object.keys(updateData).length === 0) {
        toast.success('No profile changes to save.');
        return;
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
        let errorMessage = result.message || 'Failed to save personal information';
        const errorText = JSON.stringify(result.raw || {});

        if (errorText.includes('401') || errorText.includes('Unauthorized')) {
          errorMessage = 'Your session has expired. Please log in again.';
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('auth_user');
        } else if (errorText.includes('phoneNumber')) {
          errorMessage = 'This phone number is already in use. Please use a different number.';
        }

        setFormError(errorMessage);
        toast.error(errorMessage);
        return;
      }

      try {
        const responseProfile =
          asObject<any>(result.data, ['user', 'profile']) ||
          asObject<any>(result.raw, ['user', 'profile']) ||
          nextValues;
        const storedUser = await AsyncStorage.getItem('auth_user');
        const cachedUser = storedUser ? JSON.parse(storedUser) : {};
        const savedUser = { ...cachedUser, ...responseProfile };
        await AsyncStorage.setItem('auth_user', JSON.stringify(savedUser));

        setFullName([savedUser.firstName, savedUser.lastName].filter(Boolean).join(' ').trim());
        setPhoneNumber(savedUser.phoneNumber || '');
        setCity(savedUser.city || '');
        setProvince(savedUser.province || '');
        setBarangay(savedUser.barangay || '');
        setAbout(savedUser.about || '');
        setJobPosition(savedUser.jobPosition || '');
        setLinkedin(savedUser.linkedin || '');
        setWebsite(savedUser.website || '');
        originalProfileRef.current = {
          firstName: savedUser.firstName || '',
          lastName: savedUser.lastName || '',
          phoneNumber: normalizeProfilePhone(savedUser.phoneNumber || ''),
          city: savedUser.city || '',
          province: savedUser.province || '',
          barangay: savedUser.barangay || '',
          about: savedUser.about || '',
          jobPosition: savedUser.jobPosition || '',
          linkedin: savedUser.linkedin || '',
          website: savedUser.website || '',
        };
        onSaved?.(savedUser);
      } catch (cacheError) {
        console.log('Failed to update cached user', cacheError);
      }

      toast.success('Profile updated successfully.');
    } catch (error) {
      console.log('Error saving personal information:', error);
      const message = error instanceof Error ? error.message : 'Failed to save personal information.';
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) + 10, minHeight: Math.max(insets.top, 10) + 64 }]}>
      <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="Go back">
        <Ionicons name="chevron-back" size={22} color="#4B5563" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} accessibilityRole="header">Edit Profile</Text>
      <TouchableOpacity style={styles.headerSaveButton} onPress={handleSave} disabled={isSaving} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="Save profile" accessibilityState={{ disabled: isSaving, busy: isSaving }}>
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
          <ActivityIndicator color={tokens.colors.brand} size="large" accessibilityLabel="Loading profile" />
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
              <Image source={avatarSource} style={styles.avatar} accessibilityLabel="Current profile photo" />
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
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              accessibilityHint="Opens your photo library"
              accessibilityState={{ disabled: isUploadingAvatar, busy: isUploadingAvatar }}
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
            maxLength={61}
            onChangeText={setFullName}
            editable={!isSaving}
            placeholderTextColor="#9CA3AF"
            accessibilityLabel="Full name"
            accessibilityHint="Enter your first and last name"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={[styles.input, styles.inputReadOnly]}
            placeholder="name@example.com"
            value={email}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={false}
            placeholderTextColor="#9CA3AF"
            accessibilityLabel="Email address"
            accessibilityState={{ disabled: true }}
          />
          <Text style={styles.helperText}>Email changes require a verified change flow and are currently locked.</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="+1 (555) 123-4567"
            value={phoneNumber}
            maxLength={20}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            editable={!isSaving}
            placeholderTextColor="#9CA3AF"
            accessibilityLabel="Phone number"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Province</Text>
          {locationDataError ? (
            <View style={styles.locationErrorRow}>
              <Text style={styles.locationErrorText}>{locationDataError}</Text>
              <TouchableOpacity
                onPress={() => setLocationReloadKey((value) => value + 1)}
                style={styles.retryButton}
                accessibilityRole="button"
                accessibilityLabel="Retry loading Philippine locations"
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <TextInput
            style={styles.input}
            placeholder={isLoadingLocations ? 'Loading provinces...' : 'Type or select province'}
            value={province}
            maxLength={PROFILE_LIMITS.province}
            onChangeText={(value) => {
              setProvince(value);
              setCity('');
              setBarangay('');
              setShowProvinceOptions(true);
            }}
            editable={!isSaving && !locationDataError}
            onFocus={() => setShowProvinceOptions(true)}
            placeholderTextColor="#9CA3AF"
            accessibilityLabel="Province"
            accessibilityHint="Type to filter province suggestions"
          />
          {showProvinceOptions && !locationDataError ? (
            <View style={styles.optionsDropdown}>
              <ScrollView style={styles.optionsScroll} nestedScrollEnabled>
                {provinceOptions
                  .filter((item) => item.name.toLowerCase().includes(province.trim().toLowerCase()))
                  .slice(0, 80)
                  .map((item) => (
                    <TouchableOpacity
                      key={item.code}
                      style={styles.optionItem}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${item.name} province`}
                      onPress={() => {
                        setProvince(item.name);
                        setCity('');
                        setBarangay('');
                        setShowProvinceOptions(false);
                      }}
                    >
                      <Text style={styles.optionText}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>City / Municipality</Text>
          <TextInput
            style={styles.input}
            placeholder={!selectedProvince ? 'Select province first' : 'Type or select city'}
            value={city}
            maxLength={PROFILE_LIMITS.city}
            onChangeText={(value) => {
              setCity(value);
              setBarangay('');
              setShowCityOptions(true);
            }}
            editable={!isSaving && Boolean(selectedProvince)}
            onFocus={() => setShowCityOptions(true)}
            placeholderTextColor="#9CA3AF"
            accessibilityLabel="City or municipality"
            accessibilityHint="Type to filter city suggestions"
          />
          {showCityOptions && Boolean(selectedProvince) ? (
            <View style={styles.optionsDropdown}>
              <ScrollView style={styles.optionsScroll} nestedScrollEnabled>
                {filteredCities
                  .filter((item) => item.name.toLowerCase().includes(city.trim().toLowerCase()))
                  .slice(0, 120)
                  .map((item) => (
                    <TouchableOpacity
                      key={item.code}
                      style={styles.optionItem}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${item.name}`}
                      onPress={() => {
                        setCity(item.name);
                        setBarangay('');
                        setShowCityOptions(false);
                      }}
                    >
                      <Text style={styles.optionText}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Barangay</Text>
          <TextInput
            style={styles.input}
            placeholder={!selectedCity ? 'Select city first' : isLoadingBarangays ? 'Loading barangays...' : 'Type or select barangay'}
            value={barangay}
            maxLength={PROFILE_LIMITS.barangay}
            onChangeText={(value) => {
              setBarangay(value);
              setShowBarangayOptions(true);
            }}
            editable={!isSaving && Boolean(selectedCity) && !isLoadingBarangays}
            onFocus={() => setShowBarangayOptions(true)}
            placeholderTextColor="#9CA3AF"
            accessibilityLabel="Barangay"
            accessibilityHint="Type to filter barangay suggestions"
          />
          {showBarangayOptions && Boolean(selectedCity) ? (
            <View style={styles.optionsDropdown}>
              <ScrollView style={styles.optionsScroll} nestedScrollEnabled>
                {barangayOptions
                  .filter((item) => item.name.toLowerCase().includes(barangay.trim().toLowerCase()))
                  .slice(0, 150)
                  .map((item) => (
                    <TouchableOpacity
                      key={item.code}
                      style={styles.optionItem}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${item.name} barangay`}
                      onPress={() => {
                        setBarangay(item.name);
                        setShowBarangayOptions(false);
                      }}
                    >
                      <Text style={styles.optionText}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Professional Headline</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. House cleaner, Tutor, Delivery specialist"
            value={jobPosition}
            onChangeText={setJobPosition}
            editable={!isSaving}
            maxLength={PROFILE_LIMITS.jobPosition}
            placeholderTextColor="#9CA3AF"
            accessibilityLabel="Professional headline"
          />
        </View>

        {formError ? (
          <Text style={styles.formError} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            {formError}
          </Text>
        ) : null}

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
            maxLength={PROFILE_LIMITS.about}
            textAlignVertical="top"
            accessibilityLabel="Bio"
          />
          <Text style={styles.characterCount}>{about.length}/{PROFILE_LIMITS.about}</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>LinkedIn URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://linkedin.com/in/your-name"
            value={linkedin}
            onChangeText={setLinkedin}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSaving}
            maxLength={PROFILE_LIMITS.url}
            placeholderTextColor="#9CA3AF"
            accessibilityLabel="LinkedIn URL"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Portfolio or Website</Text>
          <TextInput
            style={styles.input}
            placeholder="https://your-portfolio.example"
            value={website}
            onChangeText={setWebsite}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSaving}
            maxLength={PROFILE_LIMITS.url}
            placeholderTextColor="#9CA3AF"
            accessibilityLabel="Portfolio or website"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Save profile changes"
          accessibilityState={{ disabled: isSaving, busy: isSaving }}
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
    backgroundColor: tokens.colors.canvasBlue,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5EAF1',
    backgroundColor: tokens.colors.contentSurface,
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
    color: tokens.colors.text,
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
  optionsDropdown: {
    marginTop: 6,
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    maxHeight: 180,
  },
  optionsScroll: {
    maxHeight: 180,
  },
  optionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionText: {
    fontSize: 13,
    color: tokens.colors.text,
  },
  locationErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  locationErrorText: {
    flex: 1,
    color: '#9A3412',
    fontSize: 12,
  },
  retryButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  retryButtonText: {
    color: '#9A3412',
    fontWeight: '700',
    fontSize: 12,
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
    borderColor: tokens.colors.surface,
    ...tokens.shadow.card,
  },
  changeAvatarText: {
    color: tokens.colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  fieldGroup: {
    marginBottom: 18,
  },
  formError: {
    color: '#991B1B',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    lineHeight: 18,
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
    color: tokens.colors.text,
    backgroundColor: tokens.colors.contentSurface,
    ...tokens.shadow.card,
  },
  inputReadOnly: {
    color: '#64748B',
    backgroundColor: '#E9EEF5',
  },
  helperText: {
    marginTop: 6,
    color: '#64748B',
    fontSize: 12,
  },
  characterCount: {
    marginTop: 6,
    alignSelf: 'flex-end',
    color: '#64748B',
    fontSize: 12,
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
    color: tokens.colors.surface,
    fontSize: 18,
    fontWeight: '700',
  },
});
