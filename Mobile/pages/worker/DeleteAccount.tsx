import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

type DeleteAccountProps = {
  onBack?: () => void;
  onDeleteAccount?: () => void;
};

export default function DeleteAccount({ onBack, onDeleteAccount }: DeleteAccountProps) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete Account</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Warning Card */}
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>When you delete your account, we'll delete your profile and your job application history (including CVs and cover letters) stored on our platform.</Text>

          <Text style={styles.warningText}>
            If you've applied for jobs, some employers might still hold your information (including contact details) on their system. Contact these employers directly to delete your information from their systems.
          </Text>

          <Text style={styles.warningText}>
            For our information, refer to our <Text style={styles.linkText}>Privacy Policy.</Text>
          </Text>

          <Text style={styles.emailTitle}>Your account registered with the following email will be deleted:</Text>

          <Text style={styles.emailText}>enriquez.jonas@gmail.com</Text>
        </View>

        {/* Delete Button */}
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={onDeleteAccount}
        >
          <Text style={styles.deleteButtonText}>Delete account</Text>
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
  warningCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 16,
  },
  warningTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937', lineHeight: 22 },
  warningText: { fontSize: 14, color: '#6b7280', lineHeight: 20 },
  linkText: { color: '#3b82f6', fontWeight: '600' },
  emailTitle: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginTop: 8 },
  emailText: { fontSize: 14, color: '#1f2937', fontWeight: '700' },
  deleteButton: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
