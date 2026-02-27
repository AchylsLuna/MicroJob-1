import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Navigation from '../../components/navigation';
import { tokens } from '../../theme/tokens';

type NotificationsInboxProps = {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  liveNotifications?: any[];
  messageBadgeCount?: number;
};

export default function NotificationsInbox({
  activeTab = 'Home',
  onTabPress,
  liveNotifications = [],
  messageBadgeCount = 0,
}: NotificationsInboxProps) {
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {notifications.length > 0 ? (
          <View style={styles.notificationsList}>
            {notifications.map(notification => (
              <View key={notification.id} style={styles.notificationCard}>
                <View style={styles.notificationContent}>
                  <View style={styles.avatar}>
                    <Ionicons name="notifications-outline" size={18} color={tokens.colors.brand} />
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
                  <Ionicons name="close-outline" size={16} color="#B91C1C" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="notifications-off-outline" size={40} color={tokens.colors.textSubtle} />
            </View>
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyText}>You're all caught up!</Text>
          </View>
        )}
      </ScrollView>

      <Navigation activeTab={activeTab} onTabPress={onTabPress} messageBadgeCount={messageBadgeCount} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingTop: 54,
    paddingBottom: 14,
    backgroundColor: tokens.colors.background,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: tokens.colors.text,
    letterSpacing: -0.3,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 90,
  },
  notificationsList: {
    gap: 12,
  },
  notificationCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    ...tokens.shadow.card,
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
    backgroundColor: tokens.colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
    marginBottom: 4,
  },
  notificationCompany: {
    fontSize: 13,
    color: tokens.colors.textMuted,
    marginBottom: 2,
  },
  notificationDescription: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 11,
    color: tokens.colors.textSubtle,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: tokens.colors.textMuted,
  },
});
