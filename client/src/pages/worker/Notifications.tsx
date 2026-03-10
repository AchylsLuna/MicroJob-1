import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobsAPI } from '../../services/jobs';
import { markAllNotificationsRead, deleteNotification } from '../../services/api';
import { ROUTES } from '../../utils/routes';
import { MessageSquare, CheckCircle, Clock, X } from 'lucide-react';
import { toast } from '../../lib/toast';
import { useAuth } from '../../hooks/useAuth';

type NotificationType = 'application' | 'message' | 'payment';

type NotificationItem = {
  id: string;
  applicationId?: string;
  messageId?: string;
  transactionId?: string;
  type: NotificationType;
  title: string;
  description?: string;
  time?: string;
  jobId?: string;
  isNew?: boolean;
  icon?: any;
  color?: string;
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | NotificationType>('all');
  const normalizedRole = String(user?.role || '').toLowerCase();
  const isEmployerView =
    user?.accountType === 'employer' ||
    normalizedRole === 'employer' ||
    normalizedRole === 'doctor' ||
    normalizedRole === 'hire';

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const allNotifications: NotificationItem[] = [];

      // Fetch application notifications
      try {
        const res = isEmployerView
          ? await jobsAPI.getEmployerApplications()
          : await jobsAPI.getUserApplications();
        const apps = res.data || [];
        const appNotifs = apps
          .filter((a: any) => {
            if (isEmployerView) return true;
            return ['Shortlisted', 'Terms', 'Hired', 'Accepted'].includes(a.status);
          })
          .map((a: any) => {
            if (isEmployerView) {
              const applicantName = `${a.applicant?.firstName || ''} ${a.applicant?.lastName || ''}`.trim() || 'A candidate';
              const jobTitle = a.job?.title || 'your job post';
              const currentStatus = String(a.status || 'Applied');

              return {
                id: a._id || `${a.job?._id || 'app'}-${Math.random()}`,
                applicationId: a._id,
                type: 'application' as NotificationType,
                title: '📥 New Application',
                description: `${applicantName} applied for "${jobTitle}"${currentStatus ? ` • Status: ${currentStatus}` : ''}.`,
                time: a.createdAt ? new Date(a.createdAt).toLocaleString() : a.updatedAt ? new Date(a.updatedAt).toLocaleString() : undefined,
                jobId: a.job?._id,
                isNew: !a.employerReadAt,
                color: !a.employerReadAt ? 'bg-yellow-50 border-yellow-100' : 'bg-blue-50 border-blue-100',
              };
            }

            let title = `Application ${a.status}`;
            let description = `Your application for "${a.job?.title || 'a job'}" is now ${a.status.toLowerCase()}.`;
            let color = 'bg-blue-50 border-blue-100';
            
            if (a.status === 'Hired' || a.status === 'Accepted') {
              title = '🎉 Application Accepted!';
              description = `Great news! You've been accepted for the position: ${a.job?.title || 'a job'}`;
              color = 'bg-green-50 border-green-100';
            } else if (a.status === 'Shortlisted') {
              title = '⭐ Application Shortlisted';
              description = `Your application for "${a.job?.title || 'a job'}" has been shortlisted!`;
              color = 'bg-yellow-50 border-yellow-100';
            } else if (a.status === 'Terms') {
              title = '💼 Terms Offered';
              description = `Terms have been offered for ${a.job?.title || 'a job'}`;
              color = 'bg-purple-50 border-purple-100';
            }

            return {
              id: a._id || `${a.job?._id || 'app'}-${Math.random()}`,
              applicationId: a._id,
              type: 'application' as NotificationType,
              title,
              description,
              time: a.updatedAt ? new Date(a.updatedAt).toLocaleString() : a.createdAt ? new Date(a.createdAt).toLocaleString() : undefined,
              jobId: a.job?._id,
              isNew: !a.applicantReadAt,
              color,
            };
          });
        allNotifications.push(...appNotifs);
      } catch (err) {
        console.warn('Failed to fetch applications:', err);
      }


      // TODO: Add message notifications when API endpoint is available
      // TODO: Add payment notifications when API endpoint is available
      // Sort by time (newest first)
      allNotifications.sort((x, y) => {
        const timeX = new Date(x.time || 0).getTime();
        const timeY = new Date(y.time || 0).getTime();
        return timeY - timeX;
      });

      setNotifications(allNotifications);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load notifications');
      console.error('Notification fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Also refresh the global notification count in NavBar
    window.dispatchEvent(new Event('notification-refresh'));
  }, [isEmployerView]);

  const markRead = async (applicationId?: string) => {
    if (!applicationId) return;
    try {
      if (isEmployerView) {
        await jobsAPI.markEmployerRead(applicationId);
      } else {
        await jobsAPI.markApplicantRead(applicationId);
      }
      setNotifications((prev) => 
        prev.map((n) => (n.applicationId === applicationId ? { ...n, isNew: false } : n))
      );
      // Refresh NavBar notification count
      window.dispatchEvent(new Event('notification-refresh'));
    } catch (err) {
      console.warn('Failed to mark read', err);
      toast.error('Failed to mark as read');
    }
  };

  const markAll = async () => {
    const unread = notifications.filter((n) => n.applicationId && n.isNew);
    await Promise.all([
      ...unread.map((n) => 
        (isEmployerView
          ? jobsAPI.markEmployerRead(n.applicationId!)
          : jobsAPI.markApplicantRead(n.applicationId!)).catch(() => null)
      ),
      // Also mark all global notifications as read
      markAllNotificationsRead().catch(() => null)
    ]);
    setNotifications((prev) => prev.map((n) => ({ ...n, isNew: false })));
    toast.success('All notifications marked as read');
    // Refresh NavBar notification count
    window.dispatchEvent(new Event('notification-refresh'));
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
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-3">
          <button onClick={markAll} className="text-sm text-blue-600 font-semibold hover:text-blue-700">Mark all as read</button>
          <button onClick={fetchNotifications} className="text-sm text-gray-600 hover:text-gray-700">Refresh</button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setFilterType('all')}
          className={`px-4 py-2 border-b-2 font-medium text-sm ${
            filterType === 'all'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilterType('application')}
          className={`px-4 py-2 border-b-2 font-medium text-sm flex items-center gap-1 ${
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
          className={`px-4 py-2 border-b-2 font-medium text-sm flex items-center gap-1 ${
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
          className={`px-4 py-2 border-b-2 font-medium text-sm flex items-center gap-1 ${
            filterType === 'payment'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <span className="text-[16px] leading-none font-semibold">₱</span>
          Payments
        </button>
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
          <div key={n.id} className={`rounded-xl p-4 shadow-sm border ${n.color || 'bg-white border-gray-100'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {/* Icon based on notification type */}
                <div className={`mt-1 p-2 rounded-lg ${
                  n.type === 'application' ? 'bg-blue-100 text-blue-600' :
                  n.type === 'message' ? 'bg-indigo-100 text-indigo-600' :
                  n.type === 'payment' ? 'bg-emerald-100 text-emerald-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {n.type === 'application' && <CheckCircle className="w-5 h-5" />}
                  {n.type === 'message' && <MessageSquare className="w-5 h-5" />}
                  {n.type === 'payment' && <span className="text-[20px] leading-none font-semibold">₱</span>}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{n.title}</h3>
                    {n.isNew && <span className="inline-block w-2 h-2 bg-blue-600 rounded-full" />}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{n.description}</p>
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
                  {n.type === 'application' && n.jobId && (
                    <button
                      onClick={() =>
                        isEmployerView
                          ? navigate(ROUTES.employer.applications)
                          : n.jobId && navigate(ROUTES.worker.jobDetails(n.jobId))
                      }
                      className="text-sm text-blue-600 font-semibold hover:text-blue-700"
                    >
                      {isEmployerView ? 'View Application' : 'View Job'}
                    </button>
                  )}
                  {n.type === 'message' && (
                    <button
                      onClick={() => navigate(isEmployerView ? ROUTES.employer.messages : ROUTES.worker.messages)}
                      className="text-sm text-blue-600 font-semibold hover:text-blue-700"
                    >
                      View Message
                    </button>
                  )}
                  {n.type === 'payment' && (
                    <button
                      onClick={() => navigate(isEmployerView ? ROUTES.employer.eWallet : ROUTES.worker.eWallet)}
                      className="text-sm text-blue-600 font-semibold hover:text-blue-700"
                    >
                      View Payment
                    </button>
                  )}
                  {n.isNew && (
                    <button 
                      onClick={() => markRead(n.applicationId)} 
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
