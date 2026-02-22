import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobsAPI } from '../../services/jobs';
import { ROUTES } from '../../utils/routes';

type NotificationItem = {
  id: string;
  applicationId?: string;
  title: string;
  description?: string;
  time?: string;
  jobId?: string;
  isNew?: boolean;
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await jobsAPI.getUserApplications();
      const apps = res.data || [];
      const allowed = new Set(['Shortlisted', 'Terms', 'Hired']);
      const notifs: NotificationItem[] = apps
        .filter((a: any) => allowed.has(a.status) )
        .map((a: any) => ({
          id: a._id || `${a.job?._id || 'app'}-${Math.random()}`,
          applicationId: a._id,
          title: `Application ${a.status}`,
          description: `Your application for ${a.job?.title || 'a job'} is now ${a.status.toLowerCase()}.`,
          time: a.createdAt ? new Date(a.createdAt).toLocaleString() : undefined,
          jobId: a.job?._id,
          isNew: !a.applicantReadAt,
        }))
        .sort((x: NotificationItem, y: NotificationItem) => (y.time || '').localeCompare(x.time || ''));

      setNotifications(notifs);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markRead = async (applicationId?: string) => {
    if (!applicationId) return;
    try {
      await jobsAPI.markApplicantRead(applicationId);
      setNotifications((prev) => prev.map((n) => (n.applicationId === applicationId ? { ...n, isNew: false } : n)));
    } catch (err) {
      console.warn('Failed to mark read', err);
    }
  };

  const markAll = async () => {
    const unread = notifications.filter((n) => n.applicationId && n.isNew);
    await Promise.all(unread.map((n) => jobsAPI.markApplicantRead(n.applicationId!).catch(() => null)));
    setNotifications((prev) => prev.map((n) => ({ ...n, isNew: false })));
  };

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[20px] text-[#111827]">Notifications</h2>
          <p className="text-[14px] text-[#6B7280] mt-1">Recent updates about your applications</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={markAll} className="text-sm text-blue-600 font-semibold">Mark all as read</button>
          <button onClick={fetchNotifications} className="text-sm text-gray-600">Refresh</button>
        </div>
      </div>

      {loading && <div className="bg-white rounded-xl p-6 shadow-sm text-gray-600">Loading...</div>}
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">{error}</div>}

      <div className="space-y-4">
        {notifications.length === 0 && !loading && (
          <div className="bg-white rounded-xl p-6 shadow-sm text-center text-gray-600">No notifications.</div>
        )}

        {notifications.map((n) => (
          <div key={n.id} className={`bg-white rounded-xl p-4 shadow-sm border ${n.isNew ? 'border-blue-100' : 'border-gray-100'}`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{n.title} {n.isNew && <span className="ml-2 inline-block w-2 h-2 bg-blue-600 rounded-full" />}</h3>
                <p className="text-xs text-gray-600 mt-1">{n.description}</p>
                <p className="text-xs text-gray-400 mt-1">{n.time}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => n.jobId && navigate(ROUTES.worker.jobDetails(n.jobId))}
                    className="text-sm text-blue-600 font-semibold"
                  >
                    View Job
                  </button>
                  <button onClick={() => markRead(n.applicationId)} className="text-sm text-gray-600">Mark read</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
