import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import AppHeader from '../../components/AppHeader';
import { tokens } from '../../theme/tokens';

type SettingsProps = {
  onBack?: () => void;
  onLogout?: () => void;
  onNavigatePersonalDetails?: () => void;
  onNavigateChangePassword?: () => void;
  onNavigateNotifications?: () => void;
  onNavigateEWallet?: () => void;
  onNavigateLocation?: () => void;
  onNavigateMfa?: () => void;
  onNavigateAbout?: () => void;
  onNavigateDeleteAccount?: () => void;
  onNavigateSupport?: () => void;
};

export default function Settings({
  onBack,
  onLogout,
  onNavigatePersonalDetails,
  onNavigateChangePassword,
  onNavigateNotifications,
  onNavigateEWallet,
  onNavigateLocation,
  onNavigateMfa,
  onNavigateAbout,
  onNavigateDeleteAccount,
  onNavigateSupport,
}: SettingsProps) {
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
    { title: 'E-Wallet & Payments', onPress: onNavigateEWallet },
    { title: 'Location Services', onPress: onNavigateLocation },
    { title: 'Two-Factor Authentication', onPress: onNavigateMfa },
    { title: 'Contact Support', onPress: onNavigateSupport },
    { title: 'About', onPress: onNavigateAbout },
    { title: 'Delete Account', onPress: onNavigateDeleteAccount },
  ];

  return (
    <View style={styles.container}>
      <AppHeader
        title="Account Settings"
        subtitle="Manage profile, security, and support"
        onBack={onBack}
      />

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
  container: { flex: 1, backgroundColor: tokens.colors.background },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 100 },
  menuCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.lg,
    overflow: 'hidden',
    ...tokens.shadow.card,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  menuTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  arrowIcon: { fontSize: 20, color: tokens.colors.textSubtle },
  divider: {
    height: 1,
    backgroundColor: tokens.colors.border,
  },
  logoutItem: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: tokens.colors.danger },
});
