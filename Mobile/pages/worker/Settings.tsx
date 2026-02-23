import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';

type SettingsProps = {
  onBack?: () => void;
  onLogout?: () => void;
  onNavigatePersonalDetails?: () => void;
  onNavigateChangePassword?: () => void;
  onNavigateNotifications?: () => void;
  onNavigateAbout?: () => void;
  onNavigateDeleteAccount?: () => void;
};

export default function Settings({ onBack, onLogout, onNavigatePersonalDetails, onNavigateChangePassword, onNavigateNotifications, onNavigateAbout, onNavigateDeleteAccount }: SettingsProps) {
  const handleLogout = () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: onLogout },
      ]
    );
  };

  const settingsMenus = [
    { title: 'Personal Information', onPress: onNavigatePersonalDetails },
    { title: 'Change Password', onPress: onNavigateChangePassword },
    { title: 'Notifications', onPress: onNavigateNotifications },
    { title: 'Contact Support', onPress: () => {} },
    { title: 'About', onPress: onNavigateAbout },
    { title: 'Delete Account', onPress: onNavigateDeleteAccount },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Settings Menu Card */}
        <View style={styles.menuCard}>
          {settingsMenus.map((menu, index) => (
            <View key={index}>
              <TouchableOpacity style={styles.menuItem} onPress={menu.onPress}>
                <Text style={styles.menuTitle}>{menu.title}</Text>
                <Text style={styles.arrowIcon}>›</Text>
              </TouchableOpacity>
              {index < settingsMenus.length - 1 && <View style={styles.divider} />}
            </View>
          ))}

          {/* Divider before logout */}
          <View style={styles.divider} />

          {/* Log out Button */}
          <TouchableOpacity style={styles.logoutItem} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
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
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  menuTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  arrowIcon: { fontSize: 20, color: '#9ca3af' },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  logoutItem: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#ef4444' },
});
