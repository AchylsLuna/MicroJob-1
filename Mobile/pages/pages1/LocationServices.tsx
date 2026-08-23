import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import AppHeader from '../../components/AppHeader';
import ScrollView from '../../components/ui/SmoothScrollView';
import { tokens } from '../../theme/tokens';
import { useToast } from '../../contexts/ToastContext';

export default function LocationServices({ onBack }: { onBack?: () => void }) {
  const { t } = useTranslation('worker');
  const [enabled, setEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [city, setCity] = useState(t('locationServices.city.notAvailable'));
  const [coordinates, setCoordinates] = useState('—');
  const toast = useToast();

  const fetchCurrentLocation = async () => {
    setIsLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setEnabled(false);
        setCity(t('locationServices.city.permissionDenied'));
        setCoordinates('—');
        toast.error(t('locationServices.toast.permissionDenied'));
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;
      setCoordinates(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);

      try {
        const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        const first = geocode[0];
        const resolvedCity = first?.city || first?.district || first?.region || t('locationServices.city.unknown');
        const resolvedCountry = first?.country ? `, ${first.country}` : '';
        setCity(`${resolvedCity}${resolvedCountry}`);
      } catch (error) {
        setCity(t('locationServices.city.unknown'));
      }

      setEnabled(true);
      toast.success(t('locationServices.toast.enabled'));
    } catch (error: any) {
      setEnabled(false);
      setCity(t('locationServices.city.notAvailable'));
      setCoordinates('—');
      toast.error(error?.message || t('locationServices.toast.getLocationFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async () => {
    if (enabled) {
      setEnabled(false);
      setCity(t('locationServices.city.notAvailable'));
      setCoordinates('—');
      toast.info(t('locationServices.toast.disabled'));
      return;
    }

    await fetchCurrentLocation();
  };

  return (
    <View style={styles.container}>
      <AppHeader title={t('locationServices.headerTitle')} subtitle={t('locationServices.headerSubtitle')} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('locationServices.useLocation.title')}</Text>
          <Text style={styles.sectionSubtitle}>
            {t('locationServices.useLocation.subtitle')}
          </Text>
          <TouchableOpacity style={[styles.toggle, enabled && styles.toggleActive]} onPress={handleToggle}>
            {isLoading ? (
              <ActivityIndicator color={enabled ? tokens.colors.white : tokens.colors.brand} />
            ) : (
              <Text style={[styles.toggleText, enabled && styles.toggleTextActive]}>
                {enabled ? t('locationServices.useLocation.enabledLabel') : t('locationServices.useLocation.enableLabel')}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('locationServices.currentLocation.title')}</Text>
          <Text style={styles.sectionSubtitle}>{t('locationServices.currentLocation.subtitle')}</Text>
          <View style={styles.locationRow}>
              <Text style={styles.locationLabel}>{t('locationServices.currentLocation.cityLabel')}</Text>
              <Text style={styles.locationValue}>{city}</Text>
            </View>
            <View style={styles.locationRow}>
              <Text style={styles.locationLabel}>{t('locationServices.currentLocation.coordinatesLabel')}</Text>
              <Text style={styles.locationValue}>{coordinates}</Text>
            </View>
          </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('locationServices.mapPreview.title')}</Text>
          <Text style={styles.sectionSubtitle}>{t('locationServices.mapPreview.subtitle')}</Text>
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapText}>{t('locationServices.mapPreview.placeholder')}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 112 },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.lg,
    padding: 16,
    marginBottom: 16,
    ...tokens.shadow.card,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: tokens.colors.text, marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: tokens.colors.textMuted, marginBottom: 12 },
  toggle: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: tokens.colors.brand },
  toggleText: { color: tokens.colors.textMuted, fontWeight: '600' },
  toggleTextActive: { color: tokens.colors.white },
  locationRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  locationLabel: { fontSize: 13, color: tokens.colors.textMuted },
  locationValue: { fontSize: 13, color: tokens.colors.text, fontWeight: '600' },
  mapPlaceholder: {
    height: 160,
    borderRadius: 12,
    backgroundColor: '#eef2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapText: { color: '#94a3b8', fontWeight: '600' },
});
