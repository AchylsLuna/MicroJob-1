import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';

type ChangePasswordProps = {
  onBack?: () => void;
};

export default function ChangePassword({ onBack }: ChangePasswordProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Old Password */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Old Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Old Password"
            placeholderTextColor="#9ca3af"
            value={oldPassword}
            onChangeText={setOldPassword}
            secureTextEntry
          />
        </View>

        {/* New Password */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={styles.input}
            placeholder="New Password"
            placeholderTextColor="#9ca3af"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
        </View>

        {/* Re-enter Password */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Re-enter Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Re-enter Password"
            placeholderTextColor="#9ca3af"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </View>

        {/* Update Button */}
        <TouchableOpacity style={styles.updateButton}>
          <Text style={styles.updateButtonText}>Update</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#1e3a5f',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 32, color: '#fff', fontWeight: '300' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff', flex: 1, textAlign: 'center' },
  placeholder: { width: 40 },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 100 },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  updateButton: {
    backgroundColor: '#1e3a5f',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  updateButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
