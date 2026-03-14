import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Navigation from '../../components/navigation';
import { API_URL } from '../../config';
import { apiRequest } from '../../lib/api';
import { formatNotificationTime, normalizeNotificationItem, type NotificationListItem } from '../../lib/notifications';
import { tokens } from '../../theme/tokens';
import { useToast } from '../../contexts/ToastContext';
import { useAppSession } from '../../contexts/AppSessionContext';

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
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<NotificationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const toast = useToast();
  const session = useAppSession();

  const unreadCount = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications]);

  const mergeNotifications = (incoming: NotificationListItem[]) => {
    setNotifications((prev) => {
      const existingIds = new Set(prev.map((item) => item.id));
      const nextItems = incoming.filter((item) => item.id && !existingIds.has(item.id));
      if (nextItems.length === 0) return prev;
      return [...nextItems, ...prev].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
  };

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/notifications?limit=100`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }, 'Failed to load notifications.');
      if (!result.ok) {
        throw new Error(result.message || 'Failed to load notifications.');
      }

      const records = Array.isArray(result.raw) ? result.raw : [];
      const normalized = records.map((item: any) => normalizeNotificationItem(item));
      setNotifications(normalized);
      await session.refreshNotifications();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load notifications.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  useEffect(() => {
    if (!Array.isArray(liveNotifications) || liveNotifications.length === 0) return;
    mergeNotifications(liveNotifications.map((item) => normalizeNotificationItem(item)));
  }, [liveNotifications]);

  const handleMarkRead = async (notificationId: string) => {
    setProcessingId(notificationId);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }, 'Failed to mark notification as read.');
      if (!result.ok) {
        throw new Error(result.message || 'Failed to mark notification as read.');
      }

      const readAt = new Date().toISOString();
      setNotifications((prev) => prev.map((item) => (item.id === notificationId ? { ...item, readAt } : item)));
      onDismissLiveNotification?.(notificationId);
      await session.refreshNotifications();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to mark notification as read.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (notificationId: string) => {
    setProcessingId(notificationId);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }, 'Failed to delete notification.');
      if (!result.ok) {
        throw new Error(result.message || 'Failed to delete notification.');
      }

      setNotifications((prev) => prev.filter((item) => item.id !== notificationId));
      onDismissLiveNotification?.(notificationId);
      await session.refreshNotifications();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete notification.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setProcessingId('all-read');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/notifications/read-all`, {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }, 'Failed to mark notifications as read.');
      if (!result.ok) {
        throw new Error(result.message || 'Failed to mark notifications as read.');
      }

      const readAt = new Date().toISOString();
      setNotifications((prev) => prev.map((item) => ({ ...item, readAt })));
      await session.refreshNotifications();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to mark notifications as read.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleClearRead = async () => {
    setProcessingId('clear-read');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/notifications/read`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }, 'Failed to clear read notifications.');
      if (!result.ok) {
        throw new Error(result.message || 'Failed to clear read notifications.');
      }

      setNotifications((prev) => prev.filter((item) => !item.readAt));
      await session.refreshNotifications();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to clear read notifications.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 10 }]}>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>Applications, interviews, payouts, and support updates in one feed.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{notifications.length}</Text>
            <Text style={styles.summaryLabel}>Total updates</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{unreadCount}</Text>
            <Text style={styles.summaryLabel}>Unread</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.secondaryAction, processingId === 'all-read' && styles.disabledAction]}
            onPress={() => void handleMarkAllRead()}
            disabled={processingId !== null || unreadCount === 0}
          >
            <Text style={styles.secondaryActionText}>Mark All Read</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryAction, processingId === 'clear-read' && styles.disabledAction]}
            onPress={() => void handleClearRead()}
            disabled={processingId !== null || notifications.every((item) => !item.readAt)}
          >
            <Text style={styles.secondaryActionText}>Clear Read</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={tokens.colors.brand} />
            <Text style={styles.loadingText}>Loading your notification feed...</Text>
          </View>
        ) : null}

        {!isLoading && notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="notifications-off-outline" size={34} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>All quiet for now</Text>
            <Text style={styles.emptyText}>New job, interview, payout, and support updates will appear here.</Text>
          </View>
        ) : null}

        <View style={styles.listWrap}>
          {notifications.map((notification) => {
            const isUnread = !notification.readAt;
            const isBusy = processingId === notification.id;
            return (
              <View key={notification.id} style={[styles.notificationCard, isUnread && styles.notificationCardUnread]}>
                <View style={[styles.iconWrap, { backgroundColor: notification.accentBackground }]}> 
                  <Ionicons name={notification.icon} size={20} color={notification.accentColor} />
                </View>

                <View style={styles.notificationBody}>
                  <View style={styles.notificationTopRow}>
                    <Text style={styles.notificationTitle}>{notification.title}</Text>
                    <Text style={styles.notificationTime}>{formatNotificationTime(notification.createdAt)}</Text>
                  </View>
                  <Text style={styles.notificationMessage}>{notification.message}</Text>
                  {notification.actorName ? <Text style={styles.actorText}>From: {notification.actorName}</Text> : null}

                  <View style={styles.cardActionsRow}>
                    {isUnread ? (
                      <TouchableOpacity
                        style={[styles.inlineAction, isBusy && styles.disabledAction]}
                        onPress={() => void handleMarkRead(notification.id)}
                        disabled={processingId !== null}
                      >
                        <Text style={styles.inlineActionText}>Mark Read</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.inlineDeleteAction, isBusy && styles.disabledAction]}
                      onPress={() => void handleDelete(notification.id)}
                      disabled={processingId !== null}
                    >
                      <Text style={styles.inlineDeleteText}>{isBusy ? 'Working...' : 'Remove'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Navigation activeTab={activeTab} onTabPress={onTabPress} messageBadgeCount={messageBadgeCount} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },
  header: {
    backgroundColor: '#0a2847',
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: '#CBD5F0',
    fontWeight: '500',
    maxWidth: 310,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110,
    gap: 12,
  },
  summaryCard: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E0EA',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...tokens.shadow.card,
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5EAF2',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E0EA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  disabledAction: {
    opacity: 0.55,
  },
  loadingCard: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E0EA',
    paddingVertical: 26,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E0EA',
    paddingVertical: 34,
    paddingHorizontal: 20,
    alignItems: 'center',
    ...tokens.shadow.card,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EEF2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: '#64748B',
  },
  listWrap: {
    gap: 12,
  },
  notificationCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D9E0EA',
    backgroundColor: '#FFFFFF',
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    ...tokens.shadow.card,
  },
  notificationCardUnread: {
    borderColor: '#BFDBFE',
    backgroundColor: '#FDFEFF',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBody: {
    flex: 1,
    gap: 6,
  },
  notificationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  notificationTime: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: '#475569',
    fontWeight: '500',
  },
  actorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  cardActionsRow: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 10,
  },
  inlineAction: {
    minHeight: 36,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  inlineDeleteAction: {
    minHeight: 36,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineDeleteText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B91C1C',
  },
});
