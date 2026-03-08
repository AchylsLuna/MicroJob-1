import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { jobsAPI } from '../../services/jobs';
import { markAllNotificationsRead, deleteNotification } from '../../services/api';
import { ROUTES } from '../../utils/routes';
import { toast } from '../../lib/toast';

type EmployerNotif = {
  id: string;
  applicationId?: string;
  applicantName?: string;
  jobTitle?: string;
  time?: string;
  isNew?: boolean;
};

export default function EmployerNotifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<EmployerNotif[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await jobsAPI.getEmployerApplications();
      const apps = res.data || [];
      const notifs: EmployerNotif[] = apps
        .map((a: any) => ({
          id: a._id,
          applicationId: a._id,
          applicantName: `${a.applicant?.firstName || ''} ${a.applicant?.lastName || ''}`.trim(),
          jobTitle: a.job?.title,
          time: a.createdAt ? new Date(a.createdAt).toLocaleString() : undefined,
          isNew: !a.employerReadAt,
        }))
        .filter(Boolean)
        .sort((a: EmployerNotif, b: EmployerNotif) => (b.time || '').localeCompare(a.time || ''));

      setItems(notifs);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetch();
    // Also refresh the global notification count in NavBar 
    window.dispatchEvent(new Event('notification-refresh'));
  }, []);

  const markRead = async (applicationId?: string) => {
    if (!applicationId) return;
    try {
      await jobsAPI.markEmployerRead(applicationId);
      setItems((prev) => prev.map((i) => (i.applicationId === applicationId ? { ...i, isNew: false } : i)));
      // Refresh NavBar notification count
      window.dispatchEvent(new Event('notification-refresh'));
    } catch (err) {
      console.warn('mark employer read failed', err);
    }
  };

  const removeNotification = async (id: string) => {
    try {
      // Remove from UI immediately
      setItems((prev) => prev.filter((i) => i.id !== id));
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
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Employer Notifications</h1>
          <p className="text-sm text-gray-500">Recent applications to your job posts</p>
        </div>
        <div>
          <button onClick={async () => {
            await markAllNotificationsRead().catch(() => null);
            setItems((prev) => prev.map((i) => ({ ...i, isNew: false })));
            // Refresh NavBar notification count
            window.dispatchEvent(new Event('notification-refresh'));
          }} className="text-sm text-blue-600 font-semibold">Mark all as read</button>
        </div>
      </div>

      {loading && <div className="bg-white rounded-xl p-6 shadow-sm text-gray-600">Loading...</div>}
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 mb-4">{error}</div>}

      <div className="space-y-4">
        {items.map((it) => (
          <div key={it.id} className={`bg-white rounded-xl p-4 shadow-sm border ${it.isNew ? 'border-blue-100' : 'border-gray-100'}`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{it.applicantName || 'Someone applied'}</h3>
                <p className="text-xs text-gray-600 mt-1">Applied for: <span className="font-semibold">{it.jobTitle}</span></p>
                <p className="text-xs text-gray-400 mt-1">{it.time}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={() => removeNotification(it.id)}
                  className="text-gray-400 hover:text-red-600 transition-colors mb-2"
                  title="Remove notification"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex gap-2">
                  <button onClick={() => navigate(ROUTES.employer.applications)} className="text-sm text-blue-600 font-semibold">View</button>
                  <button onClick={() => markRead(it.applicationId)} className="text-sm text-gray-600">Mark read</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
