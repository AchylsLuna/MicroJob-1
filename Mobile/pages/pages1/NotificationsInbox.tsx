import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Navigation from '../../components/navigation';

type NotificationsInboxProps = {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  liveNotifications?: any[];
};

export default function NotificationsInbox({ activeTab = 'Messages', onTabPress, liveNotifications = [] }: NotificationsInboxProps) {
  const [notifications, setNotifications] = useState<any[]>([
    {
      id: 1,
      title: 'Application Sent',
      company: 'Applications for MRS companies',
      description: 'have entered for company review',
      time: '1 minutes ago',
    },
    {
      id: 2,
      title: 'Application Sent',
      company: 'Applications for MRS companies',
      description: 'have entered for company review',
      time: 'Application Details',
    },
    {
      id: 3,
      title: 'Application Sent',
      company: 'Applications for MRS companies',
      description: 'have entered for company review',
      time: '1 minutes ago',
    },
  ]);

  const handleClearNotification = (id: number) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  // merge live notifications (from socket)
  React.useEffect(() => {
    if (!liveNotifications || liveNotifications.length === 0) return;
    // map payloads to same shape used by this component
    const mapped = liveNotifications.map((n: any) => ({
      id: n.id || `${n.jobId}-${Date.now()}`,
      title: n.status ? `Application ${n.status}` : 'Application Update',
      company: n.jobTitle || 'Job',
      description: n.status ? `Your application was ${n.status}` : 'New application update',
      time: n.updatedAt || n.createdAt || 'Just now',
    }));
    setNotifications((prev) => [...mapped, ...prev]);
  }, [liveNotifications]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Notifications */}
        {notifications.length > 0 ? (
          <View style={styles.notificationsList}>
            {notifications.map(notification => (
              <View key={notification.id} style={styles.notificationCard}>
                <View style={styles.notificationContent}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>A</Text>
                  </View>
                  <View style={styles.textContent}>
                    <Text style={styles.notificationTitle}>{notification.title}</Text>
                    <Text style={styles.notificationCompany}>{notification.company}</Text>
                    <Text style={styles.notificationDescription}>{notification.description}</Text>
                    <Text style={styles.notificationTime}>{notification.time}</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.clearButton}
                  onPress={() => handleClearNotification(notification.id)}
                >
                  <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyText}>You're all caught up!</Text>
          </View>
        )}
      </ScrollView>

      <Navigation activeTab={activeTab} onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#1e3a5f',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 90,
  },
  notificationsList: {
    gap: 12,
  },
  notificationCard: {
    backgroundColor: '#3b5a85',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  notificationContent: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#c0c0c0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6b7280',
  },
  textContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  notificationCompany: {
    fontSize: 13,
    color: '#e5e7eb',
    marginBottom: 2,
  },
  notificationDescription: {
    fontSize: 12,
    color: '#d1dce6',
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 11,
    color: '#9ca3af',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
