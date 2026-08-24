import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Users,
  MapPin,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Pencil,
  X
} from "lucide-react";
import { changeJobStatus, deleteJob as apiDeleteJob, getMyJobs, reopenJob as apiReopenJob, getEmployerApplications } from "../../services/api";
import { toast } from "../../lib/toast";
import { ROUTES } from "../../utils/routes";
import { formatCurrency, formatDate } from "../../lib/formatters";
import { Badge } from "../../components/ui";

interface JobPosting {
  id: string;
  backendStatus: "Available" | "In Progress" | "Completed" | "Cancelled" | "Closed";
  title: string;
  department: string;
  location: string;
  createdAt?: string;
  status: "Open" | "Hold" | "Closed";
  matchPercentage: number;
  matchQuality: "Strong Match" | "Good Match" | "Fair Match";
  salaryAmount: number;
  candidatesApplied: number;
  completedInterviews: number;
  workLocation: "Remote" | "On Site";
  workType: string;
  positionsNeeded: number;
  hasHired?: boolean;
  source: any;
}

const STATUS_LABEL_KEYS: Record<JobPosting["status"], string> = {
  Open: "open",
  Hold: "hold",
  Closed: "closed",
};
const getPipelineStatusLabel = (t: TFunction, status: JobPosting["status"]) =>
  t(`jobsManagement.status.${STATUS_LABEL_KEYS[status]}`);

const MATCH_QUALITY_LABEL_KEYS: Record<JobPosting["matchQuality"], string> = {
  "Strong Match": "strong",
  "Good Match": "good",
  "Fair Match": "fair",
};
const getMatchQualityLabel = (t: TFunction, quality: JobPosting["matchQuality"]) =>
  t(`jobsManagement.matchQuality.${MATCH_QUALITY_LABEL_KEYS[quality]}`);

const WORK_LOCATION_LABEL_KEYS: Record<JobPosting["workLocation"], string> = {
  Remote: "remote",
  "On Site": "onSite",
};
const getWorkLocationLabel = (t: TFunction, value: JobPosting["workLocation"]) =>
  t(`jobsManagement.workLocation.${WORK_LOCATION_LABEL_KEYS[value]}`);

const WORK_TYPE_LABEL_KEYS: Record<string, string> = {
  "Short-term": "shortTerm",
  "Side hustle": "sideHustle",
  Recruiting: "recruiting",
  "Full Time": "fullTime",
  "Part-time": "partTime",
  Freelance: "freelance",
  Contract: "contract",
  Remote: "remote",
};
const getWorkTypeLabel = (t: TFunction, value: string) => {
  const key = WORK_TYPE_LABEL_KEYS[value];
  return key ? t(`jobsManagement.workType.${key}`) : value;
};

const formatSalaryAmount = (t: TFunction, amount: number) =>
  amount > 0
    ? t("jobsManagement.card.minimumPay", { amount: formatCurrency(amount, { maximumFractionDigits: 0 }) })
    : "—";

const formatJobDate = (value?: string): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatDate(date);
};

