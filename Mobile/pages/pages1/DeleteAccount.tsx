import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import AppHeader from '../../components/AppHeader';
import { tokens } from '../../theme/tokens';

export default function DeleteAccount({ onBack }: { onBack?: () => void }) {
  return (
    <View style={styles.container}>
      <AppHeader title="Delete Account" subtitle="This action is permanent" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>Permanently delete your account</Text>
          <Text style={styles.body}>
            This action cannot be undone. All profile data, applications, and messages will be removed.
          </Text>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={() => Alert.alert('Delete Account', 'Delete flow placeholder.')}
          >
            <Text style={styles.dangerButtonText}>Delete My Account</Text>
          </TouchableOpacity>
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
  title: { fontSize: 17, fontWeight: '700', color: '#991b1b' },
  body: { fontSize: 14, color: '#1f2937', marginTop: 10, lineHeight: 20 },
  dangerButton: {
    marginTop: 20,
    backgroundColor: tokens.colors.danger,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerButtonText: { color: tokens.colors.white, fontWeight: '700', fontSize: 14 },
});
