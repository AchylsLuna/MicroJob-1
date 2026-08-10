import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle,
  Clock,
  MessageSquare,
  Plus,
  Users,
  XCircle,
} from "lucide-react";
import { getEmployerApplications, getMyJobs } from "../../services/api";
import { toast } from "../../lib/toast";
import { ROUTES } from "../../utils/routes";

interface StatCardProps {
  icon: ReactNode;
  title: string;
  value: number | string;
  helper: string;
  iconClass: string;
}

function StatCard({ icon, title, value, helper, iconClass }: StatCardProps) {
  return (
    <div className="ui-card flex min-h-[138px] flex-col justify-between rounded-2xl border-slate-200 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
          {icon}
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-400">{helper}</p>
    </div>
  );
}

function PipelineRow({
  label,
  count,
  total,
  colorClass,
}: {
  label: string;
  count: number;
  total: number;
  colorClass: string;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-[#334155]">{label}</span>
        <span className="text-sm font-semibold text-[#0F172A]">
          {count} <span className="font-normal text-slate-400">({percentage}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-[#E2E8F0]">
        <div className={`h-2 rounded-full transition-all ${colorClass}`} style={{ width: `${percentage}%` }} />
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
    case "Accepted":
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
        icon: <MessageSquare className="h-4 w-4 text-[#1C4D8D]" />,
        bg: "bg-[#1C4D8D]/10",
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
        bg: "bg-[#1C4D8D]/[0.06]",
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
    newApplications: 0,
    shortlisted: 0,
    interviewed: 0,
    hired: 0,
  });
  const [jobSummary, setJobSummary] = useState({ active: 0, total: 0 });
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
    const loadDashboard = async () => {
      setIsLoading(true);
      try {
        const [applications, jobs] = await Promise.all([
          getEmployerApplications(),
          getMyJobs(),
        ]);
        if (!isMounted) return;

        const list: Application[] = Array.isArray(applications) ? (applications as Application[]) : [];
        const jobList = Array.isArray(jobs) ? jobs : [];
        const total = list.length;
        const processedStatuses = ["Shortlisted", "Interviewed", "Hired", "Accepted", "Rejected"];
        const newApplications = list.filter((app) => !processedStatuses.includes(app.status)).length;
        const shortlisted = list.filter((app) => app.status === "Shortlisted").length;
        const interviewed = list.filter((app) => app.status === "Interviewed").length;
        const hired = list.filter((app) => app.status === "Hired" || app.status === "Accepted").length;
        const activeJobs = jobList.filter((job: any) =>
          job.status === "Available" || job.status === "In Progress"
        ).length;

        const sorted = [...list].sort((a, b) => {
          const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        });
        setRecentActivity(sorted.slice(0, 5));
        setStats({ total, newApplications, shortlisted, interviewed, hired });
        setJobSummary({ active: activeJobs, total: jobList.length });
      } catch (error: any) {
        if (!isMounted) return;
        toast.error(error?.message || "Failed to load the employer dashboard.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="ui-page px-4 md:px-0 pb-16">
      <div className="ui-page-header">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1C4D8D]">Employer workspace</p>
          <h1 className="ui-page-title mt-1">Hiring overview</h1>
          <p className="ui-page-subtitle">See what needs attention and move candidates forward.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(ROUTES.employer.jobs)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <BriefcaseBusiness className="h-4 w-4" />
            Manage jobs
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.employer.postJob)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1C4D8D] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#163F75]"
          >
            <Plus className="h-4 w-4" />
            Post a job
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<BriefcaseBusiness className="h-5 w-5" />}
          title="Active jobs"
          value={isLoading ? "—" : jobSummary.active}
          helper={isLoading ? "Loading job posts..." : `${jobSummary.total} Total job post${jobSummary.total === 1 ? "" : "s"}`}
          iconClass="bg-[#EAF2FC] text-[#1C4D8D]"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          title="Applications"
          value={isLoading ? "—" : stats.total}
          helper={isLoading ? "Loading candidates..." : `${stats.newApplications} Awaiting initial review`}
          iconClass="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          title="Shortlisted"
          value={isLoading ? "—" : stats.shortlisted}
          helper="Candidates ready for the next step"
          iconClass="bg-amber-50 text-amber-600"
        />
        <StatCard
          icon={<CheckCircle className="h-5 w-5" />}
          title="Hired"
          value={isLoading ? "—" : stats.hired}
          helper="Workers selected across your jobs"
          iconClass="bg-emerald-50 text-emerald-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
        <section className="ui-card rounded-2xl border-slate-200 p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Candidate pipeline</h2>
              <p className="mt-1 text-sm text-slate-500">Current application status across your jobs.</p>
            </div>
            <span className="rounded-full bg-[#EAF2FC] px-3 py-1 text-xs font-semibold text-[#1C4D8D]">
              {isLoading ? "—" : stats.total} total
            </span>
          </div>
          <div className="space-y-5">
            <PipelineRow label="New applications" count={isLoading ? 0 : stats.newApplications} total={stats.total} colorClass="bg-blue-500" />
            <PipelineRow label="Shortlisted" count={isLoading ? 0 : stats.shortlisted} total={stats.total} colorClass="bg-amber-500" />
            <PipelineRow label="Interviewing" count={isLoading ? 0 : stats.interviewed} total={stats.total} colorClass="bg-[#1C4D8D]" />
            <PipelineRow label="Hired" count={isLoading ? 0 : stats.hired} total={stats.total} colorClass="bg-emerald-500" />
          </div>

          <button
            type="button"
            onClick={() => navigate(ROUTES.employer.applications)}
            className="mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1C4D8D] px-4 text-sm font-semibold text-white transition hover:bg-[#163F75]"
          >
            Manage applications
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>

        <section className="ui-card rounded-2xl border-slate-200 p-6 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Recent activity</h2>
              <p className="mt-1 text-sm text-slate-500">Latest movement from your candidates.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(ROUTES.employer.applications)}
              className="shrink-0 text-sm font-semibold text-[#1C4D8D] transition hover:text-[#163F75]"
            >
              View all
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-4" aria-label="Loading recent activity">
              {[0, 1, 2].map((item) => (
                <div key={item} className="flex animate-pulse items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 rounded bg-slate-100" />
                    <div className="h-2.5 w-24 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
              <Users className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">No candidate activity yet</p>
              <p className="mt-1 text-xs text-slate-500">New applications and hiring updates will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((app, index) => {
                const name = [app.applicant?.firstName, app.applicant?.lastName]
                  .filter(Boolean)
                  .join(" ") || "Applicant";
                const jobTitle = app.job?.title || "a position";
                const config = getActivityConfig(app.status);
                const isLast = index === recentActivity.length - 1;

                return (
                  <div
                    key={app._id}
                    className={`flex items-start gap-3 ${isLast ? "" : "border-b border-slate-100 pb-4"}`}
                  >
                    <div className={`shrink-0 rounded-full ${config.bg} p-2`}>{config.icon}</div>
                    <div className="min-w-0 flex-1">
                      {config.label(name, jobTitle)}
                      <p className="mt-1 text-xs text-slate-400">
                        {formatRelativeTime(app.updatedAt || app.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
