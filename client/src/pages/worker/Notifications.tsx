import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageSquare, CheckCircle, Clock, X } from 'lucide-react';
import { deleteNotification, getNotifications, markAllNotificationsRead, markNotificationRead } from '../../services/api';
import { toast } from '../../lib/toast';
import { useAuth } from '../../hooks/useAuth';
import { mapNotificationRecord, type FeedNotification, type NotificationFeedType } from '../../utils/notificationFeed';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | NotificationFeedType>('all');
  const normalizedRole = String(user?.role || '').toLowerCase();
  const isEmployerView =
    user?.accountType === 'employer' ||
    normalizedRole === 'employer' ||
    normalizedRole === 'doctor' ||
    normalizedRole === 'hire';
  const notificationAudience: 'admin' | 'employer' | 'worker' =
    normalizedRole === 'admin' || normalizedRole === 'superadmin'
      ? 'admin'
      : isEmployerView
      ? 'employer'
      : 'worker';

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getNotifications({ limit: 100 });
      const nextNotifications = (Array.isArray(data) ? data : [])
        .map((item: any) => mapNotificationRecord(item, notificationAudience, 'full'))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setNotifications(nextNotifications);
    } catch (err: any) {
      setError(err?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [notificationAudience, user]);

  useEffect(() => {
    fetchNotifications();
    // Also refresh the global notification count in NavBar
    window.dispatchEvent(new Event('notification-refresh'));
  }, [fetchNotifications, notificationAudience]);

  const markRead = async (notificationId: string) => {
    try {
      await markNotificationRead(notificationId);
      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
      // Refresh NavBar notification count
      window.dispatchEvent(new Event('notification-refresh'));
    } catch (err) {
      console.warn('Failed to mark read', err);
      toast.error('Failed to mark as read');
    }
  };

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success('All notifications marked as read');
      window.dispatchEvent(new Event('notification-refresh'));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to mark all as read');
    }
  };

  const removeNotification = async (id: string) => {
    try {
      // Remove from UI immediately
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      // Try to delete from server (if it's a global notification)
      await deleteNotification(id).catch(() => null);
      // Refresh NavBar notification count
      window.dispatchEvent(new Event('notification-refresh'));
      toast.success('Notification removed');
    } catch (err) {
      console.warn('Failed to remove notification', err);
      toast.error('Failed to remove notification');
    }
  };

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`-mb-px px-4 py-2 border-b-2 font-medium text-sm ${
              filterType === 'all'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('application')}
            className={`-mb-px px-4 py-2 border-b-2 font-medium text-sm inline-flex items-center gap-1 ${
              filterType === 'application'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            Applications
          </button>
          <button
            onClick={() => setFilterType('message')}
            className={`-mb-px px-4 py-2 border-b-2 font-medium text-sm inline-flex items-center gap-1 ${
              filterType === 'message'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Messages
          </button>
          <button
            onClick={() => setFilterType('payment')}
            className={`-mb-px px-4 py-2 border-b-2 font-medium text-sm inline-flex items-center gap-1 ${
              filterType === 'payment'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="text-[16px] leading-none font-semibold">₱</span>
            Payments
          </button>
          <button
            onClick={() => setFilterType('update')}
            className={`-mb-px px-4 py-2 border-b-2 font-medium text-sm inline-flex items-center gap-1 ${
              filterType === 'update'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Bell className="w-4 h-4" />
            Updates
          </button>
        </div>

        <div className="flex items-center gap-2 pb-2">
          <button
            onClick={markAll}
            className="inline-flex h-10 items-center rounded-lg px-2 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
          >
            Mark all as read
          </button>
          <button
            onClick={fetchNotifications}
            className="inline-flex h-10 items-center rounded-lg px-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && <div className="bg-white rounded-xl p-6 shadow-sm text-gray-600">Loading...</div>}
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">{error}</div>}

      <div className="space-y-4">
        {notifications.length === 0 && !loading && (
          <div className="bg-white rounded-xl p-6 shadow-sm text-center text-gray-600">No notifications.</div>
        )}

        {notifications
          .filter((n) => filterType === 'all' || n.type === filterType)
          .map((n) => (
          <div key={n.id} className={`rounded-xl p-4 shadow-sm border ${!n.read ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {/* Icon based on notification type */}
                <div className={`mt-1 p-2 rounded-lg ${
                  n.type === 'application' ? 'bg-blue-100 text-blue-600' :
                  n.type === 'message' ? 'bg-indigo-100 text-indigo-600' :
                  n.type === 'payment' ? 'bg-emerald-100 text-emerald-600' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {n.type === 'application' && <CheckCircle className="w-5 h-5" />}
                  {n.type === 'message' && <MessageSquare className="w-5 h-5" />}
                  {n.type === 'payment' && <span className="text-[20px] leading-none font-semibold">₱</span>}
                  {n.type === 'update' && <Bell className="w-5 h-5" />}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{n.title}</h3>
                    {!n.read && <span className="inline-block w-2 h-2 bg-blue-600 rounded-full" />}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {n.time}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col items-end gap-2 ml-4">
                <button
                  onClick={() => removeNotification(n.id)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                  title="Remove notification"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(n.link)}
                    className="text-sm text-blue-600 font-semibold hover:text-blue-700"
                  >
                    {n.type === 'application'
                      ? isEmployerView
                        ? 'View Pipeline'
                        : 'View Applications'
                      : n.type === 'message'
                      ? 'View Messages'
                      : n.type === 'payment'
                      ? 'View Wallet'
                      : 'Open'}
                  </button>
                  {!n.read && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="text-sm text-gray-600 hover:text-gray-700"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
