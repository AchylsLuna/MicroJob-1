import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import AppHeader from '../../components/AppHeader';
import { tokens } from '../../theme/tokens';

export default function ContactSupport({ onBack }: { onBack?: () => void }) {
  return (
    <View style={styles.container}>
      <AppHeader title="Contact Support" subtitle="We're here to help" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>Need help?</Text>
          <Text style={styles.body}>Email: support@microjob.app</Text>
          <Text style={styles.body}>Response time: within 24 hours</Text>
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
    ...tokens.shadow.card,
  },
  title: { fontSize: 17, fontWeight: '700', color: tokens.colors.text, marginBottom: 10 },
  body: { fontSize: 14, color: '#1f2937', marginTop: 6 },
});
