import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  MessageSquare, 
  MoreVertical,
  MapPin,
  CalendarDays,
  TrendingUp,
  ArrowRight,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Trash2
} from "lucide-react";
import { changeJobStatus, deleteJob as apiDeleteJob, getMyJobs, reopenJob as apiReopenJob } from "../../services/api";
import { toast } from "../../lib/toast";
import { ROUTES } from "../../utils/routes";

interface JobPosting {
  id: string;
  backendStatus: "Available" | "In Progress" | "Completed" | "Cancelled" | "Closed";
  title: string;
  department: string;
  location: string;
  date: string;
  status: "Open" | "Hold" | "Closed";
  matchPercentage: number;
  matchQuality: "Strong Match" | "Good Match" | "Fair Match";
  salary: string;
  candidatesApplied: number;
  completedInterviews: number;
  tags: {
    workLocation: string;
    workType: string;
    positions: string;
  };
  createdBy: string;
}

export function JobsManagement() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [markingDoneJobId, setMarkingDoneJobId] = useState<string | null>(null);
  const [confirmDoneJob, setConfirmDoneJob] = useState<JobPosting | null>(null);
  const [confirmReopenJob, setConfirmReopenJob] = useState<JobPosting | null>(null);
  const [reopeningJobId, setReopeningJobId] = useState<string | null>(null);
  const [confirmDeleteJob, setConfirmDeleteJob] = useState<JobPosting | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const mapStatus = (status?: string): JobPosting["status"] => {
    switch (status) {
      case "Available":
        return "Open";
      case "In Progress":
        return "Hold";
      case "Completed":
      case "Cancelled":
      case "Closed":
        return "Closed";
      default:
        return "Open";
    }
  };

  const getMatchQuality = (percentage: number): JobPosting["matchQuality"] => {
    if (percentage >= 80) return "Strong Match";
    if (percentage >= 50) return "Good Match";
    return "Fair Match";
  };

  const formatDate = (value?: string) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  };

  const mapJob = (job: any): JobPosting => {
    const applicantsCount = Array.isArray(job.applicants) ? job.applicants.length : 0;
    const matchPercentage = Math.min(100, applicantsCount * 7 + 30);
    const workTypeLabel =
      job.jobType === "Part-time"
        ? "Part Time"
        : job.jobType === "Freelance"
        ? "Freelance"
        : job.jobType === "Remote"
        ? "Remote"
        : "Full Time";
    const workLocationLabel = job.jobType === "Remote" ? "Remote" : "On Site";

    return {
      id: job._id,
      backendStatus: (job.status || "Available") as JobPosting["backendStatus"],
      title: job.title || "Untitled Job",
      department: job.category?.name || "General",
      location: job.location || "Remote",
      date: formatDate(job.createdAt),
      status: mapStatus(job.status),
      matchPercentage,
      matchQuality: getMatchQuality(matchPercentage),
      salary: job.salary || "—",
      candidatesApplied: applicantsCount,
      completedInterviews: Math.max(0, Math.floor(applicantsCount / 3)),
      tags: {
        workLocation: workLocationLabel,
        workType: workTypeLabel,
        positions: `${job.positionsNeeded || 1} Position${(job.positionsNeeded || 1) > 1 ? 's' : ''}`,
      },
      createdBy: "You",
    };
  };

  const loadJobs = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getMyJobs();
      const mapped = Array.isArray(data) ? data.map(mapJob) : [];
      setJobs(mapped);
    } catch (error: any) {
      const message = error?.message || "Failed to load job postings.";
      setLoadError(message);
      toast.error(message);
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadJobs();
  }, []);

  const handleMarkJobDone = async (job: JobPosting) => {
    if (job.backendStatus === "Completed") {
      toast.info("This job is already marked as completed.");
      return;
    }

    setConfirmDoneJob(job);
  };

  const confirmMarkJobDone = async () => {
    if (!confirmDoneJob) return;

    setMarkingDoneJobId(confirmDoneJob.id);
    try {
      await changeJobStatus(confirmDoneJob.id, "Completed");
      toast.success("Job marked as done. Worker payouts were triggered automatically from escrow.");
      setConfirmDoneJob(null);
      await loadJobs();
    } catch (error: any) {
      toast.error(error?.message || "Failed to mark job as done.");
    } finally {
      setMarkingDoneJobId(null);
    }
  };

  const handleReopenJob = (job: JobPosting) => {
    if (job.backendStatus === "Available") {
      toast.info("This job is already open.");
      return;
    }
    if (job.backendStatus === "In Progress") {
      toast.info("Cannot reopen a job that is currently in progress.");
      return;
    }
    setConfirmReopenJob(job);
  };

  const confirmReopenJobFn = async () => {
    if (!confirmReopenJob) return;
    setReopeningJobId(confirmReopenJob.id);
    try {
      await apiReopenJob(confirmReopenJob.id);
      toast.success("Job reopened successfully. Workers can now apply again.");
      setConfirmReopenJob(null);
      await loadJobs();
    } catch (error: any) {
      toast.error(error?.message || "Failed to reopen job.");
    } finally {
      setReopeningJobId(null);
    }
  };

  const handleDeleteJob = (job: JobPosting) => {
    setConfirmDeleteJob(job);
  };

  const confirmDeleteJobFn = async () => {
    if (!confirmDeleteJob) return;
    setDeletingJobId(confirmDeleteJob.id);
    try {
      await apiDeleteJob(confirmDeleteJob.id);
      toast.success("Job deleted successfully.");
      setConfirmDeleteJob(null);
      await loadJobs();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete job.");
    } finally {
      setDeletingJobId(null);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Open":
        return "bg-green-100 text-green-700";
      case "Hold":
        return "bg-gray-100 text-gray-700";
      case "Closed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getMatchColor = (percentage: number) => {
    if (percentage >= 80) return "text-blue-600";
    if (percentage >= 50) return "text-purple-600";
    return "text-orange-600";
  };

  return (
    <div className="ui-page px-4 md:px-0 pb-16">
      <div className="ui-page-header">
        <div>
          <h1 className="ui-page-title">Jobs Management</h1>
          <p className="ui-page-subtitle">
            Track job postings, candidate matches, and hiring progress.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate(ROUTES.employer.applications)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Users className="w-4 h-4" />
            View Applications
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading && (
          <div className="ui-card p-6">
            <p className="text-sm text-slate-500">Loading job postings...</p>
          </div>
        )}
        {loadError && !isLoading && (
          <div className="ui-card p-6">
            <p className="text-sm text-slate-500">{loadError}</p>
          </div>
        )}
        {!isLoading && !loadError && jobs.map((job) => (
          <div
            key={job.id}
            className="ui-card p-6 transition-all hover:shadow-lg"
          >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(job.status)}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      {job.status}
                    </span>
                    <span className="text-xs text-slate-500">{job.department}</span>
                  </div>
                  <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {/* Job Title */}
                <div className="mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-base">⚛</span>
                    </div>
                    <div>
                      <h3 className="mb-1 text-base font-semibold text-slate-900">{job.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {job.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {job.date}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Match Percentage */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
                  <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="#E5E7EB"
                        strokeWidth="6"
                        fill="none"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke={job.matchPercentage >= 80 ? "#3B82F6" : job.matchPercentage >= 50 ? "#A855F7" : "#F59E0B"}
                        strokeWidth="6"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 28}`}
                        strokeDashoffset={`${2 * Math.PI * 28 * (1 - job.matchPercentage / 100)}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-sm font-bold ${getMatchColor(job.matchPercentage)}`}>
                        {job.matchPercentage}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{job.matchQuality}</p>
                    <p className="text-xs text-slate-500">Match quality</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-3 mb-4 pb-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-slate-600">
                      <TrendingUp className="w-4 h-4 text-[#9CA3AF]" />
                      Salary
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{job.salary}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-slate-600">
                      <Users className="w-4 h-4 text-[#9CA3AF]" />
                      Candidates Applied
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{job.candidatesApplied}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-slate-600">
                      <MessageSquare className="w-4 h-4 text-[#9CA3AF]" />
                      Completed Interview
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{job.completedInterviews}</span>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="rounded px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700">
                    {job.tags.workLocation}
                  </span>
                  <span className="rounded px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700">
                    {job.tags.workType}
                  </span>
                  <span className="rounded px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700">
                    {job.tags.positions}
                  </span>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm text-slate-500">
                    Created by <span className="font-semibold text-slate-900">{job.createdBy}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {job.status === "Closed" && (
                      <button
                        onClick={() => void handleReopenJob(job)}
                        disabled={reopeningJobId === job.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-1.5 text-xs font-semibold text-[#15803D] disabled:opacity-60"
                        title="Reopen this job so workers can apply again"
                      >
                        {reopeningJobId === job.id ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" />Reopening...</>
                        ) : (
                          <><RefreshCw className="w-3.5 h-3.5" />Reopen</>  
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => void handleMarkJobDone(job)}
                      disabled={job.status === "Closed" || markingDoneJobId === job.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] disabled:opacity-60"
                      title="Mark done and auto-pay workers from escrow"
                    >
                      {markingDoneJobId === job.id ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" />Marking...</>
                      ) : (
                        <><CheckCircle2 className="w-3.5 h-3.5" />Mark as Done</>
                      )}
                    </button>
                    <button
                      onClick={() => void handleDeleteJob(job)}
                      disabled={deletingJobId === job.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-1.5 text-xs font-semibold text-[#B91C1C] disabled:opacity-60"
                      title="Delete this job"
                    >
                      {deletingJobId === job.id ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" />Deleting...</>
                      ) : (
                        <><Trash2 className="w-3.5 h-3.5" />Delete</>
                      )}
                    </button>
                    <button
                      onClick={() => navigate(ROUTES.employer.applications)}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-[#1C4D8D] hover:text-[#0F2954]"
                    >
                      View details
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-[#64748B]">
                  Completing the job automatically releases escrow to hired workers' e-wallets.
                </p>
          </div>
        ))}
        {!isLoading && !loadError && jobs.length === 0 && (
          <div className="ui-card p-6">
            <p className="text-sm text-slate-500">No job postings found.</p>
          </div>
        )}
      </div>

      {confirmDoneJob ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Mark Job as Done</h3>
            <p className="mt-2 text-sm text-slate-600">
              You are about to complete <span className="font-semibold text-slate-900">{confirmDoneJob.title}</span>.
            </p>
            <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700 border border-blue-100">
              Once completed, escrow funds are automatically released to hired workers' e-wallets.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDoneJob(null)}
                disabled={markingDoneJobId === confirmDoneJob.id}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmMarkJobDone()}
                disabled={markingDoneJobId === confirmDoneJob.id}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1C4D8D] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {markingDoneJobId === confirmDoneJob.id ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Marking...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" />Confirm Done</>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmReopenJob ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Reopen Job</h3>
            <p className="mt-2 text-sm text-slate-600">
              You are about to reopen <span className="font-semibold text-slate-900">{confirmReopenJob.title}</span>.
            </p>
            <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700 border border-green-100">
              {confirmReopenJob.backendStatus === "Completed" || confirmReopenJob.backendStatus === "Cancelled"
                ? "Reopening will re-collect the escrow from your employer balance. Workers will be able to apply again."
                : "The job will be set back to open and workers will be able to apply again."}
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReopenJob(null)}
                disabled={reopeningJobId === confirmReopenJob.id}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmReopenJobFn()}
                disabled={reopeningJobId === confirmReopenJob.id}
                className="inline-flex items-center gap-2 rounded-lg bg-[#15803D] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {reopeningJobId === confirmReopenJob.id ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Reopening...</>
                ) : (
                  <><RefreshCw className="h-4 w-4" />Reopen Job</>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDeleteJob ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Delete Job</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete <span className="font-semibold text-slate-900">{confirmDeleteJob.title}</span>? This action cannot be undone.
            </p>
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-100">
              All applications for this job will also be removed. Any unspent escrow will be refunded to your employer balance.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteJob(null)}
                disabled={deletingJobId === confirmDeleteJob.id}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteJobFn()}
                disabled={deletingJobId === confirmDeleteJob.id}
                className="inline-flex items-center gap-2 rounded-lg bg-[#B91C1C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deletingJobId === confirmDeleteJob.id ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Deleting...</>
                ) : (
                  <><Trash2 className="h-4 w-4" />Delete Job</>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
