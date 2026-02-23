import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

type AboutProps = {
  onBack?: () => void;
};

export default function About({ onBack }: AboutProps) {
  const aboutMenus = [
    { title: 'Security' },
    { title: 'Privacy' },
    { title: 'Terms & Conditions' },
    { title: 'Help & Support' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Menu Card */}
        <View style={styles.menuCard}>
          {aboutMenus.map((menu, index) => (
            <View key={index}>
              <TouchableOpacity style={styles.menuItem}>
                <Text style={styles.menuTitle}>{menu.title}</Text>
                <Text style={styles.arrowIcon}>›</Text>
              </TouchableOpacity>
              {index < aboutMenus.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
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
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 32, color: '#fff', fontWeight: '300' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff', flex: 1, textAlign: 'center' },
  placeholder: { width: 40 },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 100 },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  menuTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  arrowIcon: { fontSize: 20, color: '#9ca3af' },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
});
