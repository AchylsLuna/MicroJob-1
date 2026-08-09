import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import AsyncStorage from '../../lib/storage';
import { Ionicons } from '@expo/vector-icons';
import EmployerNavigation from '../../components/employerNavigation';
import ScrollView from '../../components/ui/SmoothScrollView';
import TabTopNav from '../../components/TabTopNav';
import { API_URL } from '../../config';
import { apiRequest } from '../../lib/api';
import { formatNotificationTime, normalizeNotificationItem, type NotificationListItem } from '../../lib/notifications';
import { tokens } from '../../theme/tokens';
import { useToast } from '../../contexts/ToastContext';
import { useAppSession } from '../../contexts/AppSessionContext';

type EmployerNotificationsProps = {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  liveNotifications?: any[];
};

export default function EmployerNotifications({
  activeTab = 'Notifications',
  onTabPress,
  liveNotifications = [],
}: EmployerNotificationsProps) {
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

  const loadNotifications = useCallback(async () => {
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
  }, [session, toast]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

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

  return (
    <View style={styles.container}>
      <TabTopNav title="Notifications" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>Team activity feed</Text>
            <Text style={styles.summarySubtitle}>Track new applications, support updates, payout actions, and account alerts without leaving mobile.</Text>
          </View>
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryBadgeValue}>{unreadCount}</Text>
            <Text style={styles.summaryBadgeLabel}>Unread</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.markAllButton, (processingId !== null || unreadCount === 0) && styles.disabledAction]}
          onPress={() => void handleMarkAllRead()}
          disabled={processingId !== null || unreadCount === 0}
        >
          <Text style={styles.markAllButtonText}>Mark All Read</Text>
        </TouchableOpacity>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={tokens.colors.brand} />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : null}

        {!isLoading && notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="notifications-off-outline" size={34} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No alerts yet</Text>
            <Text style={styles.emptyText}>New applications and employer updates will appear here.</Text>
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

      <EmployerNavigation activeTab={activeTab} onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 112,
    gap: 12,
  },
  summaryCard: {
    borderRadius: 24,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 18,
    flexDirection: 'row',
    gap: 14,
    ...tokens.shadow.card,
  },
  summaryCopy: {
    flex: 1,
    gap: 6,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: tokens.colors.text,
  },
  summarySubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryBadge: {
    width: 88,
    borderRadius: 18,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  summaryBadgeValue: {
    fontSize: 24,
    fontWeight: '800',
    color: tokens.colors.brand,
  },
  summaryBadgeLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.brand,
  },
  markAllButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: tokens.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.surface,
  },
  disabledAction: {
    opacity: 0.55,
  },
  loadingCard: {
    borderRadius: 20,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
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
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
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
    color: tokens.colors.text,
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
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
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
    color: tokens.colors.text,
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
    color: tokens.colors.brand,
  },
  cardActionsRow: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  inlineAction: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: tokens.colors.brand,
  },
  inlineDeleteAction: {
    minHeight: 44,
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
