import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';
import EmployerNavigation from '../../components/employerNavigation';

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
  onLogout?: () => void;
  currentRole?: 'worker' | 'employer';
  onSwitchRole?: (role: 'worker' | 'employer') => void;
};

export default function EmployerProfile({
  employer,
  activeTab,
  onTabPress,
  onLogout,
  currentRole = 'employer',
  onSwitchRole,
}: EmployerProfileProps) {
  const [firstName, setFirstName] = useState(employer?.firstName || '');
  const [lastName, setLastName] = useState(employer?.lastName || '');
  const [email, setEmail] = useState(employer?.email || '');
  const [phone, setPhone] = useState(employer?.phone || '');
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
        }
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) return;
        const response = await fetch(`${API_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return;
        const profile = data?.profile || data?.user;
        if (profile) {
          setFirstName(profile.firstName || '');
          setLastName(profile.lastName || '');
          setEmail(profile.email || '');
          setPhone(profile.phoneNumber || '');
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
      const response = await fetch(`${API_URL}/users/me`, {
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
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to update profile.');
      }
      Alert.alert('Success', 'Profile updated.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update profile.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleSwitch = (role: 'worker' | 'employer') => {
    if (role === currentRole) return;
    onSwitchRole?.(role);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{employerName}</Text>
          <Text style={styles.subtitle}>Employer</Text>
          <View style={styles.roleSwitchRow}>
            <TouchableOpacity
              style={[styles.roleChip, currentRole === 'worker' && styles.roleChipActive]}
              onPress={() => handleRoleSwitch('worker')}
            >
              <Text style={[styles.roleChipText, currentRole === 'worker' && styles.roleChipTextActive]}>
                Worker
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleChip, currentRole === 'employer' && styles.roleChipActive]}
              onPress={() => handleRoleSwitch('employer')}
            >
              <Text style={[styles.roleChipText, currentRole === 'employer' && styles.roleChipTextActive]}>
                Employer
              </Text>
            </TouchableOpacity>
          </View>
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

        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Profile</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={onLogout}
          disabled={!onLogout}
        >
          <Text style={styles.logoutButtonText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>

      <EmployerNavigation activeTab={activeTab} onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 90 },
  profileCard: {
    backgroundColor: '#f7f8fb',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
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
  },
  avatarText: { color: '#ffffff', fontWeight: '700', fontSize: 20 },
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
  roleSwitchRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  roleChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
  },
  roleChipActive: {
    backgroundColor: '#1e3a5f',
    borderColor: '#1e3a5f',
  },
  roleChipText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  roleChipTextActive: { color: '#ffffff' },
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
  logoutButton: {
    marginTop: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutButtonText: { color: '#b91c1c', fontSize: 14, fontWeight: '700' },
});
