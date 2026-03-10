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
    <div className="ui-page px-4 md:px-0 pb-16">
      <div className="flex justify-end">
        <button
          onClick={async () => {
            await markAllNotificationsRead().catch(() => null);
            setItems((prev) => prev.map((i) => ({ ...i, isNew: false })));
            window.dispatchEvent(new Event('notification-refresh'));
          }}
          className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-sky-700 hover:bg-slate-50"
        >
          Mark all as read
        </button>
      </div>

      {loading && <div className="ui-card p-6 text-sm text-slate-500">Loading...</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {items.length === 0 && !loading && !error ? (
        <div className="ui-card p-10 text-center">
          <p className="text-base font-semibold text-slate-700">No notifications yet</p>
          <p className="mt-1 text-sm text-slate-500">You will see new applications here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((it) => (
            <div
              key={it.id}
              className={`ui-card p-4 ${it.isNew ? 'border-sky-200' : 'border-slate-200'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{it.applicantName || 'Someone applied'}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Applied for: <span className="font-semibold">{it.jobTitle}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{it.time}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => removeNotification(it.id)}
                    className="mb-1 text-slate-400 transition-colors hover:text-red-600"
                    title="Remove notification"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(ROUTES.employer.applications)}
                      className="h-9 rounded-lg bg-sky-600 px-3 text-sm font-semibold text-white hover:bg-sky-700"
                    >
                      View
                    </button>
                    <button
                      onClick={() => markRead(it.applicationId)}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Mark read
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
