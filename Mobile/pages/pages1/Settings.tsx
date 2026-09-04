import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '../../lib/storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../../config';
import { apiRequest, asObject } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import ScrollView from '../../components/ui/SmoothScrollView';
import { useToast } from '../../contexts/ToastContext';
import { useFocusEffect } from '@react-navigation/native';
import ConfirmModal from '../../components/ConfirmModal';
import { EmployerAccordion } from '../../components/employer/EmployerUI';
import MenuCard, { type MenuCardItem } from '../../components/ui/MenuCard';

type SettingsProps = {
  onBack?: () => void;
  onLogout?: () => void;
  onNavigatePersonalDetails?: () => void;
  onNavigateResumeDocuments?: () => void;
  onNavigateChangePassword?: () => void;
  onNavigateNotifications?: () => void;
  onNavigateLocation?: () => void;
  onNavigateMfa?: () => void;
  onNavigateAbout?: () => void;
  onNavigateDeleteAccount?: () => void;
  onNavigateSupport?: () => void;
  onNavigatePaymentMethods?: () => void;
  onNavigateWithdrawals?: () => void;
  currentRole?: 'worker' | 'employer' | 'both';
  canSwitchAccountMode?: boolean;
  onSwitchAccountMode?: (role: 'worker' | 'employer') => Promise<boolean>;
  isSwitchingAccountMode?: boolean;
};

type SettingsItem = MenuCardItem;

