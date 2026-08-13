import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '../lib/storage';
import { API_URL } from '../config';
import { apiRequest, asList, asObject } from '../lib/api';
import { normalizeNotificationItem, type NotificationListItem } from '../lib/notifications';
import { useAppSession } from '../contexts/AppSessionContext';
import { useToast } from '../contexts/ToastContext';

export default function useNotificationFeed(liveNotifications: any[] = [], onDismiss?: (id: string) => void) {
  const [notifications, setNotifications] = useState<NotificationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { refreshNotifications, viewMode } = useAppSession();
  const toast = useToast();

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/notifications?mode=${viewMode}&limit=100`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }, 'Failed to load notifications.');
      if (!result.ok) throw new Error(result.message || 'Failed to load notifications.');
      const payload = asObject<any>(result.raw) || {};
      const records = asList<any>(payload, ['notifications']);
      setNotifications(records.map(normalizeNotificationItem));
      await refreshNotifications();
    } catch (caught: any) {
      const message = caught?.message || 'Failed to load notifications.';
      setError(message);
      if (asRefresh) toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshNotifications, toast, viewMode]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!liveNotifications.length) return;
    const incoming = liveNotifications.map(normalizeNotificationItem);
    setNotifications((current) => {
      const merged = new Map(current.map((item) => [item.id, item]));
      incoming.forEach((item) => merged.set(item.id, item));
      return [...merged.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
  }, [liveNotifications]);

  const setRead = async (item: NotificationListItem, read: boolean) => {
    const previousReadAt = item.readAt;
    const nextReadAt = read ? new Date().toISOString() : null;
    setNotifications((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: nextReadAt } : entry));
    setProcessingId(item.id);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/notifications/${item.id}/${read ? 'read' : 'unread'}?mode=${viewMode}`, {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }, `Failed to mark notification as ${read ? 'read' : 'unread'}.`);
      if (!result.ok) throw new Error(result.message || 'Failed to update notification.');
      if (read) onDismiss?.(item.id);
      await refreshNotifications();
    } catch (caught: any) {
      setNotifications((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: previousReadAt } : entry));
      toast.error(caught?.message || 'Failed to update notification.');
    } finally {
      setProcessingId(null);
    }
  };

  const remove = async (item: NotificationListItem) => {
    setProcessingId(item.id);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/notifications/${item.id}?mode=${viewMode}`, {
        method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }, 'Failed to remove notification.');
      if (!result.ok) throw new Error(result.message || 'Failed to remove notification.');
      setNotifications((current) => current.filter((entry) => entry.id !== item.id));
      onDismiss?.(item.id);
      await refreshNotifications();
    } catch (caught: any) {
      toast.error(caught?.message || 'Failed to remove notification.');
    } finally { setProcessingId(null); }
  };

  const markAllRead = async () => {
    setProcessingId('all-read');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/notifications/read-all?mode=${viewMode}`, {
        method: 'PATCH', headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }, 'Failed to mark all notifications as read.');
      if (!result.ok) throw new Error(result.message || 'Failed to mark all notifications as read.');
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, readAt })));
      await refreshNotifications();
    } catch (caught: any) { toast.error(caught?.message || 'Failed to mark all notifications as read.'); }
    finally { setProcessingId(null); }
  };

  const clearRead = async () => {
    setProcessingId('clear-read');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/notifications/read?mode=${viewMode}`, {
        method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }, 'Failed to clear read notifications.');
      if (!result.ok) throw new Error(result.message || 'Failed to clear read notifications.');
      setNotifications((current) => current.filter((item) => !item.readAt));
      await refreshNotifications();
    } catch (caught: any) { toast.error(caught?.message || 'Failed to clear read notifications.'); }
    finally { setProcessingId(null); }
  };

  return { notifications, loading, refreshing, error, processingId, load, setRead, remove, markAllRead, clearRead };
}
