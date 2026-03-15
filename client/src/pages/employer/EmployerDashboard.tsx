import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle,
  Clock,
  MessageSquare,
  Users,
  XCircle,
} from "lucide-react";
import { getEmployerApplications } from "../../services/api";
import { toast } from "../../lib/toast";
import { ROUTES } from "../../utils/routes";

interface StatCardProps {
  icon: ReactNode;
  title: string;
  value: number | string;
  change?: string;
  gradient: string;
}

function StatCard({ icon, title, value, change, gradient }: StatCardProps) {
  return (
    <div
      className={`relative min-h-[184px] overflow-hidden rounded-[24px] p-6 text-white shadow-[0_12px_30px_rgba(28,77,141,0.25)] ${gradient}`}
    >
      <div className="absolute -right-14 -top-14 h-36 w-36 rounded-full bg-white/10" />
      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-4 flex items-start justify-between">
          <div className="rounded-[16px] bg-white/20 p-4 backdrop-blur-sm">{icon}</div>
          {change && (
            <div className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold">
              <ArrowUpRight className="h-3 w-3" />
              {change}
            </div>
          )}
        </div>
        <p className="text-sm text-white/90">{title}</p>
        <p className="mt-2 text-4xl font-bold leading-none">{value}</p>
      </div>
    </div>
  );
}

