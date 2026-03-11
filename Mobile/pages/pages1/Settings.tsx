import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../config';
import { tokens } from '../../theme/tokens';
import PersonalInformation from './PersonalInformation';

type SettingsProps = {
  onBack?: () => void;
  onLogout?: () => void;
  onNavigatePersonalDetails?: () => void;
  onNavigateChangePassword?: () => void;
  onNavigateNotifications?: () => void;
  onNavigateLocation?: () => void;
  onNavigateMfa?: () => void;
  onNavigateAbout?: () => void;
  onNavigateDeleteAccount?: () => void;
  onNavigateSupport?: () => void;
  currentRole?: 'worker' | 'employer' | 'both';
};

type SettingsItem = {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  iconBackground: string;
  onPress?: () => void;
  danger?: boolean;
};

export default function Settings({
  onBack,
  onLogout,
  onNavigatePersonalDetails,
  onNavigateChangePassword,
  onNavigateNotifications,
  onNavigateLocation,
  onNavigateMfa,
  onNavigateAbout,
  onNavigateDeleteAccount,
  onNavigateSupport,
  currentRole = 'worker',
}: SettingsProps) {
  const [showPersonalInfo, setShowPersonalInfo] = useState(false);
  const [profileName, setProfileName] = useState('Account User');
  const [profileEmail, setProfileEmail] = useState('No email set');
  const [profileAvatar, setProfileAvatar] = useState('');

  const handleLogout = () => {
    onLogout?.();
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('auth_user');
        if (!storedUser) return;
        const parsed = JSON.parse(storedUser);
        const name =
          [parsed?.firstName, parsed?.lastName].filter(Boolean).join(' ').trim() ||
          parsed?.name ||
          parsed?.username ||
          'Account User';
        const email = String(parsed?.email || '').trim() || 'No email set';
        const avatar = String(
          parsed?.avatarUrl || parsed?.avatar || parsed?.profileImage || parsed?.photo || '',
        ).trim();

        setProfileName(name);
        setProfileEmail(email);
        setProfileAvatar(avatar);
      } catch (error) {
        console.log('Failed to load settings profile', error);
      }
    };

    loadProfile();
  }, []);

  const profileInitials = useMemo(() => {
    return profileName
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [profileName]);

  const avatarSource = useMemo(() => {
    if (!profileAvatar) return null;
    const uri = profileAvatar.startsWith('http')
      ? profileAvatar
      : `${API_URL.replace(/\/api$/, '')}${profileAvatar}`;
    return { uri };
  }, [profileAvatar]);

  const handleOpenPersonalInfo = () => {
    setShowPersonalInfo(true);
  };

  const handleOpenResumeDocuments = () => {
    if (onNavigatePersonalDetails) {
      onNavigatePersonalDetails();
      return;
    }
    setShowPersonalInfo(true);
  };

  if (showPersonalInfo) {
    return <PersonalInformation key="personal-info" onBack={() => setShowPersonalInfo(false)} currentRole={currentRole} />;
  }

  const accountMenus: SettingsItem[] = [
    {
      title: 'Personal Information',
      onPress: handleOpenPersonalInfo,
      icon: 'person-outline',
      iconColor: '#2563EB',
      iconBackground: '#EAF2FF',
    },
    {
      title: 'Resume & Documents',
      onPress: handleOpenResumeDocuments,
      icon: 'document-text-outline',
      iconColor: '#2563EB',
      iconBackground: '#EAF2FF',
    },
  ];

  const securityMenus: SettingsItem[] = [
    { title: 'Change Password', onPress: onNavigateChangePassword, icon: 'lock-closed-outline' as const },
    { title: 'Two-Factor Authentication', onPress: onNavigateMfa, icon: 'shield-checkmark-outline' as const },
  ].map((item) => ({
    ...item,
    iconColor: '#0F9D71',
    iconBackground: '#E9F8F1',
  }));

  const preferencesMenus: SettingsItem[] = [
    { title: 'Notifications', onPress: onNavigateNotifications, icon: 'notifications-outline' as const },
    { title: 'Location Services', onPress: onNavigateLocation, icon: 'location-outline' as const },
  ].map((item) => ({
    ...item,
    iconColor: '#9333EA',
    iconBackground: '#F2EAFB',
  }));

  const supportMenus: SettingsItem[] = [
    { title: 'Contact Support', onPress: onNavigateSupport, icon: 'help-circle-outline' as const },
    { title: 'About', onPress: onNavigateAbout, icon: 'information-circle-outline' as const },
  ].map((item) => ({
    ...item,
    iconColor: '#475569',
    iconBackground: '#EEF2F7',
  }));

  const accountActions: SettingsItem[] = [
    {
      title: 'Log Out',
      onPress: handleLogout,
      icon: 'log-out-outline',
      iconColor: '#475569',
      iconBackground: '#F3F5F9',
    },
    {
      title: 'Delete Account',
      onPress: onNavigateDeleteAccount,
      icon: 'trash-outline',
      iconColor: '#EF4444',
      iconBackground: '#FEEDED',
      danger: true,
    },
  ];

  const renderMenuCard = (items: SettingsItem[]) => {
    return (
      <View style={styles.menuCard}>
        {items.map((item, index) => (
          <View key={item.title}>
            <TouchableOpacity style={styles.menuItem} onPress={item.onPress} activeOpacity={0.88}>
              <View style={styles.menuLeft}>
                <View style={[styles.iconWrap, { backgroundColor: item.iconBackground }]}>
                  <Ionicons name={item.icon} size={22} color={item.iconColor} />
                </View>
                <Text style={[styles.menuTitle, item.danger && styles.menuTitleDanger]}>{item.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#C0C8D4" />
            </TouchableOpacity>
            {index < items.length - 1 ? <View style={styles.divider} /> : null}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.88}>
          <Ionicons name="chevron-back" size={22} color="#4B5563" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.profileCard} onPress={handleOpenPersonalInfo} activeOpacity={0.9}>
          <View style={styles.profileLeft}>
            {avatarSource ? (
              <Image source={avatarSource} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{profileInitials}</Text>
              </View>
            )}
            <View style={styles.profileMeta}>
              <Text style={styles.profileName} numberOfLines={1}>
                {profileName}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {profileEmail}
              </Text>
            </View>
          </View>
          <View style={styles.editButton}>
            <Text style={styles.editButtonText}>Edit</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        {renderMenuCard(accountMenus)}

        <Text style={styles.sectionLabel}>SECURITY</Text>
        {renderMenuCard(securityMenus)}

        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        {renderMenuCard(preferencesMenus)}

        <Text style={styles.sectionLabel}>SUPPORT & INFO</Text>
        {renderMenuCard(supportMenus)}

        <View style={styles.footerActionsWrap}>{renderMenuCard(accountActions)}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F5F9',
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 22,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF3',
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D7DEE8',
    backgroundColor: '#EEF2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110,
    gap: 10,
  },
  profileCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5EAF1',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 102,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...tokens.shadow.card,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#CBD5E1',
  },
  avatarFallback: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  profileMeta: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  editButton: {
    minWidth: 78,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D8E3',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  sectionLabel: {
    marginTop: 12,
    marginLeft: 6,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#97A1B2',
  },
  menuCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5EAF1',
    ...tokens.shadow.card,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
    minHeight: 84,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexShrink: 1,
    minWidth: 0,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937', flexShrink: 1 },
  menuTitleDanger: { color: tokens.colors.danger },
  divider: {
    height: 1,
    backgroundColor: '#ECEFF5',
    marginLeft: 74,
  },
  footerActionsWrap: {
    marginTop: 10,
  },
});