export default function Settings({
  onBack,
  onLogout,
  onNavigatePersonalDetails,
  onNavigateResumeDocuments,
  onNavigateChangePassword,
  onNavigateNotifications,
  onNavigateLocation,
  onNavigateMfa,
  onNavigateAbout,
  onNavigateDeleteAccount,
  onNavigateSupport,
  onNavigatePaymentMethods,
  onNavigateWithdrawals,
  currentRole = 'worker',
  canSwitchAccountMode = false,
  onSwitchAccountMode,
  isSwitchingAccountMode = false,
}: SettingsProps) {
  const { t } = useTranslation('worker');
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [profileName, setProfileName] = useState(t('settings.profile.defaultName'));
  const [profileEmail, setProfileEmail] = useState(t('settings.profile.defaultEmail'));
  const [profileAvatar, setProfileAvatar] = useState('');
  const [hideHiredCandidates, setHideHiredCandidates] = useState(true);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);
  const [requestedMode, setRequestedMode] = useState<'worker' | 'employer' | null>(null);
  const [expandedEmployerSection, setExpandedEmployerSection] = useState<'account' | 'security' | 'preferences' | 'support' | null>('account');
  const isEmployer = currentRole === 'employer';

  const handleLogout = () => {
    onLogout?.();
  };

  useFocusEffect(useCallback(() => {
    let active = true;
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
            t('settings.apiFallback.refreshFailed')
          );
          if (result.ok) {
            const refreshed =
              asObject<any>(result.data, ['user', 'profile']) ||
              asObject<any>(result.raw, ['user', 'profile']);
            if (refreshed) {
              parsed = { ...parsed, ...refreshed };
              await AsyncStorage.setItem('auth_user', JSON.stringify(parsed));
            }
          }
        }
        const name =
          [parsed?.firstName, parsed?.lastName].filter(Boolean).join(' ').trim() ||
          parsed?.name ||
          parsed?.username ||
          t('settings.profile.defaultName');
        const email = String(parsed?.email || '').trim() || t('settings.profile.defaultEmail');
        const avatar = String(
          parsed?.avatarUrl || parsed?.avatar || parsed?.profileImage || parsed?.photo || '',
        ).trim();

        if (!active) return;
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

    void loadProfile();
    return () => { active = false; };
  }, [t]));

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
    onNavigatePersonalDetails?.();
  };

  const handleOpenResumeDocuments = () => {
    onNavigateResumeDocuments?.();
  };

  const handleToggleEmployerPrivacy = async (nextValue: boolean) => {
    setHideHiredCandidates(nextValue);
    setIsSavingPrivacy(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) throw new Error(t('settings.errors.notAuthenticated'));
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
        t('settings.apiFallback.savePrivacyFailed')
      );
      if (!result.ok) throw new Error(result.message);
      toast.success(t('settings.toast.privacySaved'));
    } catch (error: any) {
      setHideHiredCandidates(!nextValue);
      toast.error(error?.message || t('settings.apiFallback.savePrivacyFailed'));
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  const accountMenus: SettingsItem[] = isEmployer
    ? [
        {
          title: t('settings.menu.businessInformation'),
          onPress: handleOpenPersonalInfo,
          icon: 'business-outline',
          iconColor: tokens.colors.brand,
          iconBackground: '#EAF2FF',
        },
        {
          title: t('settings.menu.paymentMethods'),
          onPress: onNavigatePaymentMethods,
          icon: 'card-outline',
          iconColor: tokens.colors.brand,
          iconBackground: '#EAF2FF',
        },
      ]
    : [
        {
          title: t('settings.menu.personalInformation'),
          onPress: handleOpenPersonalInfo,
          icon: 'person-outline',
          iconColor: tokens.colors.brand,
          iconBackground: '#EAF2FF',
        },
        {
          title: t('settings.menu.resumeDocuments'),
          onPress: handleOpenResumeDocuments,
          icon: 'document-text-outline',
          iconColor: tokens.colors.brand,
          iconBackground: '#EAF2FF',
        },
        {
          title: t('settings.menu.manageWithdrawals'),
          onPress: onNavigateWithdrawals,
          icon: 'wallet-outline',
          iconColor: tokens.colors.brand,
          iconBackground: '#EAF2FF',
        },
      ];

  const securityMenus: SettingsItem[] = [
    { title: t('settings.menu.changePassword'), onPress: onNavigateChangePassword, icon: 'lock-closed-outline' as const },
    { title: t('settings.menu.twoFactorAuth'), onPress: onNavigateMfa, icon: 'shield-checkmark-outline' as const },
  ].map((item) => ({
    ...item,
    iconColor: '#0F9D71',
    iconBackground: '#E9F8F1',
  }));

  const preferencesMenus: SettingsItem[] = [
    { title: t('settings.menu.notificationInbox'), onPress: onNavigateNotifications, icon: 'notifications-outline' as const },
    { title: t('settings.menu.locationServices'), onPress: onNavigateLocation, icon: 'location-outline' as const },
  ].map((item) => ({
    ...item,
    iconColor: '#9333EA',
    iconBackground: '#F2EAFB',
  }));

  const supportMenus: SettingsItem[] = [
    { title: t('settings.menu.contactSupport'), onPress: onNavigateSupport, icon: 'help-circle-outline' as const },
    { title: t('settings.menu.about'), onPress: onNavigateAbout, icon: 'information-circle-outline' as const },
  ].map((item) => ({
    ...item,
    iconColor: '#475569',
    iconBackground: '#EEF2F7',
  }));

  const accountActions: SettingsItem[] = [
    {
      title: t('settings.menu.logOut'),
      onPress: handleLogout,
      icon: 'log-out-outline',
      iconColor: '#475569',
      iconBackground: tokens.colors.background,
    },
    {
      title: t('settings.menu.deleteAccount'),
      onPress: onNavigateDeleteAccount,
      icon: 'trash-outline',
      iconColor: '#EF4444',
      iconBackground: '#FEEDED',
      danger: true,
    },
  ];

  const renderMenuCard = (items: SettingsItem[]) => <MenuCard items={items} />;
  const renderSettingsSection = (key: 'account' | 'security' | 'preferences' | 'support', title: string, items: SettingsItem[]) => isEmployer ? (
    <EmployerAccordion title={title} expanded={expandedEmployerSection === key} onToggle={() => setExpandedEmployerSection((section) => section === key ? null : key)}>
      {renderMenuCard(items)}
    </EmployerAccordion>
  ) : <><Text style={styles.sectionLabel}>{title.toUpperCase()}</Text>{renderMenuCard(items)}</>;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.88} accessibilityRole="button" accessibilityLabel={t('settings.header.backAccessibility')} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={tokens.colors.brand} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{t('settings.header.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('settings.header.subtitle')}</Text>
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
                <Text style={styles.profileBadgeText}>{currentRole === 'employer' ? t('settings.profile.badge.employer') : t('settings.profile.badge.worker')}</Text>
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
            <Text style={styles.editButtonText}>{t('settings.profile.openButton')}</Text>
          </View>
        </TouchableOpacity>

        {canSwitchAccountMode ? (
          <>
            <Text style={styles.sectionLabel}>{t('settings.modeCard.sectionLabel')}</Text>
            <View style={styles.modeCard}>
              <View style={styles.modeCopy}>
                <Text style={styles.modeTitle}>
                  {isEmployer ? t('settings.modeCard.toggleTitle.toWorker') : t('settings.modeCard.toggleTitle.toHire')}
                </Text>
                <Text style={styles.modeDescription}>
                  {isEmployer ? t('settings.modeCard.toggleHint.toWorker') : t('settings.modeCard.toggleHint.toHire')}
                </Text>
              </View>
              <Switch
                value={isEmployer}
                onValueChange={() => setRequestedMode(isEmployer ? 'worker' : 'employer')}
                disabled={isSwitchingAccountMode}
                trackColor={{ false: tokens.colors.border, true: tokens.colors.brand }}
                thumbColor={tokens.colors.white}
                ios_backgroundColor={tokens.colors.border}
                accessibilityRole="switch"
                accessibilityLabel={isEmployer ? t('settings.modeCard.switchAccessibility.toWorker') : t('settings.modeCard.switchAccessibility.toEmployer')}
                accessibilityState={{ checked: isEmployer, disabled: isSwitchingAccountMode }}
              />
            </View>
          </>
        ) : null}

        {renderSettingsSection('account', t('settings.sections.account'), accountMenus)}

        {renderSettingsSection('security', t('settings.sections.security'), securityMenus)}

        {isEmployer ? (
          <>
            <Text style={styles.sectionLabel}>{t('settings.employerPrivacy.sectionLabel')}</Text>
            <View style={styles.preferenceCard}>
              <View style={styles.preferenceCopy}>
                <Text style={styles.preferenceTitle}>{t('settings.employerPrivacy.title')}</Text>
                <Text style={styles.preferenceDescription}>
                  {t('settings.employerPrivacy.description')}
                </Text>
              </View>
              <Switch
                value={hideHiredCandidates}
                onValueChange={handleToggleEmployerPrivacy}
                disabled={isSavingPrivacy}
                trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                thumbColor={hideHiredCandidates ? '#16A34A' : tokens.colors.background}
                accessibilityLabel={t('settings.employerPrivacy.accessibilityLabel')}
              />
            </View>
          </>
        ) : null}

        {renderSettingsSection('preferences', t('settings.sections.preferences'), preferencesMenus)}

        {renderSettingsSection('support', t('settings.sections.supportInfo'), supportMenus)}

        <View style={styles.footerActionsWrap}>{renderMenuCard(accountActions)}</View>
      </ScrollView>
      <ConfirmModal
        visible={Boolean(requestedMode)}
        title={requestedMode === 'employer' ? t('settings.confirmMode.titleToEmployer') : t('settings.confirmMode.titleToWorker')}
        description={requestedMode === 'employer' ? t('settings.confirmMode.descriptionToEmployer') : t('settings.confirmMode.descriptionToWorker')}
        confirmLabel={requestedMode === 'employer' ? t('settings.modeCard.switchLabel.toEmployer') : t('settings.modeCard.switchLabel.toWorker')}
        pending={isSwitchingAccountMode}
        onCancel={() => setRequestedMode(null)}
        onConfirm={() => { if (!requestedMode || !onSwitchAccountMode) return; void onSwitchAccountMode(requestedMode).then((switched) => { if (switched) setRequestedMode(null); }); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.signedInCanvas,
  },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceMuted,
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
    color: tokens.colors.text,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: tokens.colors.textMuted,
    fontWeight: '500',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 112,
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
    backgroundColor: 'rgba(28,77,141,0.22)',
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
    color: tokens.colors.surface,
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
    color: tokens.colors.surface,
  },
  sectionLabel: {
    marginTop: 12,
    marginLeft: 6,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#97A1B2',
  },
  modeCard: { minHeight: 104, borderRadius: 24, borderWidth: 1, borderColor: tokens.colors.brandMuted, backgroundColor: tokens.colors.surface, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...tokens.shadow.card },
  modeCopy: { flex: 1, minWidth: 0 }, modeTitle: { fontSize: 16, fontWeight: '800', color: tokens.colors.brandDark }, modeDescription: { marginTop: 3, fontSize: 11, lineHeight: 16, color: tokens.colors.textMuted },
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
