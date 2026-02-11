import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';

export default function LocationServices({ onBack }: { onBack?: () => void }) {
  const [enabled, setEnabled] = useState(false);

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    Alert.alert('Location Services', next ? 'Location enabled.' : 'Location disabled.');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Location Services</Text>
        <View style={styles.placeholder} />
      </View>

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
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 32, color: '#fff', fontWeight: '300' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff', flex: 1, textAlign: 'center' },
  placeholder: { width: 40 },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 100 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: '#6b7280', marginBottom: 12 },
  toggle: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: '#1c4d8d' },
  toggleText: { color: '#6b7280', fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
  locationRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  locationLabel: { fontSize: 13, color: '#6b7280' },
  locationValue: { fontSize: 13, color: '#111827', fontWeight: '600' },
  mapPlaceholder: {
    height: 160,
    borderRadius: 12,
    backgroundColor: '#eef2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapText: { color: '#94a3b8', fontWeight: '600' },
});
