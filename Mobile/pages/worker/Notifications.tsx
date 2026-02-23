import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';

type NotificationsProps = {
  onBack?: () => void;
};

export default function Notifications({ onBack }: NotificationsProps) {
  const [jobOpportunities, setJobOpportunities] = useState(true);
  const [applicationUpdates, setApplicationUpdates] = useState(true);
  const [yourContent, setYourContent] = useState(true);
  const [jobstreetBenefits, setJobstreetBenefits] = useState(true);
  const [adviceInsights, setAdviceInsights] = useState(true);

  const notificationItems = [
    {
      title: 'Job opportunities',
      description: "We'll send tips to help you find your next role",
      value: jobOpportunities,
      onChange: setJobOpportunities,
    },
    {
      title: 'Application updates',
      description: "Updates about the jobs you've applied",
      value: applicationUpdates,
      onChange: setApplicationUpdates,
    },
    {
      title: 'Your Content',
      description: 'Updates about your contributions',
      value: yourContent,
      onChange: setYourContent,
    },
    {
      title: 'Get the most out of Jobstreet',
      description: "Ensure you're getting the full benefits from jobstreet",
      value: jobstreetBenefits,
      onChange: setJobstreetBenefits,
    },
    {
      title: 'Advice and insights',
      description: 'Tips for your career',
      value: adviceInsights,
      onChange: setAdviceInsights,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Notification Items */}
        <View style={styles.notificationCard}>
          {notificationItems.map((item, index) => (
            <View key={index}>
              <View style={styles.notificationItem}>
                <View style={styles.notificationInfo}>
                  <Text style={styles.notificationTitle}>{item.title}</Text>
                  <Text style={styles.notificationDesc}>{item.description}</Text>
                </View>
                <Switch
                  value={item.value}
                  onValueChange={item.onChange}
                  trackColor={{ false: '#e5e7eb', true: '#3b82f6' }}
                  thumbColor={item.value ? '#fff' : '#fff'}
                />
              </View>
              {index < notificationItems.length - 1 && <View style={styles.divider} />}
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
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  notificationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  notificationInfo: { flex: 1, marginRight: 16 },
  notificationTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 4 },
  notificationDesc: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
});
