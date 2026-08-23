import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '../../lib/storage';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../config';
import EmployerNavigation from '../../components/employerNavigation';
import ScrollView from '../../components/ui/SmoothScrollView';
import TabTopNav from '../../components/TabTopNav';
import { apiRequest, asObject } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import { useToast } from '../../contexts/ToastContext';
import {
  PROFILE_LIMITS,
  validateMobileAvatar,
} from '../../lib/profileValidation';
import ProfileReviewsLoader from '../../components/reviews/ProfileReviewsLoader';
import { EmployerAccordion, EmployerModeBanner } from '../../components/employer/EmployerUI';
import { useFocusEffect } from '@react-navigation/native';

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
  onOpenWallet?: () => void;
  onOpenSettings?: () => void;
  onEditProfile?: () => void;
};

export default function EmployerProfile({
  employer,
  activeTab,
  onTabPress,
  onOpenWallet,
  onOpenSettings,
  onEditProfile,
}: EmployerProfileProps) {
  const [firstName, setFirstName] = useState(employer?.firstName || '');
  const [lastName, setLastName] = useState(employer?.lastName || '');
  const [email, setEmail] = useState(employer?.email || '');
  const [phone, setPhone] = useState(employer?.phone || '');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileId, setProfileId] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'readiness' | 'identity' | 'contact' | 'reviews' | null>('readiness');
  const toast = useToast();
  const { t } = useTranslation('employer');

  const employerName = firstName || lastName ? `${firstName} ${lastName}`.trim() : t('employerProfile.defaultName');
  const initials = employerName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  useFocusEffect(useCallback(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('auth_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          if (!active) return;
          setProfileId(String(parsed?.id || parsed?._id || parsed?.userId || ''));
          setFirstName(parsed?.firstName || '');
          setLastName(parsed?.lastName || '');
          setEmail(parsed?.email || '');
          setPhone(parsed?.phoneNumber || '');
          setCity(parsed?.city || '');
          setAddress(parsed?.address || '');
          setAvatarUrl(parsed?.avatarUrl || '');
        }
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) return;
        const result = await apiRequest(
          `${API_URL}/auth/me`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
          t('employerProfile.errors.loadFailed'),
        );
        if (!result.ok) return;
        const payload = asObject<any>(result.raw) || {};
        const dataPayload = asObject<any>(result.data) || {};
        const profile = dataPayload?.user || payload?.user || dataPayload?.profile || payload?.profile || dataPayload;
        if (profile) {
          if (!active) return;
          setProfileId(String(profile.id || profile._id || profile.userId || ''));
          setFirstName(profile.firstName || '');
          setLastName(profile.lastName || '');
          setEmail(profile.email || '');
          setPhone(profile.phoneNumber || '');
          setCity(profile.city || '');
          setAddress(profile.address || '');
          setAvatarUrl(profile.avatarUrl || '');
        }
      } catch {
        // Keep the last authenticated profile visible during temporary refresh failures.
      }
    };

    void loadProfile();
    return () => { active = false; };
  }, [t]));

  const handleUploadAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast.error(t('employerProfile.toast.photoPermission'));
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (picked.canceled || !picked.assets?.length) {
        return;
      }

      const asset = picked.assets[0];
      const { extension, mimeType, error: avatarError } = validateMobileAvatar(asset);
      if (avatarError) {
        toast.error(avatarError);
        return;
      }
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        toast.error(t('employerProfile.toast.signInAgain'));
        return;
      }

      const ext = extension;
      const mime = mimeType;
      const form = new FormData();
      form.append('avatar', {
        uri: asset.uri,
        name: asset.fileName || `avatar.${ext}`,
        type: mime,
      } as any);

      setIsUploadingAvatar(true);
      const result = await apiRequest(
        `${API_URL}/auth/profile/avatar`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: form,
        },
        t('employerProfile.toast.avatarUploadFailed'),
      );

      if (!result.ok) {
        throw new Error(result.message || t('employerProfile.toast.avatarUploadFailed'));
      }

      const payload = asObject<any>(result.raw) || {};
      const dataPayload = asObject<any>(result.data) || {};
      const nextAvatarUrl = dataPayload?.data?.avatarUrl || payload?.data?.avatarUrl || dataPayload?.avatarUrl;
      if (nextAvatarUrl) {
        setAvatarUrl(nextAvatarUrl);
      }
      toast.success(t('employerProfile.toast.avatarUpdated'));
    } catch (error: any) {
      toast.error(error?.message || t('employerProfile.toast.avatarUploadFailed'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const avatarSource = useMemo(
    () => (avatarUrl ? { uri: avatarUrl.startsWith('http') ? avatarUrl : `${API_URL.replace(/\/api$/, '')}${avatarUrl}` } : null),
    [avatarUrl],
  );

  const completionItems = useMemo(
    () => [
      { label: t('employerProfile.completion.photo'), complete: Boolean(avatarUrl) },
      { label: t('employerProfile.completion.name'), complete: Boolean(firstName.trim() && lastName.trim()) },
      { label: t('employerProfile.completion.email'), complete: Boolean(email.trim()) },
      { label: t('employerProfile.completion.phone'), complete: Boolean(phone.trim()) },
      { label: t('employerProfile.completion.city'), complete: Boolean(city.trim()) },
      { label: t('employerProfile.completion.address'), complete: Boolean(address.trim()) },
    ],
    [address, avatarUrl, city, email, firstName, lastName, phone, t],
  );

  const completedCount = completionItems.filter((item) => item.complete).length;
  const completionRate = Math.round((completedCount / completionItems.length) * 100);

  return (
    <View style={styles.container}>
      <TabTopNav
        title={t('employerProfile.header.title')}
        onOpenSettings={onOpenSettings}
        showSettings
        employerMode
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <EmployerModeBanner title={t('employerProfile.banner.title')} detail={t('employerProfile.banner.detail')} />
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />

          <View style={styles.heroTopRow}>
            <View style={styles.avatarFrame}>
              <TouchableOpacity style={styles.avatar} onPress={handleUploadAvatar} disabled={isUploadingAvatar} activeOpacity={0.92} accessibilityRole="button" accessibilityLabel={t('employerProfile.avatar.changeLabel')} accessibilityHint={t('employerProfile.avatar.changeHint')} accessibilityState={{ disabled: isUploadingAvatar, busy: isUploadingAvatar }}>
                {avatarSource ? <Image source={avatarSource} style={styles.avatarImage} accessibilityLabel={t('employerProfile.avatar.currentLabel')} /> : <Text style={styles.avatarText}>{initials}</Text>}
                {isUploadingAvatar ? (
                  <View style={styles.avatarLoadingOverlay}>
                    <ActivityIndicator size="small" color={tokens.colors.white} />
                  </View>
                ) : null}
              </TouchableOpacity>
              <TouchableOpacity style={styles.avatarEditButton} onPress={handleUploadAvatar} disabled={isUploadingAvatar} activeOpacity={0.92} accessible={false}>
                <Ionicons name="camera-outline" size={16} color={tokens.colors.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.heroMeta}>
              <View style={styles.heroBadge}>
                <Ionicons name="business-outline" size={15} color={tokens.colors.brand} />
                <Text style={styles.heroBadgeText}>{t('employerProfile.hero.badge')}</Text>
              </View>
              <Text style={styles.name}>{employerName}</Text>
              <Text style={styles.subtitle}>{t('employerProfile.hero.subtitle')}</Text>
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{completionRate}%</Text>
              <Text style={styles.heroStatLabel}>{t('employerProfile.hero.profileCompleteLabel')}</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{completedCount}/{completionItems.length}</Text>
              <Text style={styles.heroStatLabel}>{t('employerProfile.hero.readyItemsLabel')}</Text>
            </View>
          </View>

          <View style={styles.heroActionRow}>
            <TouchableOpacity
              style={[styles.secondaryAction, !onOpenSettings && styles.disabledAction]}
              onPress={onOpenSettings}
              disabled={!onOpenSettings}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel={t('employerProfile.hero.settingsAccessibilityLabel')}
              accessibilityState={{ disabled: !onOpenSettings }}
            >
              <Ionicons name="settings-outline" size={18} color={tokens.colors.onCanvasMuted} />
              <Text style={styles.secondaryActionText}>{t('employerProfile.hero.settingsLabel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryAction, !onOpenWallet && styles.disabledAction]}
              onPress={onOpenWallet}
              disabled={!onOpenWallet}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel={t('employerProfile.hero.walletAccessibilityLabel')}
              accessibilityState={{ disabled: !onOpenWallet }}
            >
              <Ionicons name="wallet-outline" size={18} color={tokens.colors.white} />
              <Text style={styles.primaryActionText}>{t('employerProfile.hero.walletLabel')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <EmployerAccordion title={t('employerProfile.readiness.accordionTitle')} subtitle={t('employerProfile.readiness.accordionSubtitle')} icon="shield-checkmark-outline" badge={`${completionRate}%`} expanded={expandedSection === 'readiness'} onToggle={() => setExpandedSection((section) => section === 'readiness' ? null : 'readiness')}>
        <View style={styles.progressContent}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('employerProfile.readiness.sectionTitle')}</Text>
            <Text style={styles.sectionHint}>{completionRate}%</Text>
          </View>
          <Text style={styles.progressSubtitle}>{t('employerProfile.readiness.subtitle')}</Text>
          <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityLabel={t('employerProfile.readiness.progressAccessibilityLabel')} accessibilityValue={{ min: 0, max: 100, now: completionRate, text: t('employerProfile.readiness.progressValueText', { percent: completionRate }) }}>
            <View style={[styles.progressFill, { width: `${completionRate}%` }]} />
          </View>
          <View style={styles.checklistRow}>
            {completionItems.map((item) => (
              <View key={item.label} style={styles.checklistItem}>
                <Ionicons
                  name={item.complete ? 'checkmark-circle' : 'ellipse-outline'}
                  size={15}
                  color={item.complete ? tokens.colors.success : tokens.colors.textSubtle}
                />
                <Text style={[styles.checklistText, !item.complete && styles.checklistTextMuted]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
        </EmployerAccordion>

        <EmployerAccordion title={t('employerProfile.identity.accordionTitle')} subtitle={t('employerProfile.identity.accordionSubtitle')} icon="business-outline" expanded={expandedSection === 'identity'} onToggle={() => setExpandedSection((section) => section === 'identity' ? null : 'identity')}>
        <View pointerEvents="none">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('employerProfile.identity.sectionTitle')}</Text>
            <Text style={styles.sectionHint}>{t('employerProfile.identity.sectionHint')}</Text>
          </View>

          <Text style={styles.fieldLabel}>{t('employerProfile.identity.nameLabel')}</Text>
          <View style={styles.nameRow}>
            <TextInput
              style={[styles.input, styles.nameInput]}
              placeholder={t('employerProfile.identity.firstNamePlaceholder')}
              placeholderTextColor={tokens.colors.textSubtle}
              value={firstName}
              editable={false}
              maxLength={PROFILE_LIMITS.name}
              onChangeText={setFirstName}
              accessibilityLabel={t('employerProfile.identity.firstNameAccessibilityLabel')}
            />
            <TextInput
              style={[styles.input, styles.nameInput]}
              placeholder={t('employerProfile.identity.lastNamePlaceholder')}
              placeholderTextColor={tokens.colors.textSubtle}
              value={lastName}
              editable={false}
              maxLength={PROFILE_LIMITS.name}
              onChangeText={setLastName}
              accessibilityLabel={t('employerProfile.identity.lastNameAccessibilityLabel')}
            />
          </View>

          <Text style={styles.fieldLabel}>{t('employerProfile.identity.emailLabel')}</Text>
          <TextInput
            style={[styles.input, styles.inputReadOnly]}
            placeholder={t('employerProfile.identity.emailPlaceholder')}
            placeholderTextColor={tokens.colors.textSubtle}
            value={email}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={false}
            accessibilityLabel={t('employerProfile.identity.emailAccessibilityLabel')}
            accessibilityState={{ disabled: true }}
          />
          <Text style={styles.helperText}>{t('employerProfile.identity.emailHelper')}</Text>
        </View>
        </EmployerAccordion>

        <EmployerAccordion title={t('employerProfile.contact.accordionTitle')} subtitle={city || t('employerProfile.contact.accordionSubtitleFallback')} icon="location-outline" expanded={expandedSection === 'contact'} onToggle={() => setExpandedSection((section) => section === 'contact' ? null : 'contact')}>
        <View pointerEvents="none">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('employerProfile.contact.sectionTitle')}</Text>
            <Text style={styles.sectionHint}>{t('employerProfile.contact.sectionHint')}</Text>
          </View>

          <Text style={styles.fieldLabel}>{t('employerProfile.contact.phoneLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('employerProfile.contact.phonePlaceholder')}
            placeholderTextColor={tokens.colors.textSubtle}
            value={phone}
            editable={false}
            maxLength={20}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            accessibilityLabel={t('employerProfile.contact.phoneAccessibilityLabel')}
          />

          <Text style={styles.fieldLabel}>{t('employerProfile.contact.cityLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('employerProfile.contact.cityPlaceholder')}
            placeholderTextColor={tokens.colors.textSubtle}
            value={city}
            editable={false}
            maxLength={PROFILE_LIMITS.city}
            onChangeText={setCity}
            accessibilityLabel={t('employerProfile.contact.cityAccessibilityLabel')}
          />

          <Text style={styles.fieldLabel}>{t('employerProfile.contact.addressLabel')}</Text>
          <TextInput
            style={[styles.input, styles.addressInput]}
            placeholder={t('employerProfile.contact.addressPlaceholder')}
            placeholderTextColor={tokens.colors.textSubtle}
            value={address}
            editable={false}
            maxLength={PROFILE_LIMITS.address}
            onChangeText={setAddress}
            multiline
            accessibilityLabel={t('employerProfile.contact.addressAccessibilityLabel')}
          />
        </View>
        </EmployerAccordion>

        <TouchableOpacity style={[styles.saveButton, !onEditProfile && styles.saveButtonDisabled]} onPress={onEditProfile} disabled={!onEditProfile} activeOpacity={0.92} accessibilityRole="button" accessibilityLabel={t('employerProfile.editAccessibilityLabel')} accessibilityState={{ disabled: !onEditProfile }}>
          <Ionicons name="create-outline" size={18} color={tokens.colors.white} />
          <Text style={styles.saveButtonText}>{t('employerProfile.editButton')}</Text>
        </TouchableOpacity>

        <EmployerAccordion title={t('employerProfile.reviews.accordionTitle')} subtitle={t('employerProfile.reviews.accordionSubtitle')} icon="star-outline" expanded={expandedSection === 'reviews'} onToggle={() => setExpandedSection((section) => section === 'reviews' ? null : 'reviews')}>
        <ProfileReviewsLoader
          profileOwnerId={profileId}
          profileOwnerName={employerName}
          viewAs="employer"
        />
        </EmployerAccordion>
      </ScrollView>

      <EmployerNavigation activeTab={activeTab} onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.signedInCanvas,
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: tokens.layout.tabBarClearance,
    gap: 18,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: 18,
    gap: 18,
    overflow: 'hidden',
    ...tokens.shadow.card,
  },
  heroGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: tokens.colors.brandSoft,
    top: -60,
    right: -36,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarFrame: {
    width: 120,
    height: 120,
    borderRadius: 28,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.brandMuted,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarText: {
    color: tokens.colors.brandDark,
    fontWeight: '800',
    fontSize: 28,
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  avatarEditButton: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.brand,
    borderWidth: 3,
    borderColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadow.card,
  },
  heroMeta: {
    flex: 1,
    gap: 8,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.brandSoft,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.brand,
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: tokens.colors.text,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: tokens.colors.textMuted,
    fontWeight: '500',
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heroStatCard: {
    flex: 1,
    minHeight: 88,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.contentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  heroStatValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: tokens.colors.text,
  },
  heroStatLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.textMuted,
  },
  heroActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  secondaryAction: {
    flex: 1,
    minWidth: 132,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onCanvasMuted,
  },
  primaryAction: {
    flex: 1,
    minWidth: 132,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: tokens.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...tokens.shadow.card,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.surface,
  },
  disabledAction: {
    opacity: 0.55,
  },
  progressContent: { paddingVertical: 2 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: tokens.colors.text,
  },
  sectionHint: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.brand,
  },
  progressSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: tokens.colors.textMuted,
    fontWeight: '500',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: tokens.colors.brandMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: tokens.colors.brand,
  },
  checklistRow: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  checklistItem: {
    minWidth: '29%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checklistText: {
    fontSize: 13,
    color: tokens.colors.onCanvasMuted,
    fontWeight: '600',
  },
  checklistTextMuted: {
    color: tokens.colors.textSubtle,
  },
  fieldLabel: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onCanvasMuted,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 10,
  },
  nameInput: {
    flex: 1,
  },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.contentSurface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: tokens.colors.text,
  },
  inputReadOnly: {
    color: tokens.colors.textMuted,
    backgroundColor: tokens.colors.surfaceMuted,
  },
  helperText: {
    marginTop: 6,
    color: tokens.colors.textMuted,
    fontSize: 12,
  },
  addressInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  saveButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: tokens.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
    ...tokens.shadow.card,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.surface,
  },
});