export function JobsManagement() {
  const { t } = useTranslation("employer");
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [markingDoneJobId, setMarkingDoneJobId] = useState<string | null>(null);
  const [confirmDoneJob, setConfirmDoneJob] = useState<JobPosting | null>(null);
  const [confirmReopenJob, setConfirmReopenJob] = useState<JobPosting | null>(null);
  const [reopeningJobId, setReopeningJobId] = useState<string | null>(null);
  const [confirmDeleteJob, setConfirmDeleteJob] = useState<JobPosting | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [viewingJob, setViewingJob] = useState<JobPosting | null>(null);
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

  const mapJob = useCallback((job: any): JobPosting => {
    const applicantsCount = Array.isArray(job.applicants) ? job.applicants.length : 0;
    const matchPercentage = Math.min(100, applicantsCount * 7 + 30);
    const workType = String(job.jobType || "Short-term").replace("Fulltime", "Full Time");
    const workLocation: JobPosting["workLocation"] = job.jobType === "Remote" ? "Remote" : "On Site";

    return {
      id: job._id,
      backendStatus: (job.status || "Available") as JobPosting["backendStatus"],
      title: job.title || "",
      department: job.category?.name || "",
      location: job.location || "",
      createdAt: job.createdAt,
      status: mapStatus(job.status),
      matchPercentage,
      matchQuality: getMatchQuality(matchPercentage),
      salaryAmount: Number(job.salary) || 0,
      candidatesApplied: applicantsCount,
      completedInterviews: Math.max(0, Math.floor(applicantsCount / 3)),
      workLocation,
      workType,
      positionsNeeded: Number(job.positionsNeeded) || 1,
      hasHired: false,
      source: job,
    };
  }, []);

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getMyJobs();
      const mapped = Array.isArray(data) ? data.map(mapJob) : [];

      // Fetch all employer applications once and compute hired flags per job to avoid per-job requests
      let allApps: any[] = [];
      try {
        allApps = await getEmployerApplications();
      } catch (e) {
        // If we fail to fetch apps, fall back to conservative defaults (no hired)
        allApps = [];
      }

      const appsByJob = allApps.reduce<Record<string, any[]>>((acc, app) => {
        const jobId = app.job?._id || String(app.job);
        if (!acc[jobId]) acc[jobId] = [];
        acc[jobId].push(app);
        return acc;
      }, {} as Record<string, any[]>);

      const withFlags = mapped.map((m) => {
        const apps = appsByJob[m.id as string] || [];
        const hasHired = apps.some((a: any) => a.status === 'Hired' || a.status === 'Accepted');
        const selectedApplicant = (data || []).find((j: any) => String(j._id) === String(m.id))?.selectedApplicant;
        return { ...m, hasHired: Boolean(hasHired || selectedApplicant) };
      });

      setJobs(withFlags);
    } catch (error: any) {
      const message = error?.message || t("jobsManagement.errors.loadFailed");
      setLoadError(message);
      toast.error(message);
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }, [mapJob, t]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const handleMarkJobDone = async (job: JobPosting) => {
    if (job.backendStatus === "Completed") {
      toast.info(t("jobsManagement.toast.alreadyCompleted"));
      return;
    }

    setConfirmDoneJob(job);
  };

  const confirmMarkJobDone = async () => {
    if (!confirmDoneJob) return;

    setMarkingDoneJobId(confirmDoneJob.id);
    try {
      await changeJobStatus(confirmDoneJob.id, "Completed");
      toast.success(t("jobsManagement.toast.markedDoneSuccess"));
      setConfirmDoneJob(null);
      await loadJobs();
    } catch (error: any) {
      toast.error(error?.message || t("jobsManagement.toast.markDoneFailed"));
    } finally {
      setMarkingDoneJobId(null);
    }
  };

  const handleReopenJob = (job: JobPosting) => {
    if (job.backendStatus === "Available") {
      toast.info(t("jobsManagement.toast.alreadyOpen"));
      return;
    }
    if (job.backendStatus === "In Progress") {
      toast.info(t("jobsManagement.toast.cannotReopenInProgress"));
      return;
    }
    setConfirmReopenJob(job);
  };

  const confirmReopenJobFn = async () => {
    if (!confirmReopenJob) return;
    setReopeningJobId(confirmReopenJob.id);
    try {
      await apiReopenJob(confirmReopenJob.id);
      toast.success(t("jobsManagement.toast.reopenSuccess"));
      setConfirmReopenJob(null);
      await loadJobs();
    } catch (error: any) {
      toast.error(error?.message || t("jobsManagement.toast.reopenFailed"));
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
      toast.success(t("jobsManagement.toast.deleteSuccess"));
      setConfirmDeleteJob(null);
      await loadJobs();
    } catch (error: any) {
      toast.error(error?.message || t("jobsManagement.toast.deleteFailed"));
    } finally {
      setDeletingJobId(null);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Open":
        return "bg-green-100 text-green-700";
      case "Hold":
        return "bg-slate-100 text-slate-700";
      case "Closed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getMatchColor = (percentage: number) => {
    if (percentage >= 80) return "text-blue-600";
    if (percentage >= 50) return "text-purple-600";
    return "text-orange-600";
  };

  const getMatchStroke = (percentage: number) => {
    if (percentage >= 80) return "#1C4D8D";
    if (percentage >= 50) return "#A855F7";
    return "#F59E0B";
  };

  return (
    <div className="ui-page px-4 md:px-0 pb-16">
      <div className="ui-page-header">
        <div>
          <h1 className="ui-page-title">{t("jobsManagement.header.title")}</h1>
          <p className="ui-page-subtitle">
            {t("jobsManagement.header.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate(ROUTES.employer.applications)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Users className="w-4 h-4" />
            {t("jobsManagement.header.viewApplications")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading &&
          Array.from({ length: 3 }).map((_, index) => (
            <div key={`skeleton-${index}`} className="ui-card p-6" aria-hidden="true">
              <div className="h-6 w-24 rounded-full bg-slate-100" />
              <div className="mt-4 space-y-2">
                <div className="h-4 w-2/3 rounded bg-slate-100" />
                <div className="h-3 w-full rounded bg-slate-100" />
              </div>
              <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
                <div className="h-12 w-12 rounded-full bg-slate-100" />
                <div className="space-y-2">
                  <div className="h-3.5 w-24 rounded bg-slate-100" />
                  <div className="h-3 w-16 rounded bg-slate-100" />
                </div>
              </div>
              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                <div className="h-3.5 w-full rounded bg-slate-100" />
                <div className="h-3.5 w-full rounded bg-slate-100" />
                <div className="h-3.5 w-full rounded bg-slate-100" />
              </div>
              <div className="mt-4 flex gap-2">
                <div className="h-6 w-20 rounded-full bg-slate-100" />
                <div className="h-6 w-24 rounded-full bg-slate-100" />
              </div>
              <div className="mt-5 h-11 w-full rounded-xl bg-slate-100" />
            </div>
          ))}
        {isLoading && (
          <p className="sr-only" role="status" aria-live="polite">
            {t("jobsManagement.states.loading")}
          </p>
        )}
        {loadError && !isLoading && (
          <div className="ui-card p-6">
            <p className="text-sm text-slate-500">{loadError}</p>
          </div>
        )}
        {!isLoading && !loadError && jobs.map((job) => {
          const isMarkingDone = markingDoneJobId === job.id;
          const isDeleting = deletingJobId === job.id;
          const isReopening = reopeningJobId === job.id;
          const canMarkDone = !(job.backendStatus === "Completed" || isMarkingDone || !job.hasHired);
          return (
          <div
            key={job.id}
            className="ui-card flex flex-col p-6 transition-shadow hover:shadow-md"
          >
            {/* Status */}
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(job.status)}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                {getPipelineStatusLabel(t, job.status)}
              </span>
              <span className="truncate text-xs text-slate-500">
                {job.department || t("jobsManagement.card.departmentFallback")}
              </span>
            </div>

            {/* Title */}
            <div className="mt-4">
              <h3 className="truncate text-base font-semibold text-slate-900" title={job.title || undefined}>
                {job.title || t("jobsManagement.card.untitledJob")}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <span className="truncate" title={job.location || undefined}>
                  {job.location || t("jobsManagement.card.locationFallback")}
                </span>
                <span aria-hidden="true">·</span>
                <span className="shrink-0">{formatJobDate(job.createdAt)}</span>
              </div>
            </div>

            {/* Match */}
            <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
              <div className="relative h-12 w-12 shrink-0">
                <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
                  <circle cx="24" cy="24" r="20" stroke="#E2E8F0" strokeWidth="5" fill="none" />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke={getMatchStroke(job.matchPercentage)}
                    strokeWidth="5"
                    fill="none"
                    strokeDasharray={2 * Math.PI * 20}
                    strokeDashoffset={2 * Math.PI * 20 * (1 - job.matchPercentage / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${getMatchColor(job.matchPercentage)}`}>
                  {job.matchPercentage}%
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{getMatchQualityLabel(t, job.matchQuality)}</p>
                <p className="text-xs text-slate-500">{t("jobsManagement.card.matchQualityLabel")}</p>
              </div>
            </div>

            {/* Stats */}
            <dl className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-slate-600">
                  {t("jobsManagement.card.minimumPayLabel")}
                </dt>
                <dd className="text-sm font-semibold text-slate-900">{formatSalaryAmount(t, job.salaryAmount)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-slate-600">
                  {t("jobsManagement.card.candidatesAppliedLabel")}
                </dt>
                <dd className="text-sm font-semibold text-slate-900">{job.candidatesApplied}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-slate-600">
                  {t("jobsManagement.card.completedInterviewLabel")}
                </dt>
                <dd className="text-sm font-semibold text-slate-900">{job.completedInterviews}</dd>
              </div>
            </dl>

            {/* Attributes */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>{getWorkLocationLabel(t, job.workLocation)}</Badge>
              <Badge>{getWorkTypeLabel(t, job.workType)}</Badge>
              <Badge>{t("jobsManagement.card.positionsCount", { count: job.positionsNeeded })}</Badge>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-5">
              <p className="text-xs text-slate-500">
                {t("jobsManagement.card.createdByPrefix")}{" "}
                <span className="font-semibold text-slate-900">{t("jobsManagement.card.createdByYou")}</span>
              </p>
              <button
                type="button"
                onClick={() => setViewingJob(job)}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#1C4D8D] px-4 text-sm font-semibold text-white transition hover:bg-[#163f75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2"
              >
                {t("jobsManagement.card.viewDetails")}
              </button>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.employer.postJob, {
                    state: { job: job.source, returnTo: ROUTES.employer.jobs },
                  })}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2"
                  title={t("jobsManagement.card.editTooltip")}
                >
                  {t("jobsManagement.card.editDetails")}
                </button>
                {job.status === "Closed" && (
                  <button
                    type="button"
                    onClick={() => void handleReopenJob(job)}
                    disabled={isReopening}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-3 text-xs font-semibold text-[#15803D] transition hover:bg-[#DCFCE7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803D] focus-visible:ring-offset-2 disabled:opacity-60"
                    title={t("jobsManagement.card.reopenTooltip")}
                  >
                    {isReopening ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />{t("jobsManagement.card.reopening")}</>
                    ) : (
                      t("jobsManagement.card.reopen")
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleMarkJobDone(job)}
                  disabled={!canMarkDone}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#1C4D8D]/20 bg-[#1C4D8D]/[0.06] px-3 text-xs font-semibold text-[#1C4D8D] transition hover:bg-[#1C4D8D]/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2 disabled:opacity-60"
                  title={!job.hasHired ? t("jobsManagement.card.markDoneTooltipBlocked") : t("jobsManagement.card.markDoneTooltip")}
                >
                  {isMarkingDone ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />{t("jobsManagement.card.marking")}</>
                  ) : (
                    t("jobsManagement.card.markAsDone")
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteJob(job)}
                  disabled={isDeleting}
                  className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 text-xs font-semibold text-[#B91C1C] transition hover:bg-[#FEE2E2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B91C1C] focus-visible:ring-offset-2 disabled:opacity-60 ${job.status === "Closed" ? "" : "col-span-2"}`}
                  title={t("jobsManagement.card.deleteTooltip")}
                >
                  {isDeleting ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />{t("jobsManagement.card.deleting")}</>
                  ) : (
                    t("jobsManagement.card.delete")
                  )}
                </button>
              </div>
              <p className="mt-3 text-[11px] leading-snug text-slate-500">
                {t("jobsManagement.card.escrowNote")}
              </p>
            </div>
          </div>
          );
        })}
        {!isLoading && !loadError && jobs.length === 0 && (
          <div className="ui-card p-6">
            <p className="text-sm text-slate-500">{t("jobsManagement.states.empty")}</p>
          </div>
        )}
      </div>

      {viewingJob ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="job-details-title"
        >
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 md:px-7">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(viewingJob.status)}`}>
                    {getPipelineStatusLabel(t, viewingJob.status)}
                  </span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {viewingJob.department || t("jobsManagement.card.departmentFallback")}
                  </span>
                </div>
                <h2 id="job-details-title" className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                  {viewingJob.title || t("jobsManagement.card.untitledJob")}
                </h2>
                <p className="mt-2 flex items-start gap-2 text-sm text-slate-500">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  {viewingJob.location || t("jobsManagement.card.locationFallback")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingJob(null)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label={t("jobsManagement.modal.closeAria")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 md:px-7 md:py-6">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t("jobsManagement.modal.minimumPayLabel")}</p>
                  <p className="mt-2 text-base font-bold text-slate-900">{formatSalaryAmount(t, viewingJob.salaryAmount)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t("jobsManagement.modal.opportunityLabel")}</p>
                  <p className="mt-2 text-base font-bold text-slate-900">{getWorkTypeLabel(t, viewingJob.workType)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t("jobsManagement.modal.positionsLabel")}</p>
                  <p className="mt-2 text-base font-bold text-slate-900">{t("jobsManagement.card.positionsCount", { count: viewingJob.positionsNeeded })}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t("jobsManagement.modal.deadlineLabel")}</p>
                  <p className="mt-2 text-base font-bold text-slate-900">{formatJobDate(viewingJob.source?.deadline)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t("jobsManagement.modal.applicationsLabel")}</p>
                  <p className="mt-2 text-base font-bold text-slate-900">{viewingJob.candidatesApplied}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t("jobsManagement.modal.postedLabel")}</p>
                  <p className="mt-2 text-base font-bold text-slate-900">{formatJobDate(viewingJob.createdAt)}</p>
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{t("jobsManagement.modal.descriptionTitle")}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {viewingJob.source?.description || t("jobsManagement.modal.noDescription")}
                  </p>
                </section>

                {Array.isArray(viewingJob.source?.responsibilities) && viewingJob.source.responsibilities.length > 0 ? (
                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{t("jobsManagement.modal.responsibilitiesTitle")}</h3>
                    <ul className="mt-2 space-y-2 text-sm text-slate-700">
                      {viewingJob.source.responsibilities.map((item: string, index: number) => (
                        <li key={`${item}-${index}`} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{t("jobsManagement.modal.requirementsTitle")}</h3>
                  {Array.isArray(viewingJob.source?.requirements) && viewingJob.source.requirements.length > 0 ? (
                    <ul className="mt-2 space-y-2 text-sm text-slate-700">
                      {viewingJob.source.requirements.map((item: string, index: number) => (
                        <li key={`${item}-${index}`} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">{t("jobsManagement.modal.noRequirements")}</p>
                  )}
                </section>

                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{t("jobsManagement.modal.skillsTitle")}</h3>
                  {Array.isArray(viewingJob.source?.skills) && viewingJob.source.skills.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {viewingJob.source.skills.map((skill: string, index: number) => (
                        <span key={`${skill}-${index}`} className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">{t("jobsManagement.modal.noSkills")}</p>
                  )}
                </section>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 md:px-7">
              <button
                type="button"
                onClick={() => setViewingJob(null)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                {t("jobsManagement.modal.close")}
              </button>
              <button
                type="button"
                onClick={() => navigate(ROUTES.employer.postJob, {
                  state: { job: viewingJob.source, returnTo: ROUTES.employer.jobs },
                })}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1C4D8D] px-4 text-sm font-semibold text-white transition hover:bg-[#163f75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2"
              >
                <Pencil className="h-4 w-4" />
                {t("jobsManagement.card.editDetails")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDoneJob ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">{t("jobsManagement.confirmDone.title")}</h3>
            <p className="mt-2 text-sm text-slate-600">
              <Trans
                t={t}
                i18nKey="jobsManagement.confirmDone.body"
                values={{ title: confirmDoneJob.title }}
                components={{ b: <span className="font-semibold text-slate-900" /> }}
              />
            </p>
            <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700 border border-blue-100">
              {t("jobsManagement.confirmDone.info")}
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDoneJob(null)}
                disabled={markingDoneJobId === confirmDoneJob.id}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                {t("jobsManagement.actions.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void confirmMarkJobDone()}
                disabled={markingDoneJobId === confirmDoneJob.id || !(confirmDoneJob as any).hasHired}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1C4D8D] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {markingDoneJobId === confirmDoneJob.id ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{t("jobsManagement.card.marking")}</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" />{t("jobsManagement.confirmDone.confirm")}</>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmReopenJob ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">{t("jobsManagement.confirmReopen.title")}</h3>
            <p className="mt-2 text-sm text-slate-600">
              <Trans
                t={t}
                i18nKey="jobsManagement.confirmReopen.body"
                values={{ title: confirmReopenJob.title }}
                components={{ b: <span className="font-semibold text-slate-900" /> }}
              />
            </p>
            <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700 border border-green-100">
              {confirmReopenJob.backendStatus === "Completed" || confirmReopenJob.backendStatus === "Cancelled"
                ? t("jobsManagement.confirmReopen.infoRecollect")
                : t("jobsManagement.confirmReopen.infoSimple")}
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReopenJob(null)}
                disabled={reopeningJobId === confirmReopenJob.id}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                {t("jobsManagement.actions.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void confirmReopenJobFn()}
                disabled={reopeningJobId === confirmReopenJob.id}
                className="inline-flex items-center gap-2 rounded-lg bg-[#15803D] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {reopeningJobId === confirmReopenJob.id ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{t("jobsManagement.card.reopening")}</>
                ) : (
                  <><RefreshCw className="h-4 w-4" />{t("jobsManagement.confirmReopen.confirm")}</>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDeleteJob ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">{t("jobsManagement.confirmDelete.title")}</h3>
            <p className="mt-2 text-sm text-slate-600">
              <Trans
                t={t}
                i18nKey="jobsManagement.confirmDelete.body"
                values={{ title: confirmDeleteJob.title }}
                components={{ b: <span className="font-semibold text-slate-900" /> }}
              />
            </p>
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-100">
              {t("jobsManagement.confirmDelete.info")}
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteJob(null)}
                disabled={deletingJobId === confirmDeleteJob.id}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                {t("jobsManagement.actions.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteJobFn()}
                disabled={deletingJobId === confirmDeleteJob.id}
                className="inline-flex items-center gap-2 rounded-lg bg-[#B91C1C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deletingJobId === confirmDeleteJob.id ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{t("jobsManagement.card.deleting")}</>
                ) : (
                  <><Trash2 className="h-4 w-4" />{t("jobsManagement.confirmDelete.confirm")}</>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
