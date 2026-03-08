import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Navigation from '../../components/navigation';
import { tokens } from '../../theme/tokens';

type NotificationsInboxProps = {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  liveNotifications?: any[];
  messageBadgeCount?: number;
  onDismissLiveNotification?: (notificationId: string) => void;
};

export default function NotificationsInbox({
  activeTab = 'Home',
  onTabPress,
  liveNotifications = [],
  messageBadgeCount = 0,
  onDismissLiveNotification,
}: NotificationsInboxProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const dismissedIdsRef = useRef<Set<string>>(new Set());

  const getNotificationId = (item: any): string =>
    String(item?.id || item?.applicationId || item?._id || `${item?.jobId || 'job'}-${item?.updatedAt || item?.createdAt || Date.now()}`);

  const normalizeNotification = (item: any) => {
    const statusText = item?.status || 'updated';
    return {
      id: getNotificationId(item),
      title: item?.status ? `Application ${statusText}` : 'Application Update',
      company: item?.jobTitle || item?.company || 'Job',
      description: item?.status ? `Your application is ${statusText}` : 'New application update',
      time: item?.updatedAt || item?.createdAt || 'Just now',
    };
  };

  const handleClearNotification = (id: string) => {
    dismissedIdsRef.current.add(id);
    setNotifications((prev) => prev.filter((n) => String(n.id) !== id));
    onDismissLiveNotification?.(id);
  };

  // merge live notifications (from socket)
  React.useEffect(() => {
    if (!liveNotifications || liveNotifications.length === 0) return;
    setNotifications((prev) => {
      const seen = new Set(prev.map((n) => String(n.id)));
      const mapped = liveNotifications
        .map((n: any) => normalizeNotification(n))
        .filter((n: any) => !dismissedIdsRef.current.has(String(n.id)) && !seen.has(String(n.id)));

      if (mapped.length === 0) return prev;
      return [...mapped, ...prev];
    });
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
                  onPress={() => handleClearNotification(String(notification.id))}
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
