import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokens } from '../../theme/tokens';
import { API_URL } from '../../config';
import { apiRequest } from '../../lib/api';

type PersonalInformationProps = {
  onBack?: () => void;
  currentRole?: 'worker' | 'employer' | 'both';
};

export default function PersonalInformation({ onBack, currentRole = 'worker' }: PersonalInformationProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [logoName, setLogoName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Track original values to detect changes
  const [originalEmail, setOriginalEmail] = useState('');
  const [originalPhoneNumber, setOriginalPhoneNumber] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Session Expired', 'Please log in again to continue.');
        setIsLoading(false);
        return;
      }

      const result = await apiRequest(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }, 'Failed to load profile.') as any;

      if (result.ok) {
        let profile: any = null;
        if (result.raw?.data?.user) {
          profile = result.raw.data.user;
        } else if (result.raw?.user) {
          profile = result.raw.user;
        } else if (result.data?.user) {
          profile = result.data.user;
        } else if (result.raw) {
          profile = result.raw;
        }

        if (profile) {
          setFirstName(profile.firstName || '');
          setLastName(profile.lastName || '');
          setEmail(profile.email || '');
          setPhoneNumber(profile.phoneNumber || '');
          setCity(profile.city || '');
          setCountry(profile.province || profile.country || '');
          setLinkedin(profile.linkedin || '');
          setCompanyName(profile.companyName || '');
          setLogoName(profile.logoName || '');
          
          // Track original values to detect changes
          setOriginalEmail(profile.email || '');
          setOriginalPhoneNumber(profile.phoneNumber || '');
        }
      } else {
        // Check for 401 (unauthorized) error
        const errorText = JSON.stringify(result.raw || {});
        if (errorText.includes('401') || errorText.includes('Unauthorized')) {
          Alert.alert('Session Expired', 'Your session has expired. Please log in again.');
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('auth_user');
        }
      }
    } catch (error) {
      console.log('Failed to load profile', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateFields = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Remove email validation when empty since all fields are optional
    if (email.trim() && !email.includes('@')) {
      newErrors.email = 'Email must be valid';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateFields()) return;

    setIsSaving(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Error', 'Authentication token not found');
        return;
      }

      // Build update payload - only include email/phone if changed
      const updateData: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        city: city.trim(),
        province: country.trim(), // Server uses 'province' field
        linkedin: linkedin.trim(),
      };
      
      // Only include email if it changed
      if (email.trim() !== originalEmail) {
        updateData.email = email.trim();
      }
      
      // Only include phone if it changed
      if (phoneNumber.trim() !== originalPhoneNumber) {
        updateData.phoneNumber = phoneNumber.trim();
      }
      
      // Add employer fields if applicable
      if (currentRole === 'employer' || currentRole === 'both') {
        updateData.companyName = companyName.trim();
        updateData.logoName = logoName.trim();
      }

      const result = await apiRequest(`${API_URL}/auth/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      }, 'Failed to save personal information.');

      if (result.ok) {
        // Update AsyncStorage so Profile screen shows latest name
        try {
          const storedUser = await AsyncStorage.getItem('auth_user');
          if (storedUser) {
            const parsed = JSON.parse(storedUser);
            parsed.firstName = firstName.trim();
            parsed.lastName = lastName.trim();
            await AsyncStorage.setItem('auth_user', JSON.stringify(parsed));
          }
        } catch (e) {
          console.log('Failed to update cached user', e);
        }
        
        Alert.alert('Success', 'Personal information saved successfully');
        await loadProfile(); // Reload to keep fields populated
      } else {
        // Handle specific error messages
        let errorMessage = 'Failed to save personal information';
        
        const errorText = JSON.stringify(result.raw || {});
        
        // Check for 401 (unauthorized) error
        if (errorText.includes('401') || errorText.includes('Unauthorized')) {
          errorMessage = 'Your session has expired. Please log in again.';
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('auth_user');
        }
        // Check for duplicate phone number error
        else if (errorText.includes('phoneNumber')) {
          errorMessage = 'This phone number is already in use. Please use a different number.';
        }
        // Check for duplicate email error
        else if (errorText.includes('email')) {
          errorMessage = 'This email is already in use. Please use a different email.';
        }
        
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.log('Error saving personal information:', error);
      Alert.alert('Error', 'Failed to save personal information');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="chevron-back" size={24} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Personal Information</Text>
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator color={tokens.colors.brand} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="chevron-back" size={24} color="#6B7280" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personal Information</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* First Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={[styles.input, errors.firstName && styles.inputError]}
            placeholder="Enter first name"
            value={firstName}
            onChangeText={setFirstName}
            editable={!isSaving}
            placeholderTextColor="#9CA3AF"
          />
          {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
        </View>

        {/* Last Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={[styles.input, errors.lastName && styles.inputError]}
            placeholder="Enter last name"
            value={lastName}
            onChangeText={setLastName}
            editable={!isSaving}
            placeholderTextColor="#9CA3AF"
          />
          {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
        </View>

        {/* Email */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            placeholder="Enter email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            editable={!isSaving}
            placeholderTextColor="#9CA3AF"
          />
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
        </View>

        {/* Contact Number */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Contact Number</Text>
          <TextInput
            style={[styles.input, errors.phoneNumber && styles.inputError]}
            placeholder="Enter phone number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            editable={!isSaving}
            placeholderTextColor="#9CA3AF"
          />
          {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
        </View>

        {/* City */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>City</Text>
          <TextInput
            style={[styles.input, errors.city && styles.inputError]}
            placeholder="Enter city"
            value={city}
            onChangeText={setCity}
            editable={!isSaving}
            placeholderTextColor="#9CA3AF"
          />
          {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
        </View>

        {/* Country */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Province</Text>
          <TextInput
            style={[styles.input, errors.country && styles.inputError]}
            placeholder="Enter country"
            value={country}
            onChangeText={setCountry}
            editable={!isSaving}
            placeholderTextColor="#9CA3AF"
          />
          {errors.country && <Text style={styles.errorText}>{errors.country}</Text>}
        </View>

        {/* LinkedIn */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>LinkedIn Profile</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter LinkedIn URL or username"
            value={linkedin}
            onChangeText={setLinkedin}
            editable={!isSaving}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Employer Fields */}
        {(currentRole === 'employer' || currentRole === 'both') && (
          <>
            {/* Company Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Company Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your company name"
                value={companyName}
                onChangeText={setCompanyName}
                editable={!isSaving}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Company Logo */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Company Logo</Text>
              <TextInput
                style={styles.input}
                placeholder="Company logo filename"
                value={logoName}
                onChangeText={setLogoName}
                editable={!isSaving}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5EAF0',
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
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  fieldGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5EAF0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
  },
  saveButton: {
    backgroundColor: tokens.colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
