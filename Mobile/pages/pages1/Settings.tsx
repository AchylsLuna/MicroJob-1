import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    onLogout?.();
  };

  const settingsMenus = [
    { title: 'Personal Information', onPress: onNavigatePersonalDetails, icon: 'person-outline' as const },
    { title: 'Change Password', onPress: onNavigateChangePassword, icon: 'lock-closed-outline' as const },
    { title: 'Notifications', onPress: onNavigateNotifications, icon: 'notifications-outline' as const },
    { title: 'E-Wallet & Payments', onPress: onNavigateEWallet, icon: 'wallet-outline' as const },
    { title: 'Location Services', onPress: onNavigateLocation, icon: 'location-outline' as const },
    { title: 'Two-Factor Authentication', onPress: onNavigateMfa, icon: 'shield-checkmark-outline' as const },
    { title: 'Contact Support', onPress: onNavigateSupport, icon: 'help-circle-outline' as const },
    { title: 'About', onPress: onNavigateAbout, icon: 'information-circle-outline' as const },
    { title: 'Delete Account', onPress: onNavigateDeleteAccount, icon: 'trash-outline' as const, danger: true },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="chevron-back" size={20} color="#6B7280" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.menuCard}>
          {settingsMenus.map((menu, index) => (
            <View key={menu.title}>
              <TouchableOpacity style={styles.menuItem} onPress={menu.onPress}>
                <View style={styles.menuLeft}>
                  <View style={styles.iconWrap}>
                    <Ionicons
                      name={menu.icon}
                      size={19}
                      color={menu.danger ? tokens.colors.danger : '#4B5563'}
                    />
                  </View>
                  <Text style={[styles.menuTitle, menu.danger && styles.menuTitleDanger]}>{menu.title}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C5CCD7" />
              </TouchableOpacity>
              {index < settingsMenus.length - 1 && <View style={styles.divider} />}
            </View>
          ))}

          <View style={styles.divider} />
          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <View style={styles.menuLeft}>
              <View style={styles.iconWrap}>
                <Ionicons name="log-out-outline" size={19} color={tokens.colors.danger} />
              </View>
              <Text style={[styles.menuTitle, styles.menuTitleDanger]}>Log out</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C5CCD7" />
          </TouchableOpacity>
        </View>
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
    paddingTop: 54,
    paddingHorizontal: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 100 },
  menuCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5EAF0',
    ...tokens.shadow.card,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 72,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexShrink: 1,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3F5F9',
    borderWidth: 1,
    borderColor: '#ECEFF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: { fontSize: 18, fontWeight: '700', color: '#111827', flexShrink: 1 },
  menuTitleDanger: { color: tokens.colors.danger },
  divider: {
    height: 1,
    backgroundColor: '#EEF2F7',
  },
});