function PipelineRow({ label, count, colorClass }: { label: string; count: number; colorClass: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-[#334155]">{label}</span>
        <span className="text-sm font-semibold text-[#0F172A]">{count}</span>
      </div>
      <div className="h-2 rounded-full bg-[#E2E8F0]">
        <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${Math.min(100, count * 12)}%` }} />
      </div>
    </div>
  );
}

type Application = {
  _id: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  applicant?: { firstName?: string; lastName?: string };
  job?: { title?: string };
};

const formatRelativeTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};

const getActivityConfig = (status: string) => {
  switch (status) {
    case "Hired":
      return {
        icon: <CheckCircle className="h-4 w-4 text-[#10B981]" />,
        bg: "bg-[#D1FAE5]",
        label: (name: string, title: string) => (
          <p className="text-sm text-[#111827]">
            <span className="font-semibold">{name}</span> was hired for{" "}
            <span className="font-semibold">{title}</span>
          </p>
        ),
      };
    case "Rejected":
      return {
        icon: <XCircle className="h-4 w-4 text-[#EF4444]" />,
        bg: "bg-[#FEE2E2]",
        label: (name: string, title: string) => (
          <p className="text-sm text-[#111827]">
            <span className="font-semibold">{name}</span> was rejected for{" "}
            <span className="font-semibold">{title}</span>
          </p>
        ),
      };
    case "Shortlisted":
      return {
        icon: <Clock className="h-4 w-4 text-[#F59E0B]" />,
        bg: "bg-[#FEF3C7]",
        label: (name: string, title: string) => (
          <p className="text-sm text-[#111827]">
            <span className="font-semibold">{name}</span> shortlisted for{" "}
            <span className="font-semibold">{title}</span>
          </p>
        ),
      };
    case "Interviewed":
      return {
        icon: <MessageSquare className="h-4 w-4 text-[#3B82F6]" />,
        bg: "bg-[#DBEAFE]",
        label: (name: string, title: string) => (
          <p className="text-sm text-[#111827]">
            <span className="font-semibold">{name}</span> scheduled for interview —{" "}
            <span className="font-semibold">{title}</span>
          </p>
        ),
      };
    default:
      return {
        icon: <Users className="h-4 w-4 text-[#6366F1]" />,
        bg: "bg-[#EEF2FF]",
        label: (name: string, title: string) => (
          <p className="text-sm text-[#111827]">
            New application from <span className="font-semibold">{name}</span> for{" "}
            <span className="font-semibold">{title}</span>
          </p>
        ),
      };
  }
};

export function EmployerDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    shortlisted: 0,
    interviewed: 0,
    hired: 0,
    rejected: 0,
  });
  const [recentActivity, setRecentActivity] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Watch for account type changes and redirect if needed
  useEffect(() => {
    const handleAuthUpdate = () => {
      const stored = localStorage.getItem("auth_user");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.accountType === "worker") {
            navigate(ROUTES.worker.dashboard, { replace: true });
          }
        } catch (e) {
          console.error("Failed to parse auth_user:", e);
        }
      }
    };

    window.addEventListener("auth_user_updated", handleAuthUpdate);
    return () => window.removeEventListener("auth_user_updated", handleAuthUpdate);
  }, [navigate]);

  useEffect(() => {
    let isMounted = true;
    const loadApplications = async () => {
      setIsLoading(true);
      try {
        const applications = await getEmployerApplications();
        if (!isMounted) return;

        const list: Application[] = Array.isArray(applications) ? (applications as Application[]) : [];
        const total = list.length;
        const shortlisted = list.filter((app) => app.status === "Shortlisted").length;
        const interviewed = list.filter((app) => app.status === "Interviewed").length;
        const hired = list.filter((app) => app.status === "Hired").length;
        const rejected = list.filter((app) => app.status === "Rejected").length;

        const sorted = [...list].sort((a, b) => {
          const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        });
        setRecentActivity(sorted.slice(0, 5));
        setStats({ total, shortlisted, interviewed, hired, rejected });
      } catch (error: any) {
        if (!isMounted) return;
        toast.error(error?.message || "Failed to load applications.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadApplications();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="ui-page px-4 md:px-0 pb-16">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Users className="h-6 w-6" />}
          title="Total Applications"
          value={isLoading ? "—" : stats.total}
          change="+12%"
          gradient="bg-gradient-to-br from-[#4988C4] via-[#2F74B8] to-[#1C4D8D]"
        />
        <StatCard
          icon={<Clock className="h-6 w-6" />}
          title="Shortlisted"
          value={isLoading ? "—" : stats.shortlisted}
          change="+6%"
          gradient="bg-gradient-to-br from-[#1C4D8D] via-[#1A3F78] to-[#0F2954]"
        />
        <StatCard
          icon={<MessageSquare className="h-6 w-6" />}
          title="To Be Interview"
          value={isLoading ? "—" : stats.interviewed}
          change="+9%"
          gradient="bg-gradient-to-br from-[#4988C4] via-[#2F74B8] to-[#1C4D8D]"
        />
        <StatCard
          icon={<CheckCircle className="h-6 w-6" />}
          title="Hired"
          value={isLoading ? "—" : stats.hired}
          change="+4%"
          gradient="bg-gradient-to-br from-[#1C4D8D] via-[#1A3F78] to-[#0F2954]"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="ui-card rounded-[20px] border-[#E5EAF2] p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[#111827]">Candidate Pipeline</h3>
            <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-medium text-[#4F46E5]">
              Live Snapshot
            </span>
          </div>
          <div className="space-y-5">
            <PipelineRow label="Shortlisted" count={isLoading ? 0 : stats.shortlisted} colorClass="bg-[#F59E0B]" />
            <PipelineRow label="To Be Interview" count={isLoading ? 0 : stats.interviewed} colorClass="bg-[#3B82F6]" />
            <PipelineRow label="Hired" count={isLoading ? 0 : stats.hired} colorClass="bg-[#10B981]" />
            <PipelineRow label="Rejected" count={isLoading ? 0 : stats.rejected} colorClass="bg-[#EF4444]" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => navigate(ROUTES.employer.applications)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-4 text-sm font-semibold text-white hover:bg-[#4338CA]"
            >
              <Users className="h-4 w-4" />
              Manage Applications
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate(ROUTES.employer.jobs)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D5DCE8] bg-white px-4 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC]"
            >
              <BarChart3 className="h-4 w-4" />
              View All Jobs
            </button>
          </div>
        </div>

        <div className="ui-card rounded-[20px] border-[#E5EAF2] p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <h3 className="mb-5 text-lg font-semibold text-[#111827]">Quick Totals</h3>
          <div className="space-y-3">
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <p className="text-sm text-[#64748B]">Hired</p>
              <p className="mt-1 text-2xl font-semibold text-[#10B981]">{isLoading ? "—" : stats.hired}</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <p className="text-sm text-[#64748B]">Rejected</p>
              <p className="mt-1 text-2xl font-semibold text-[#EF4444]">{isLoading ? "—" : stats.rejected}</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <p className="text-sm text-[#64748B]">Total in Pipeline</p>
              <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{isLoading ? "—" : stats.total}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="ui-card rounded-[20px] border-[#E5EAF2] p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <h3 className="mb-5 text-lg font-semibold text-[#111827]">Recent Activity</h3>
        {isLoading ? (
          <p className="text-sm text-[#64748B]">Loading activity...</p>
        ) : recentActivity.length === 0 ? (
          <p className="text-sm text-[#64748B]">No recent activity yet.</p>
        ) : (
          <div className="space-y-4">
            {recentActivity.map((app, index) => {
              const name = [
                app.applicant?.firstName,
                app.applicant?.lastName,
              ]
                .filter(Boolean)
                .join(" ") || "Applicant";
              const jobTitle = app.job?.title || "a position";
              const config = getActivityConfig(app.status);
              const isLast = index === recentActivity.length - 1;
              return (
                <div
                  key={app._id}
                  className={`flex items-start gap-3 ${isLast ? "" : "border-b border-[#EEF2F7] pb-4"}`}
                >
                  <div className={`rounded-full ${config.bg} p-2 shrink-0`}>{config.icon}</div>
                  <div className="flex-1 min-w-0">
                    {config.label(name, jobTitle)}
                    <p className="mt-1 text-xs text-[#64748B]">
                      {formatRelativeTime(app.updatedAt || app.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
