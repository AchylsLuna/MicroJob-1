import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import AppHeader from '../../components/AppHeader';
import { tokens } from '../../theme/tokens';

export default function LocationServices({ onBack }: { onBack?: () => void }) {
  const [enabled, setEnabled] = useState(false);

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    Alert.alert('Location Services', next ? 'Location enabled.' : 'Location disabled.');
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Location Services" subtitle="Control location permissions" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Use Your Location</Text>
          <Text style={styles.sectionSubtitle}>
            Allow location access to show nearby jobs and enable location-based alerts.
          </Text>
          <TouchableOpacity style={[styles.toggle, enabled && styles.toggleActive]} onPress={handleToggle}>
            <Text style={[styles.toggleText, enabled && styles.toggleTextActive]}>
              {enabled ? 'Enabled' : 'Enable Location'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Current Location</Text>
          <Text style={styles.sectionSubtitle}>Based on your device settings.</Text>
          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>City</Text>
            <Text style={styles.locationValue}>{enabled ? 'Manila, Philippines' : 'Not available'}</Text>
          </View>
          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>Coordinates</Text>
            <Text style={styles.locationValue}>{enabled ? '14.5995, 120.9842' : '—'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Map Preview</Text>
          <Text style={styles.sectionSubtitle}>Location preview (UI only).</Text>
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapText}>Map Preview</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 100 },
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
