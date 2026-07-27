import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../../config';
import { apiRequest, asObject } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import { useToast } from '../../contexts/ToastContext';
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
  onNavigatePaymentMethods?: () => void;
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
  onNavigatePaymentMethods,
  currentRole = 'worker',
}: SettingsProps) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [showPersonalInfo, setShowPersonalInfo] = useState(false);
  const [profileName, setProfileName] = useState('Account User');
  const [profileEmail, setProfileEmail] = useState('No email set');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [hideHiredCandidates, setHideHiredCandidates] = useState(true);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);
  const isEmployer = currentRole === 'employer';

  const handleLogout = () => {
    onLogout?.();
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const [storedUser, token] = await Promise.all([
          AsyncStorage.getItem('auth_user'),
          AsyncStorage.getItem('auth_token'),
        ]);
        let parsed = storedUser ? JSON.parse(storedUser) : {};

        if (token) {
          const result = await apiRequest(
            `${API_URL}/auth/me`,
            { headers: { Authorization: `Bearer ${token}` } },
            'Failed to refresh settings.'
          );
          if (result.ok) {
            parsed = asObject<any>(result.data) || parsed;
          }
        }
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
        if (typeof parsed?.hideHiredCandidates === 'boolean') {
          setHideHiredCandidates(parsed.hideHiredCandidates);
        }
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

  const handleToggleEmployerPrivacy = async (nextValue: boolean) => {
    setHideHiredCandidates(nextValue);
    setIsSavingPrivacy(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) throw new Error('Not authenticated. Please sign in again.');
      const result = await apiRequest(
        `${API_URL}/auth/me`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ hideHiredCandidates: nextValue }),
        },
        'Failed to save employer privacy setting.'
      );
      if (!result.ok) throw new Error(result.message);
      toast.success('Employer privacy setting saved.');
    } catch (error: any) {
      setHideHiredCandidates(!nextValue);
      toast.error(error?.message || 'Failed to save employer privacy setting.');
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  if (showPersonalInfo) {
    return <PersonalInformation key="personal-info" onBack={() => setShowPersonalInfo(false)} currentRole={currentRole} />;
  }

  const accountMenus: SettingsItem[] = isEmployer
    ? [
        {
          title: 'Business Information',
          onPress: handleOpenPersonalInfo,
          icon: 'business-outline',
          iconColor: '#2563EB',
          iconBackground: '#EAF2FF',
        },
        {
          title: 'Payment Methods',
          onPress: onNavigatePaymentMethods,
          icon: 'card-outline',
          iconColor: '#2563EB',
          iconBackground: '#EAF2FF',
        },
      ]
    : [
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
    { title: 'Notification Inbox', onPress: onNavigateNotifications, icon: 'notifications-outline' as const },
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
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.88}>
          <Ionicons name="chevron-back" size={22} color="#E2E8F0" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Manage profile, security, support, and account controls.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.profileCard} onPress={handleOpenPersonalInfo} activeOpacity={0.9}>
          <View style={styles.profileGlow} />
          <View style={styles.profileLeft}>
            {avatarSource ? (
              <Image source={avatarSource} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{profileInitials}</Text>
              </View>
            )}
            <View style={styles.profileMeta}>
              <View style={styles.profileBadge}>
                <Text style={styles.profileBadgeText}>{currentRole === 'employer' ? 'Employer settings' : 'Worker settings'}</Text>
              </View>
              <Text style={styles.profileName} numberOfLines={1}>
                {profileName}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {profileEmail}
              </Text>
            </View>
          </View>
          <View style={styles.editButton}>
            <Text style={styles.editButtonText}>Open</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        {renderMenuCard(accountMenus)}

        <Text style={styles.sectionLabel}>SECURITY</Text>
        {renderMenuCard(securityMenus)}

        {isEmployer ? (
          <>
            <Text style={styles.sectionLabel}>EMPLOYER PRIVACY</Text>
            <View style={styles.preferenceCard}>
              <View style={styles.preferenceCopy}>
                <Text style={styles.preferenceTitle}>Hide number of hired candidates</Text>
                <Text style={styles.preferenceDescription}>
                  Keep your hiring count private across web and mobile.
                </Text>
              </View>
              <Switch
                value={hideHiredCandidates}
                onValueChange={handleToggleEmployerPrivacy}
                disabled={isSavingPrivacy}
                trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                thumbColor={hideHiredCandidates ? '#16A34A' : '#F8FAFC'}
                accessibilityLabel="Hide number of hired candidates"
              />
            </View>
          </>
        ) : null}

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
    paddingHorizontal: 22,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#0a2847',
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#CBD5F0',
    fontWeight: '500',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110,
    gap: 10,
  },
  profileCard: {
    backgroundColor: '#0F2954',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 102,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...tokens.shadow.card,
  },
  profileGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(37,99,235,0.22)',
    top: -28,
    right: -24,
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
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  avatarFallback: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#DCE6F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  profileMeta: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  profileBadge: {
    alignSelf: 'flex-start',
    minHeight: 26,
    borderRadius: 999,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  profileBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#BFDBFE',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileEmail: {
    fontSize: 13,
    color: '#CBD5F0',
    fontWeight: '500',
  },
  editButton: {
    minWidth: 78,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
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
  preferenceCard: {
    minHeight: 104,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5EAF1',
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    ...tokens.shadow.card,
  },
  preferenceCopy: {
    flex: 1,
    gap: 4,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  preferenceDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
  },
});
