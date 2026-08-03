import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import AppHeader from '../../components/AppHeader';
import { tokens } from '../../theme/tokens';

export default function About({ onBack }: { onBack?: () => void }) {
  return (
    <View style={styles.container}>
      <AppHeader title="About" subtitle="Platform information" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>Micro Jobs</Text>
          <Text style={styles.subtitle}>Version 1.0.0</Text>
          <Text style={styles.body}>
            Micro Jobs connects workers and employers for fast local hiring and messaging.
          </Text>
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
    ...tokens.shadow.card,
  },
  title: { fontSize: 18, fontWeight: '700', color: tokens.colors.text },
  subtitle: { fontSize: 13, color: tokens.colors.textMuted, marginTop: 4 },
  body: { fontSize: 14, color: '#1f2937', marginTop: 12, lineHeight: 20 },
});
