import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
/* eslint-disable react-refresh/only-export-components */
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import {
  deleteNotification as deleteNotificationApi,
  deleteReadNotifications,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  type NotificationMode,
} from '../services/api';

type NotificationRecord = Record<string, any> & { _id?: string; id?: string; readAt?: string | null; audience?: string };
type NotificationContextValue = {
  notifications: NotificationRecord[];
  unreadCount: number;
  loading: boolean;
  stale: boolean;
  error: string | null;
  mode: NotificationMode;
  refresh: () => Promise<void>;
  setRead: (id: string, read: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);
const idOf = (item: NotificationRecord) => String(item?._id || item?.id || '');
const socketUrl = (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_PROXY_TARGET || window.location.origin)
  .replace(/\/api\/?$/, '')
  .replace(/\/$/, '');

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const mode: NotificationMode = user?.accountType === 'employer' ? 'employer' : 'worker';
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const notificationIdsRef = useRef(new Set<string>());

  useEffect(() => {
    setNotifications([]);
    setUnreadCount(0);
    setError(null);
    setStale(false);
    notificationIdsRef.current.clear();
  }, [mode, user?.id]);

  const refresh = useCallback(async () => {
    if (!user || user.role === 'admin') {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    try {
      const payload = await getNotifications({ mode, limit: 100 });
      setNotifications(Array.isArray(payload?.notifications) ? payload.notifications : []);
      notificationIdsRef.current = new Set((payload?.notifications || []).map(idOf).filter(Boolean));
      setUnreadCount(Math.max(0, Number(payload?.unreadCount || 0)));
      setError(null);
      setStale(false);
    } catch (caught: any) {
      setError(caught?.message || 'Failed to load notifications.');
      setStale(true);
    } finally {
      setLoading(false);
    }
  }, [mode, user]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    if (!user || user.role === 'admin') return;
    const socket = io(socketUrl, { withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => { void refresh(); });
    socket.on('notification_created', (payload: any) => {
      const notification = payload?.notification || payload;
      const id = idOf(notification);
      const audience = String(notification?.audience || 'shared');
      if (!id || ![mode, 'shared'].includes(audience)) return;
      const isNew = !notificationIdsRef.current.has(id);
      notificationIdsRef.current.add(id);
      setNotifications((current) => [notification, ...current.filter((item) => idOf(item) !== id)]);
      if (isNew && !notification.readAt) setUnreadCount((count) => count + 1);
    });
    socket.on('notification_changed', () => { void refresh(); });
    return () => { socket.disconnect(); if (socketRef.current === socket) socketRef.current = null; };
  }, [mode, refresh, user]);

  const setRead = useCallback(async (id: string, read: boolean) => {
    const previous = notifications;
    const nextReadAt = read ? new Date().toISOString() : null;
    setNotifications((items) => items.map((item) => idOf(item) === id ? { ...item, readAt: nextReadAt } : item));
    setUnreadCount((count) => Math.max(0, count + (read ? -1 : 1)));
    try {
      if (read) await markNotificationRead(id, mode); else await markNotificationUnread(id, mode);
    } catch (error) {
      setNotifications(previous);
      await refresh();
      throw error;
    }
  }, [mode, notifications, refresh]);

  const remove = useCallback(async (id: string) => {
    const target = notifications.find((item) => idOf(item) === id);
    setNotifications((items) => items.filter((item) => idOf(item) !== id));
    if (target && !target.readAt) setUnreadCount((count) => Math.max(0, count - 1));
    try { await deleteNotificationApi(id, mode); }
    catch (error) { await refresh(); throw error; }
  }, [mode, notifications, refresh]);

  const markAllRead = useCallback(async () => {
    const readAt = new Date().toISOString();
    setNotifications((items) => items.map((item) => ({ ...item, readAt })));
    setUnreadCount(0);
    try { await markAllNotificationsRead(mode); }
    catch (error) { await refresh(); throw error; }
  }, [mode, refresh]);

  const clearRead = useCallback(async () => {
    setNotifications((items) => items.filter((item) => !item.readAt));
    try { await deleteReadNotifications(mode); }
    catch (error) { await refresh(); throw error; }
  }, [mode, refresh]);

  const value = useMemo(() => ({ notifications, unreadCount, loading, stale, error, mode, refresh, setRead, remove, markAllRead, clearRead }),
    [notifications, unreadCount, loading, stale, error, mode, refresh, setRead, remove, markAllRead, clearRead]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('useNotifications must be used within NotificationProvider');
  return value;
}
