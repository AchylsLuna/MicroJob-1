import { OfferCancellationDialog } from '../../components/OfferCancellationDialog';
import { lifecycleRequest } from '../../services/api';
import { AssignmentPanel } from '../../components/AssignmentPanel';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { motionTokens, seconds } from "@/constants/motion";
import {
  Calendar,
  CheckSquare,
  ClipboardList,
  Eye,
  Filter,
  Mail,
  MessageSquare,
  Square,
  Star,
  User as UserIcon,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "../../lib/toast";
import {
  getEmployerApplications,
  getEmployerJobHistory,
  hideEmployerApplication,
  restoreEmployerApplication,
  scheduleInterview,
  updateApplicationStatus,
  updateInterview,
  getEligibleReviews,
  createJobOffer,
  confirmOfferHire,
  authorizePayment,
  requestChanges as requestWorkChanges,
  settlePayment,
  type ApplicationStatus,
  type ReviewEligibilityItem,
  type JobOffer,
} from "../../services/api";
import { ROUTES } from "../../utils/routes";
import { safeExternalUrl } from "../../utils/safeExternalUrl";
import { RatingDialog, type RatingTarget } from "../../components/reviews/RatingDialog";
import { DateField } from "../../components/ui/DateField";
import { formatCurrency, formatDateTime } from "../../lib/formatters";
import { ConfirmDialog, Dialog } from "../../components/ui/index";
import { OfferActions } from "../../components/job/OfferActions";
import { HireChecklistDialog } from '../../components/HireChecklist';

// Converts between the "YYYY-MM-DD" date portion of scheduleForm.scheduledAt
// (a "YYYY-MM-DDTHH:mm" string, same shape <input type="datetime-local"> used)
// and the Date objects DateField works with.
function parseDateOnly(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}
function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Every stage an application can sit in — used for board columns and filters so
// hired applicants stay visible.
const PIPELINE_STATUSES: ApplicationStatus[] = [
  "Applied",
  "Shortlisted",
  "Interview Scheduled",
  "Interviewed",
  "Offer Sent",
  "Hired",
  "Rejected",
  "Withdrawn",
  "Cancelled",
  "Position filled",
];

// Stages an employer may set directly. "Hired" is deliberately excluded: hiring
// reserves a position, pins the agreed amount, and secures escrow, so it only
// happens through the formal offer flow. The status API rejects "Hired" too, so
// offering it here would just fail.
const EDITABLE_STATUSES: ApplicationStatus[] = PIPELINE_STATUSES.filter(
  (status) => !["Hired", "Offer Sent", "Withdrawn", "Cancelled", "Position filled"].includes(status),
);
const ACTION_STEP_KEYS = ["statusStep", "reviewStep", "hireStep", "paymentStep"] as const;

type EmployerApplication = {
  _id: string;
  status: ApplicationStatus;
  createdAt?: string;
  updatedAt?: string;
  coverLetter?: string;
  job: {
    _id: string;
    title: string;
    company?: string;
    location?: string;
    salary?: number;
    paymentMode?: string;
    workDates?: string[];
  };
  offer?: JobOffer | null;
  agreedAmount?: number;
  interviews?: Array<{ _id: string; status?: string; scheduledAt: string }>;
  workStatus?: string;
  paymentStatus?: string;
  employerHidden?: boolean;
  applicant: {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    jobsApplied?: number;
    projectsCompleted?: number;
    successRate?: string;
    city?: string;
    province?: string;
    about?: string;
    totalExperience?: string;
    skills?: string[];
    resumeUrl?: string;
    resumeFileName?: string;
    resume?: string;
    rating?: { averageRating?: number; totalReviews?: number };
  };
  match?: { percentage?: number; level?: string; reasons?: string[] };
  nextInterview?: {
    _id: string;
    scheduledAt: string;
    location?: string | null;
    mode?: string | null;
    notes?: string | null;
  } | null;
  timeline?: Array<{
    _id?: string;
    type?: string;
    status?: ApplicationStatus;
    note?: string;
    createdAt?: string;
  }>;
};

const toAbsoluteAssetUrl = (value?: string): string | null => {
  if (!value) return null;
  const apiBase = import.meta.env.VITE_API_BASE || "/api";
  const origin = apiBase.startsWith("http") ? apiBase.replace(/\/api\/?$/, "") : window.location.origin;
  const candidate = value.startsWith("/") ? `${origin}${value}` : value;
  return safeExternalUrl(candidate, { purpose: "asset", trustedOrigins: [origin] });
};

const formatAppliedDate = (value?: string): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return formatDateTime(parsed);
};

const statusClasses: Record<ApplicationStatus, string> = {
  Applied: "bg-[#E2E8F0] text-[#334155]",
  Shortlisted: "bg-brand/[0.08] text-brand",
  "Interview Scheduled": "bg-brand/10 text-brand",
  Interviewed: "bg-[#FEF3C7] text-[#B45309]",
  "Offer Sent": "bg-[#FCE7F3] text-[#BE185D]",
  Hired: "bg-[#DCFCE7] text-[#15803D]",
  Rejected: "bg-[#FEE2E2] text-[#B91C1C]",
  Withdrawn: "bg-[#F3F4F6] text-[#6B7280]",
  Cancelled: "bg-red-50 text-red-700",
  "Position filled": "bg-slate-100 text-slate-700",
};

const STATUS_LABEL_KEYS: Record<ApplicationStatus, string> = {
  Applied: "applied",
  Shortlisted: "shortlisted",
  "Interview Scheduled": "interviewScheduled",
  Interviewed: "interviewed",
  "Offer Sent": "offerSent",
  Hired: "hired",
  Rejected: "rejected",
  Withdrawn: "withdrawn",
  Cancelled: "cancelled",
  "Position filled": "positionFilled",
};

const getStatusLabel = (t: TFunction, status: ApplicationStatus) =>
  t(`applicationsManagement.status.${STATUS_LABEL_KEYS[status]}`);

const getApplicantName = (application: EmployerApplication, fallback: string) =>
  `${application.applicant?.firstName || ""} ${application.applicant?.lastName || ""}`.trim() ||
  application.applicant?.email ||
  fallback;

const getApplicantInitials = (application: EmployerApplication, fallback: string) =>
  getApplicantName(application, fallback)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function ApplicationCard({
  application,
  selected,
  onToggleSelected,
  onStatusChange,
  onHide,
  onRestore,
  onScheduleInterview,
  onOpenProfile,
  onMessage,
  reviewEligibility,
  onRate,
  history = false,
  offerBusy,
  onSendOffer,
  onCancelOffer,
  onConfirmHire,
  onAuthorizePayment,
  onReleasePayment,
  onRequestChanges,
}: {
  application: EmployerApplication;
  selected: boolean;
  onToggleSelected: (applicationId: string) => void;
  onStatusChange: (applicationId: string, status: ApplicationStatus) => void;
  onHide: (applicationId: string) => void;
  onRestore: (applicationId: string) => void;
  onScheduleInterview: (application: EmployerApplication) => void;
  onOpenProfile: (application: EmployerApplication) => void;
  onMessage: (application: EmployerApplication) => void;
  reviewEligibility?: ReviewEligibilityItem;
  offerBusy: boolean;
  onSendOffer: (application: EmployerApplication, amount: number) => void;
  onCancelOffer: (application: EmployerApplication) => void;
  onConfirmHire: (application: EmployerApplication) => void;
  onAuthorizePayment: (application: EmployerApplication) => void;
  onReleasePayment: (application: EmployerApplication) => void;
  onRequestChanges: (application: EmployerApplication, reason: string) => void;
  onRate: (application: EmployerApplication) => void;
  history?: boolean;
}) {
  const { t } = useTranslation("employer");
  const { t: tc } = useTranslation('common');
  const applicantFallback = t("applicationsManagement.card.applicantFallback");
  const resumeUrl = toAbsoluteAssetUrl(application.applicant?.resumeUrl || application.applicant?.resume);

  return (
    <div
      className={`rounded-card border p-4 shadow-sm space-y-4 ${
        application.employerHidden ? "border-[#E5E7EB] bg-[#F8FAFC] opacity-75 ring-1 ring-[#E5E7EB]" : "border-[#E5E7EB] bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {!history ? <button
          type="button"
          onClick={() => onToggleSelected(application._id)}
          className="mt-1 text-slate-500 hover:opacity-80"
          aria-label={
            selected
              ? t("applicationsManagement.card.deselectAria")
              : t("applicationsManagement.card.selectAria")
          }
        >
          {selected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
        </button> : null}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-brand/[0.06] text-brand flex items-center justify-center font-semibold">
              {getApplicantInitials(application, applicantFallback)}
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[#111827] line-clamp-1">{getApplicantName(application, applicantFallback)}</p>
              <p className="text-caption text-[#6B7280] line-clamp-1">{application.applicant?.email || t("applicationsManagement.card.noEmail")}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusClasses[application.status]}`}>
            {getStatusLabel(t, application.status)}
          </span>
          {application.employerHidden ? (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F3F4F6] text-[#6B7280]">
              {t("applicationsManagement.card.hiddenBadge")}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">
          {t("applicationsManagement.card.matchPercent", { percent: Number(application.match?.percentage || 0) })}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          {Number(application.applicant?.rating?.averageRating || 0).toFixed(1)} ({application.applicant?.rating?.totalReviews || 0})
        </span>
      </div>

      <div>
        <p className="text-body font-medium text-[#111827]">{application.job?.title || t("applicationsManagement.card.untitledRole")}</p>
        <p className="text-caption text-[#6B7280] mt-1">
          {t("applicationsManagement.card.appliedOn", { date: formatAppliedDate(application.createdAt) })}
        </p>
      </div>

      {application.nextInterview ? (
        <div className="rounded-xl border border-brand/20 bg-brand/[0.06] px-3 py-2 text-caption text-brand">
          {t("applicationsManagement.card.nextInterview", { date: formatAppliedDate(application.nextInterview.scheduledAt) })}
          {application.nextInterview.location ? ` · ${application.nextInterview.location}` : ""}
        </div>
      ) : null}

      {application.coverLetter ? (
        <p className="text-body-sm text-[#475569] line-clamp-3">{application.coverLetter}</p>
      ) : null}

      <div className="grid grid-cols-3 gap-2 text-center text-caption">
        <div className="rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] px-2 py-2">
          <div className="text-[#111827] font-semibold">{application.applicant?.jobsApplied || 0}</div>
          <div className="text-[#6B7280] mt-1">{t("applicationsManagement.card.stats.applied")}</div>
        </div>
        <div className="rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] px-2 py-2">
          <div className="text-[#111827] font-semibold">{application.applicant?.projectsCompleted || 0}</div>
          <div className="text-[#6B7280] mt-1">{t("applicationsManagement.card.stats.completed")}</div>
        </div>
        <div className="rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] px-2 py-2">
          <div className="text-[#111827] font-semibold">{application.applicant?.successRate || "0%"}</div>
          <div className="text-[#6B7280] mt-1">{t("applicationsManagement.card.stats.success")}</div>
        </div>
      </div>

      <div className="space-y-2">
        {!history ? <select
          value={application.status}
          disabled={!EDITABLE_STATUSES.includes(application.status)}
          onChange={(event) => onStatusChange(application._id, event.target.value as ApplicationStatus)}
          className="w-full h-10 rounded-xl border border-[#E5E7EB] px-3 text-body-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-brand"
        >
          {/* A hired application keeps showing "Hired" as its current value, but
              it cannot be re-selected; hiring is driven by the offer flow. */}
          {!EDITABLE_STATUSES.includes(application.status) && <option value={application.status}>{getStatusLabel(t, application.status)}</option>}
          {EDITABLE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {getStatusLabel(t, status)}
            </option>
          ))}
        </select> : null}

        {['Hired', 'Cancelled'].includes(application.status) && <AssignmentPanel applicationId={application._id} />}
        {application.interviews?.filter((item) => item.status !== 'completed' && new Date(item.scheduledAt).getTime() <= Date.now()).map((interview) => <button key={interview._id} type="button" className="rounded-xl border p-3" onClick={async () => { try { await lifecycleRequest(`/applications/${application._id}/interviews/${interview._id}`, { status: 'completed' }, 'PATCH'); window.dispatchEvent(new Event('microjobs:lifecycle')); } catch (e: any) { toast.error(e.message); } }}>✓ {tc('lifecycle.completeInterview')}</button>)}
        <OfferActions
          application={application}
          busy={offerBusy}
          onSendOffer={(amount) => onSendOffer(application, amount)}
          onCancelOffer={() => onCancelOffer(application)}
          onConfirmHire={() => onConfirmHire(application)}
          onAuthorizePayment={() => onAuthorizePayment(application)}
          onReleasePayment={() => onReleasePayment(application)}
          onRequestChanges={(reason) => onRequestChanges(application, reason)}
        />

        {!history ? <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onScheduleInterview(application)}
            className="inline-flex items-center justify-center gap-2 rounded-control border border-brand/20 bg-brand/[0.06] px-3 py-2 text-caption font-semibold text-brand"
          >
            <Calendar className="w-4 h-4" />
            {application.nextInterview ? t("applicationsManagement.card.reschedule") : t("applicationsManagement.card.schedule")}
          </button>
          {application.employerHidden ? (
            <button
              type="button"
              onClick={() => onRestore(application._id)}
              className="inline-flex items-center justify-center gap-2 rounded-control border border-brand/20 bg-brand/[0.06] px-3 py-2 text-caption font-semibold text-brand"
            >
              <Eye className="w-4 h-4" />
              {t("applicationsManagement.card.restore")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onHide(application._id)}
              className="inline-flex items-center justify-center gap-2 rounded-control border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-caption font-semibold text-[#B91C1C]"
            >
              <Eye className="w-4 h-4" />
              {t("applicationsManagement.card.hide")}
            </button>
          )}
        </div> : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenProfile(application)}
            className="inline-flex items-center justify-center gap-2 rounded-control border border-[#E5E7EB] px-3 py-2 text-caption font-semibold text-[#111827]"
          >
            <UserIcon className="w-4 h-4" />
            {t("applicationsManagement.card.profile")}
          </button>
          <button
            type="button"
            onClick={() => onMessage(application)}
            className="inline-flex items-center justify-center gap-2 rounded-control border border-[#E5E7EB] px-3 py-2 text-caption font-semibold text-[#111827]"
          >
            <MessageSquare className="w-4 h-4" />
            {t("applicationsManagement.card.message")}
          </button>
        </div>

        {resumeUrl ? (
          <a
            href={resumeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-caption font-semibold text-brand"
          >
            <Mail className="w-4 h-4" />
            {t("applicationsManagement.card.viewResume")}
          </a>
        ) : null}
        {reviewEligibility?.canReview ? (
          <button type="button" onClick={() => onRate(application)} className="inline-flex w-full items-center justify-center gap-2 rounded-control bg-amber-500 px-3 py-2 text-caption font-semibold text-white">
            <Star className="h-4 w-4" /> {t("applicationsManagement.card.rateWorker")}
          </button>
        ) : reviewEligibility?.existingReview ? (
          <p className="text-center text-caption font-semibold text-emerald-700">{t("applicationsManagement.card.reviewSubmitted")}</p>
        ) : history ? <p className="text-caption text-slate-500">{t("jobHistory.ratingAfterCompletion")}</p> : null}
      </div>
    </div>
  );
}

export function ApplicationsManagement({ historyJobId, onHistoryChange }: { historyJobId?: string; onHistoryChange?: () => void } = {}) {
  const { t } = useTranslation("employer");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const [statusFilter, setStatusFilter] = useState<"all" | ApplicationStatus>("all");
  const [jobFilter, setJobFilter] = useState(historyJobId || searchParams.get('jobId') || "");
  const [jobOptions, setJobOptions] = useState<Array<{ id: string; title: string }>>([]);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobsLoading, setJobsLoading] = useState(!historyJobId);
  const [actionsTarget, setActionsTarget] = useState<EmployerApplication | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const loadSequence = useRef(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [includeHidden, setIncludeHidden] = useState(Boolean(historyJobId));
  const [applications, setApplications] = useState<EmployerApplication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<ApplicationStatus>("Shortlisted");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<EmployerApplication | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    scheduledAt: "",
    location: "",
    mode: "virtual",
    notes: "",
  });
  const [isScheduling, setIsScheduling] = useState(false);
  const [reviewEligibility, setReviewEligibility] = useState<Record<string, ReviewEligibilityItem>>({});
  const [ratingTarget, setRatingTarget] = useState<RatingTarget | null>(null);
  const [hireTarget, setHireTarget] = useState<EmployerApplication | null>(null);
  const [offerBusyId, setOfferBusyId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    warning?: string;
    confirmLabel?: string;
    destructive?: boolean;
    run: () => Promise<void>;
  } | null>(null);

  const [cancelOfferId, setCancelOfferId] = useState<string | null>(null);
  const [rejectAfterCancelApp, setRejectAfterCancelApp] = useState<string | null>(null);
  useEffect(() => {
    if (historyJobId) return;
    let cancelled = false;
    // The management listing excludes fully refunded jobs; history lists all
    // owned postings so the selector remains complete regardless of status.
    void getEmployerJobHistory().then((jobs) => {
      if (cancelled) return;
      const options = jobs.map((job) => ({ id: String(job._id), title: job.title }));
      setJobOptions(options);
      setJobFilter((current) => current || options[0]?.id || "");
    }).catch((error: any) => {
      if (!cancelled) setJobsError(error?.message || t("applicationsManagement.errors.jobsLoadFailed"));
    }).finally(() => { if (!cancelled) setJobsLoading(false); });
    return () => { cancelled = true; };
  }, [historyJobId, t]);

  const loadApplications = useCallback(async (silent = false) => {
    if (!jobFilter) return;
    const sequence = ++loadSequence.current;
    if (!silent) setIsLoading(true);
    setLoadError(null);
    try {
      const [response, reviewResponse] = await Promise.all([
        getEmployerApplications({
          jobId: jobFilter,
          ...(includeHidden ? { includeHidden: "true" } : {}),
        }),
        getEligibleReviews().catch(() => null),
      ]);
      if (sequence !== loadSequence.current) return;
      const nextApplications = Array.isArray(response) ? (response as EmployerApplication[]) : [];
      setApplications(nextApplications.filter((item) => item.status !== "Withdrawn"));
      setReviewEligibility(Object.fromEntries((reviewResponse?.asEmployer || []).map((item) => [item.applicationId, item])));
      setSelectedIds((current) => current.filter((id) => nextApplications.some((item) => item._id === id)));
    } catch (error: any) {
      if (sequence !== loadSequence.current) return;
      setLoadError(error?.message || t("applicationsManagement.errors.loadFailed"));
      if (!silent) setApplications([]);
    } finally {
      if (sequence === loadSequence.current) setIsLoading(false);
    }
  }, [includeHidden, jobFilter, t]);

  useEffect(() => {
    setApplications([]);
    void loadApplications();
    return () => { loadSequence.current += 1; };
  }, [loadApplications]);

  const groupedApplications = useMemo(
    () =>
      PIPELINE_STATUSES.reduce<Record<ApplicationStatus, EmployerApplication[]>>((acc, status) => {
        acc[status] = applications.filter((application) => application.status === status);
        return acc;
      }, {} as Record<ApplicationStatus, EmployerApplication[]>),
    [applications],
  );

  const visibleApplications = useMemo(
    () => applications.filter((application) => {
      const search = searchTerm.trim().toLowerCase();
      const name = `${application.applicant?.firstName || ""} ${application.applicant?.lastName || ""}`.toLowerCase();
      return application.job?._id === jobFilter && (statusFilter === "all" || application.status === statusFilter) &&
        (!search || [name, application.applicant?.email, application.job?.title].some((value) => value?.toLowerCase().includes(search)));
    }),
    [applications, jobFilter, searchTerm, statusFilter],
  );

  useEffect(() => {
    const id = searchParams.get('applicationId');
    const jobId = searchParams.get('jobId');
    if (id && jobId) setJobFilter(jobId);
    if (id) setIncludeHidden(true);
    const application = applications.find((item) => item._id === id);
    if (!application) return;
    setActionsTarget(application);
    const next = new URLSearchParams(searchParams); next.delete('applicationId'); next.delete('jobId');
    setSearchParams(next, { replace: true });
  }, [applications, searchParams, setSearchParams]);

  const activeApplication = actionsTarget ? applications.find((item) => item._id === actionsTarget._id) || actionsTarget : null;
  const actionStep = activeApplication?.status === "Hired" ? 4 : activeApplication?.offer?.status === "accepted" ? 3 : activeApplication?.offer?.status === "pending" ? 2 : 1;

  // Refresh only while an offer is being reviewed; keep the dialog and table
  // mounted and stop polling when it closes or the applicant responds.
  useEffect(() => {
    if (!activeApplication || actionStep !== 2 || offerBusyId || confirmAction) return;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || document.visibilityState === "hidden") return;
      refreshing = true;
      try { await loadApplications(true); } finally { refreshing = false; }
    };
    const timer = window.setInterval(() => void refresh(), 10000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [activeApplication, actionStep, confirmAction, loadApplications, offerBusyId]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const updateLocalApplication = (applicationId: string, updater: (item: EmployerApplication) => EmployerApplication) => {
    setApplications((current) => current.map((item) => (item._id === applicationId ? updater(item) : item)));
    setActionsTarget((current) => current?._id === applicationId ? updater(current) : current);
  };

  const handleStatusChange = async (applicationId: string, nextStatus: ApplicationStatus) => {
    setStatusBusy(true);
    try {
      await updateApplicationStatus(applicationId, nextStatus);
      updateLocalApplication(applicationId, (item) => ({ ...item, status: nextStatus }));
      toast.success(t("applicationsManagement.toast.statusMoved", { status: getStatusLabel(t, nextStatus) }));
    } catch (error: any) {
      toast.error(error?.message || t("applicationsManagement.toast.statusUpdateFailed"));
    } finally {
      setStatusBusy(false);
    }
  };

  const handleHideApplications = async (applicationIds: string[]) => {
    if (applicationIds.length === 0) return;
    const results = await Promise.allSettled(applicationIds.map((applicationId) => hideEmployerApplication(applicationId)));
    const succeeded = applicationIds.filter((_, index) => results[index].status === "fulfilled");
    const failed = applicationIds.length - succeeded.length;
    setApplications((current) => current.filter((item) => !succeeded.includes(item._id)));
    setSelectedIds((current) => current.filter((id) => !succeeded.includes(id)));
    if (succeeded.length) toast.success(t("applicationsManagement.toast.hiddenCount", { count: succeeded.length }));
    if (failed) toast.error(t("applicationsManagement.toast.hideFailedCount", { count: failed }));
  };

  const handleRestoreApplications = async (applicationIds: string[]) => {
    if (applicationIds.length === 0) return;
    const results = await Promise.allSettled(applicationIds.map((applicationId) => restoreEmployerApplication(applicationId)));
    const succeeded = applicationIds.filter((_, index) => results[index].status === "fulfilled");
    const failed = applicationIds.length - succeeded.length;
    setApplications((current) =>
      current.map((item) => (succeeded.includes(item._id) ? { ...item, employerHidden: false } : item)),
    );
    if (succeeded.length) toast.success(t("applicationsManagement.toast.restoredCount", { count: succeeded.length }));
    if (failed) toast.error(t("applicationsManagement.toast.restoreFailedCount", { count: failed }));
  };

  const handleBulkStatusChange = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const results = await Promise.allSettled(selectedIds.map((applicationId) => updateApplicationStatus(applicationId, bulkStatus)));
      const succeeded = new Set(selectedIds.filter((_, index) => results[index].status === "fulfilled"));
      const failed = selectedIds.length - succeeded.size;
      setApplications((current) =>
        current.map((item) => (succeeded.has(item._id) ? { ...item, status: bulkStatus } : item)),
      );
      setSelectedIds((current) => current.filter((id) => !succeeded.has(id)));
      if (succeeded.size) toast.success(t("applicationsManagement.toast.bulkUpdatedCount", { count: succeeded.size }));
      if (failed) toast.error(t("applicationsManagement.toast.bulkFailedCount", { count: failed }));
    } catch (error: any) {
      toast.error(error?.message || t("applicationsManagement.toast.bulkUpdateFailed"));
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleToggleSelected = (applicationId: string) => {
    setSelectedIds((current) =>
      current.includes(applicationId) ? current.filter((id) => id !== applicationId) : [...current, applicationId],
    );
  };

  const handleToggleSelectAll = () => {
    const visibleIds = visibleApplications.map((item) => item._id);
    const allSelected = visibleIds.every((id) => selectedSet.has(id));
    if (allSelected) {
      setSelectedIds((current) => current.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setSelectedIds(Array.from(new Set([...selectedIds, ...visibleIds])));
  };

  const handleOpenProfile = (application: EmployerApplication) => {
    navigate(`${ROUTES.publicProfile(application.applicant._id)}?viewAs=worker`);
  };

  const handleMessage = (application: EmployerApplication) => {
    const name = getApplicantName(application, t("applicationsManagement.card.applicantFallback"));
    const jobTitle = application.job?.title || t("applicationsManagement.card.thisRoleFallback");
    const params = new URLSearchParams({
      contact: `${application.applicant._id}::${application.job?._id || ""}`,
      startUser: application.applicant._id,
      jobId: application.job?._id || "",
      startName: name,
      draft: t("applicationsManagement.messageDraft", { name, job: jobTitle }),
    });
    navigate(`${ROUTES.employer.messages}?${params.toString()}`);
  };

  const handleRateWorker = (application: EmployerApplication) => {
    setRatingTarget({
      applicationId: application._id,
      name: getApplicantName(application, t("applicationsManagement.card.applicantFallback")),
      jobTitle: application.job?.title || t("applicationsManagement.card.completedJobFallback"),
      roleLabel: "worker",
    });
  };

  const handleOpenSchedule = (application: EmployerApplication) => {
    setScheduleTarget(application);
    setScheduleForm({
      scheduledAt: application.nextInterview?.scheduledAt
        ? new Date(application.nextInterview.scheduledAt).toISOString().slice(0, 16)
        : "",
      location: application.nextInterview?.location || "",
      mode: application.nextInterview?.mode || "virtual",
      notes: application.nextInterview?.notes || "",
    });
  };

  const handleScheduleSubmit = async () => {
    if (!scheduleTarget) return;
    if (!scheduleForm.scheduledAt) {
      toast.error(t("applicationsManagement.toast.interviewDateRequired"));
      return;
    }

    setIsScheduling(true);
    try {
      if (scheduleTarget.nextInterview?._id) {
        await updateInterview(scheduleTarget._id, scheduleTarget.nextInterview._id, {
          scheduledAt: new Date(scheduleForm.scheduledAt).toISOString(),
          location: scheduleForm.location.trim(),
          mode: scheduleForm.mode,
          notes: scheduleForm.notes.trim(),
        });
      } else {
        await scheduleInterview(scheduleTarget._id, {
          scheduledAt: new Date(scheduleForm.scheduledAt).toISOString(),
          location: scheduleForm.location.trim(),
          mode: scheduleForm.mode,
          notes: scheduleForm.notes.trim(),
        });
      }
      toast.success(
        scheduleTarget.nextInterview
          ? t("applicationsManagement.toast.interviewRescheduled")
          : t("applicationsManagement.toast.interviewScheduledSuccess"),
      );
      setScheduleTarget(null);
      await loadApplications();
    } catch (error: any) {
      toast.error(error?.message || t("applicationsManagement.toast.interviewSaveFailed"));
    } finally {
      setIsScheduling(false);
    }
  };

  const runOfferAction = async (applicationId: string, action: () => Promise<unknown>, successMessage?: string) => {
    setOfferBusyId(applicationId);
    try {
      await action();
      onHistoryChange?.();
      if (successMessage) toast.success(successMessage);
    } catch (error: any) {
      toast.error(error?.message || t("applicationsManagement.toast.offerActionFailed"));
    } finally {
      await loadApplications(true);
      setOfferBusyId(null);
    }
  };

  const handleSendOffer = (application: EmployerApplication, amount: number) => {
    const name = getApplicantName(application, t("applicationsManagement.card.applicantFallback"));
    const minimum = Number(application.job.salary || 0);
    setConfirmAction({
      title: t("applicationsManagement.confirmOffer.title"),
      description: t("applicationsManagement.confirmOffer.description", {
        name,
        amount: formatCurrency(amount),
        minimum: formatCurrency(minimum),
        escrow: formatCurrency(Math.max(0, amount - minimum) * (application.job.paymentMode === 'daily' ? application.job.workDates?.length || 1 : 1)),
      }),
      confirmLabel: t("applicationsManagement.confirmOffer.confirm"),
      run: () => runOfferAction(application._id, () => createJobOffer(application._id, amount), t("applicationsManagement.toast.offerSent")),
    });
  };

  useEffect(() => { const reload = () => void loadApplications(); window.addEventListener('microjobs:lifecycle', reload); return () => window.removeEventListener('microjobs:lifecycle', reload); }, [loadApplications]);

  const handleCancelOffer = (application: EmployerApplication) => { setRejectAfterCancelApp(null); if (application.offer) setCancelOfferId(application.offer.id); };

  const handleConfirmHire = (application: EmployerApplication) => {
    if (application.offer) setHireTarget(application);
  };

  const handleRejectApplicant = (application: EmployerApplication) => { if (application.offer) { setRejectAfterCancelApp(application._id); setCancelOfferId(application.offer.id); } };
  const handleAuthorizePayment = async (application: EmployerApplication) => {
    try { const preview = await lifecycleRequest(`/applications/${application._id}/payment/preview`, {}); setConfirmAction({ title: t('applicationsManagement.confirmPay.title'), description: `${preview.jobTitle}. ${t('applicationsManagement.confirmPay.description', { name: getApplicantName(application, ''), amount: formatCurrency(preview.amount) })} ${tc('lifecycle.releaseAmount', { amount: formatCurrency(preview.amount) })}`, run: () => runOfferAction(application._id, () => authorizePayment(application._id)) }); } catch (error: any) { toast.error(error.message); }
  };
  const handleReleasePayment = async (application: EmployerApplication) => {
    try { const preview = await lifecycleRequest(`/applications/${application._id}/payment/preview`, {}); setConfirmAction({ title: t('applicationsManagement.confirmPay.title'), description: `${preview.jobTitle}. ${t('applicationsManagement.confirmPay.description', { name: getApplicantName(application, ''), amount: formatCurrency(preview.amount) })} ${tc('lifecycle.releaseAmount', { amount: formatCurrency(preview.amount) })}`, run: () => runOfferAction(application._id, () => settlePayment(application._id), t('applicationsManagement.toast.workerPaid')) }); } catch (error: any) { toast.error(error.message); }
  };

  const handleRequestChanges = (application: EmployerApplication, reason: string) => {
    void runOfferAction(application._id, () => requestWorkChanges(application._id, reason));
  };


  const handleConfirmDialogConfirm = () => {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);
    void action.run();
  };

  return (
    <div className={historyJobId ? "space-y-4" : "ui-page"}>
      {!historyJobId ? <div className="ui-card p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="ui-page-title">{t("applicationsManagement.title")}</h1>
            <p className="ui-page-subtitle">{t("applicationsManagement.subtitle")}</p>
          </div>
        </div>

        <div>
          <label htmlFor="applications-job" className="mb-2 block text-body-sm font-semibold text-slate-700">{t("applicationsManagement.filters.jobLabel")}</label>
          <select
            id="applications-job"
            value={jobFilter}
            disabled={jobsLoading || Boolean(jobsError) || jobOptions.length === 0}
            onChange={(event) => { setIsLoading(true); setJobFilter(event.target.value); setSelectedIds([]); setActionsTarget(null); }}
            className="h-11 w-full rounded-control border border-[#E5E7EB] bg-white px-3 text-body-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-60"
          >
            {!jobFilter ? <option value="">{t(jobsLoading ? "applicationsManagement.filters.loadingJobs" : "applicationsManagement.filters.noJobs")}</option> : null}
            {jobOptions.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
          </select>
          {jobsError ? <p role="alert" className="mt-2 text-body-sm text-red-700">{jobsError}</p> : null}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("applicationsManagement.filters.searchPlaceholder")}
              aria-label={t("applicationsManagement.filters.searchAriaLabel")}
              className="w-full h-11 rounded-xl border border-[#E5E7EB] pl-9 pr-3 text-body-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <select
            aria-label={t("applicationsManagement.filters.stageAriaLabel")}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-11 rounded-xl border border-[#E5E7EB] px-3 text-body-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="all">{t("applicationsManagement.filters.allStages")}</option>
            {PIPELINE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {getStatusLabel(t, status)}
              </option>
            ))}
          </select>
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2 text-body-sm font-medium text-[#475569]">
          <input
            type="checkbox"
            checked={includeHidden}
            onChange={(event) => setIncludeHidden(event.target.checked)}
            className="h-4 w-4 rounded border-[#CBD5E1] text-brand focus:ring-2 focus:ring-brand"
          />
          {t("applicationsManagement.filters.showHidden")}
        </label>

        {selectedIds.length > 0 ? (
          <div className="rounded-card border border-brand/20 bg-brand/[0.06] px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="text-body-sm text-brand font-medium">
              {t("applicationsManagement.bulk.selectedCount", { count: selectedIds.length })}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                aria-label={t("applicationsManagement.bulk.stageAriaLabel")}
                value={bulkStatus}
                onChange={(event) => setBulkStatus(event.target.value as ApplicationStatus)}
                className="h-10 rounded-control border border-brand/20 px-3 text-body-sm text-[#111827]"
              >
                {EDITABLE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t("applicationsManagement.bulk.moveTo", { status: getStatusLabel(t, status) })}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleBulkStatusChange}
                disabled={isBulkUpdating}
                className="h-10 rounded-control bg-brand px-4 text-body-sm font-semibold text-white disabled:opacity-60"
              >
                {isBulkUpdating ? t("applicationsManagement.bulk.updating") : t("applicationsManagement.bulk.applyBulkStatus")}
              </button>
              <button
                type="button"
                onClick={() => handleHideApplications(selectedIds)}
                className="h-10 rounded-control border border-[#FCA5A5] bg-white px-4 text-body-sm font-semibold text-[#B91C1C]"
              >
                {t("applicationsManagement.bulk.hideSelected")}
              </button>
            </div>
          </div>
        ) : null}
      </div> : null}

      {loadError ? (
        <div className="bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] px-4 py-3 rounded-xl text-body-sm">
          {loadError}
        </div>
      ) : null}

      {isLoading ? (
        <div className="bg-white rounded-card border border-[#E5E7EB] p-10 text-center text-[#6B7280]">
          {t("applicationsManagement.states.loading")}
        </div>
      ) : null}

      {!isLoading && !jobsLoading && visibleApplications.length === 0 ? (
        <div className="bg-white rounded-card border border-[#E5E7EB] p-10 text-center text-[#6B7280]">
          {t("applicationsManagement.states.empty")}
        </div>
      ) : null}

      {!isLoading && applications.length > 0 && historyJobId ? (
        <div className="flex flex-col gap-4 pb-2 md:flex-row md:overflow-x-auto">
          {PIPELINE_STATUSES.map((status) => (
            <div key={status} className={`w-full rounded-[18px] bg-[#F8FAFC] border border-[#E5E7EB] p-4 space-y-4 ${historyJobId ? "" : "md:min-w-[320px] md:max-w-[320px]"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-section font-semibold text-[#111827]">{getStatusLabel(t, status)}</h3>
                  <p className="text-caption text-[#6B7280] mt-1">
                    {t("applicationsManagement.board.applicantCount", { count: groupedApplications[status].length })}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusClasses[status]}`}>
                  {groupedApplications[status].length}
                </span>
              </div>

              <div className="space-y-3">
                {groupedApplications[status].length === 0 ? (
                  <div className="rounded-card border border-dashed border-[#CBD5E1] bg-white px-4 py-8 text-center text-body-sm text-[#94A3B8]">
                    {t("applicationsManagement.board.emptyColumn")}
                  </div>
                ) : (
                  groupedApplications[status].map((application, index) => (
                    <motion.div
                      key={application._id}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index, 8) * 0.04, duration: seconds(motionTokens.duration.standard) }}
                    >
                      <ApplicationCard
                        history={Boolean(historyJobId)}
                        application={application}
                        selected={selectedSet.has(application._id)}
                        onToggleSelected={handleToggleSelected}
                        onStatusChange={handleStatusChange}
                        onHide={(applicationId) => handleHideApplications([applicationId])}
                        onRestore={(applicationId) => handleRestoreApplications([applicationId])}
                        onScheduleInterview={handleOpenSchedule}
                        onOpenProfile={handleOpenProfile}
                        onMessage={handleMessage}
                        reviewEligibility={reviewEligibility[application._id]}
                        onRate={handleRateWorker}
                        offerBusy={offerBusyId === application._id}
                        onSendOffer={handleSendOffer}
                        onCancelOffer={handleCancelOffer}
                        onConfirmHire={handleConfirmHire}
                        onAuthorizePayment={handleAuthorizePayment}
                        onReleasePayment={handleReleasePayment}
                        onRequestChanges={handleRequestChanges}
                      />
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!historyJobId && jobFilter ? <h2 className="text-section font-bold text-slate-900">{jobOptions.find((job) => job.id === jobFilter)?.title}</h2> : null}

      {!isLoading && visibleApplications.length > 0 && !historyJobId ? (
        <div className="overflow-x-auto rounded-card border border-[#E5E7EB] bg-white p-4">
          <table className="w-full min-w-[1040px] text-left text-body-sm">
            <caption className="sr-only">{jobOptions.find((job) => job.id === jobFilter)?.title}</caption>
            <thead>
              <tr className="border-b border-[#E5E7EB] text-[#6B7280]">
                <th scope="col" className="py-3 pr-4 font-medium">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={visibleApplications.length > 0 && visibleApplications.every((application) => selectedSet.has(application._id))}
                      onChange={handleToggleSelectAll} aria-label={t("applicationsManagement.table.selectAll")} className="h-4 w-4 accent-brand" />
                    {t("applicationsManagement.table.headers.applicant")}
                  </div>
                </th>
                {["stage", "interview", "applied", "resume", "profile", "actions", "hide"].map((header) => (
                  <th scope="col" key={header} className="py-3 pr-4 font-medium">{t(`applicationsManagement.table.headers.${header}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleApplications.map((application, index) => {
                const resumeUrl = toAbsoluteAssetUrl(application.applicant?.resumeUrl || application.applicant?.resume);
                const name = getApplicantName(application, t("applicationsManagement.card.applicantFallback"));
                return (
                  <motion.tr key={application._id}
                    className={`border-b border-[#F3F4F6] align-middle transition-colors hover:bg-slate-50 ${application.employerHidden ? "bg-slate-50" : ""}`}
                    initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(index, 8) * 0.03, duration: seconds(motionTokens.duration.enter) }}>
                    <td className="py-4 pr-4 text-[#111827]">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={selectedSet.has(application._id)} onChange={() => handleToggleSelected(application._id)}
                          aria-label={t("applicationsManagement.table.selectApplicant", { name })} className="h-4 w-4 shrink-0 accent-brand" />
                        <div>
                          <div className="font-semibold">{name}</div>
                          {application.employerHidden ? <span className="text-caption text-slate-500">{t("applicationsManagement.card.hiddenBadge")}</span> : null}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-caption font-semibold ${statusClasses[application.status]}`}>
                        {getStatusLabel(t, application.status)}
                      </span>
                    </td>
                    <td className="py-4 pr-4">
                      <button type="button" onClick={() => handleOpenSchedule(application)} disabled={application.status === "Hired"}
                        className="rounded-control border border-brand/20 bg-brand/[0.06] px-3 py-2 font-semibold text-brand disabled:cursor-not-allowed disabled:opacity-50">
                        {t(application.nextInterview ? "applicationsManagement.card.reschedule" : "applicationsManagement.table.actions.interview")}
                      </button>
                      <p className="mt-1 text-caption text-slate-500">
                        {application.nextInterview ? formatAppliedDate(application.nextInterview.scheduledAt) : t("applicationsManagement.table.notScheduled")}
                      </p>
                    </td>
                    <td className="whitespace-nowrap py-4 pr-4 text-slate-600">{formatAppliedDate(application.createdAt)}</td>
                    <td className="py-4 pr-4">
                      {resumeUrl ? <a href={resumeUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand underline-offset-4 hover:underline">{t("applicationsManagement.card.viewResume")}</a>
                        : <span className="text-slate-400">{t("applicationsManagement.table.noResume")}</span>}
                    </td>
                    <td className="py-4 pr-4">
                      <button type="button" onClick={() => handleOpenProfile(application)} className="whitespace-nowrap rounded-control border border-[#E5E7EB] px-3 py-2 font-semibold text-slate-700">
                        {t("applicationsManagement.table.headers.profile")}
                      </button>
                    </td>
                    <td className="py-4 pr-4">
                      <button type="button" onClick={() => { setActionsTarget(application); void loadApplications(true); }} className="rounded-control bg-brand px-3 py-2 font-semibold text-white hover:opacity-90">
                        {t("applicationsManagement.table.headers.actions")}
                      </button>
                    </td>
                    <td className="py-4 pr-4">
                      <button type="button" onClick={() => application.employerHidden ? handleRestoreApplications([application._id]) : handleHideApplications([application._id])}
                        className="rounded-control border border-[#E5E7EB] px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50">
                        {t(application.employerHidden ? "applicationsManagement.card.restore" : "applicationsManagement.card.hide")}
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {activeApplication ? (
        <Dialog open={!confirmAction && !ratingTarget && !hireTarget} title={t("applicationsManagement.workflow.title")}
          description={`${getApplicantName(activeApplication, t("applicationsManagement.card.applicantFallback"))} · ${activeApplication.job.title}`}
          onClose={() => setActionsTarget(null)} closeDisabled={Boolean(offerBusyId) || statusBusy} size="xl">
          <div className="space-y-5" aria-busy={Boolean(offerBusyId) || statusBusy}>{["Hired", "Cancelled"].includes(activeApplication.status) && <AssignmentPanel applicationId={activeApplication._id} onChanged={() => void loadApplications(true)} />}
            <ol className="flex items-center justify-center" aria-label={t("applicationsManagement.workflow.stepsLabel")}>
              {ACTION_STEP_KEYS.map((label, index) => (
                <li key={label} aria-current={actionStep === index + 1 ? "step" : undefined}
                  className="flex items-center">
                  <span className="-mx-3 flex h-11 w-11 shrink-0 items-center justify-center">
                    <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${index + 1 <= actionStep ? "bg-brand" : "bg-slate-200"}`} />
                    <span className="sr-only">{index + 1}. {t(`applicationsManagement.workflow.${label}`)}</span>
                  </span>
                  {index < ACTION_STEP_KEYS.length - 1 ? <span aria-hidden="true" className="h-px w-8 shrink-0 bg-slate-200" /> : null}
                </li>
              ))}
            </ol>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              {t("applicationsManagement.workflow.stepCaption", { step: actionStep, total: ACTION_STEP_KEYS.length, title: t(`applicationsManagement.workflow.${ACTION_STEP_KEYS[actionStep - 1]}`) })}
            </p>
            {loadError ? <p role="alert" className="text-body-sm text-red-700">{loadError}</p> : null}
            <AnimatePresence mode="wait">
              <motion.div key={`${activeApplication._id}:${actionStep}`} className="space-y-5"
                initial={prefersReducedMotion ? false : { opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, x: -16 }}
                transition={{ duration: prefersReducedMotion ? 0 : seconds(motionTokens.duration.fast) }}>
                {actionStep === 1 ? (
                  <section className="space-y-5 rounded-card border border-slate-200 bg-slate-50/60 p-4 md:p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm ring-1 ring-slate-200"><ClipboardList size={20} aria-hidden="true" /></div>
                      <div><h3 className="font-bold text-slate-900">{t("applicationsManagement.workflow.changeStatus")}</h3><p className="mt-0.5 text-sm text-slate-500">{t("applicationsManagement.workflow.statusSubtitle")}</p></div>
                    </div>
                    <div>
                      <label htmlFor="application-status" className="mb-2 block text-sm font-semibold text-slate-700">{t("applicationsManagement.workflow.changeStatus")}</label>
                      <select id="application-status" value={activeApplication.status} disabled={statusBusy || Boolean(offerBusyId)}
                        onChange={(event) => void handleStatusChange(activeApplication._id, event.target.value as ApplicationStatus)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-brand-500">
                        {EDITABLE_STATUSES.map((status) => <option key={status} value={status}>{getStatusLabel(t, status)}</option>)}
                      </select>
                    </div>
                    {activeApplication.offer?.status === "rejected" ? <p role="status" className="mt-3 text-body-sm text-slate-600">{t("applicationsManagement.workflow.offerDeclined")}</p> : null}
                    {activeApplication.status === "Rejected" ? <p className="mt-3 text-body-sm text-slate-600">{t("applicationsManagement.workflow.rejectedHelp")}</p> : null}
                  </section>
                ) : null}
                <OfferActions key={activeApplication._id} stepped application={activeApplication} busy={Boolean(offerBusyId) || statusBusy}
                  onSendOffer={(amount) => handleSendOffer(activeApplication, amount)}
                  onCancelOffer={() => handleCancelOffer(activeApplication)}
                  onConfirmHire={() => handleConfirmHire(activeApplication)}
                  onReject={() => handleRejectApplicant(activeApplication)}
                  onAuthorizePayment={() => handleAuthorizePayment(activeApplication)}
                  onReleasePayment={() => handleReleasePayment(activeApplication)}
                  onRequestChanges={(reason) => handleRequestChanges(activeApplication, reason)} />
              </motion.div>
            </AnimatePresence>
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
              <button type="button" onClick={() => handleMessage(activeApplication)} className="inline-flex min-h-11 items-center gap-2 text-body-sm font-semibold text-brand">
                <MessageSquare className="h-4 w-4" />{t("applicationsManagement.card.message")}
              </button>
              {reviewEligibility[activeApplication._id]?.canReview ? (
                <button type="button" onClick={() => handleRateWorker(activeApplication)} className="inline-flex min-h-11 items-center gap-2 text-body-sm font-semibold text-amber-700">
                  <Star className="h-4 w-4" />{t("applicationsManagement.card.rateWorker")}
                </button>
              ) : reviewEligibility[activeApplication._id]?.existingReview ? <span className="text-caption text-emerald-700">{t("applicationsManagement.card.reviewSubmitted")}</span> : null}
            </div>
          </div>
        </Dialog>
      ) : null}
      {ratingTarget ? (
        <RatingDialog target={ratingTarget} onClose={() => setRatingTarget(null)} onSubmitted={async () => { await loadApplications(); onHistoryChange?.(); }} />
      ) : null}
      <OfferCancellationDialog rejectApplicationId={rejectAfterCancelApp} offerId={cancelOfferId} onClose={() => setCancelOfferId(null)} onDone={() => void loadApplications()} />
      {hireTarget?.offer && <HireChecklistDialog key={hireTarget.offer.id} title={t('applicationsManagement.confirmHire.title')} description={t('applicationsManagement.confirmHire.description', { name: getApplicantName(hireTarget, t('applicationsManagement.card.applicantFallback')), amount: formatCurrency(hireTarget.offer.amount) })} warning={t('applicationsManagement.confirmHire.warning')} onClose={() => setHireTarget(null)} onConfirm={async (checklist) => {
        await confirmOfferHire(hireTarget.offer!.id, checklist);
        toast.success(t('applicationsManagement.toast.workerHired'));
        await loadApplications(true); onHistoryChange?.();
      }} />}
      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title || ""}
        description={confirmAction?.description || ""}
        warning={confirmAction?.warning}
        confirmLabel={confirmAction?.confirmLabel}
        destructive={confirmAction?.destructive}
        onConfirm={handleConfirmDialogConfirm}
        onClose={() => setConfirmAction(null)}
      />

      {scheduleTarget ? (
        // On `ui`'s Dialog. This was the tallest hand-rolled modal in the app
        // -- date, time, mode, location and a four-row notes field -- with no
        // height cap and no scroll, so on a short or landscape phone the
        // Schedule button sat below the fold with no way to reach it.
        <Dialog
          open
          size="lg"
          title={
            scheduleTarget.nextInterview
              ? t("applicationsManagement.scheduleModal.updateTitle")
              : t("applicationsManagement.scheduleModal.scheduleTitle")
          }
          description={t("applicationsManagement.scheduleModal.subtitle", {
            name: getApplicantName(scheduleTarget, t("applicationsManagement.card.applicantFallback")),
            job: scheduleTarget.job?.title || t("applicationsManagement.scheduleModal.roleFallback"),
          })}
          onClose={() => setScheduleTarget(null)}
          closeDisabled={isScheduling}
        >
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <DateField
                    id="interview-date"
                    label={t("applicationsManagement.scheduleModal.dateLabel")}
                    minDate={new Date()}
                    value={scheduleForm.scheduledAt ? parseDateOnly(scheduleForm.scheduledAt.slice(0, 10)) : null}
                    onChange={(next) =>
                      setScheduleForm((current) => ({
                        ...current,
                        scheduledAt: `${next ? formatDateOnly(next) : ""}T${current.scheduledAt.slice(11, 16) || "09:00"}`,
                      }))
                    }
                  />
                </div>
                <div>
                  <label htmlFor="interview-time" className="block text-body-sm text-[#374151] mb-2">{t("applicationsManagement.scheduleModal.timeLabel")}</label>
                  <input
                    id="interview-time"
                    type="time"
                    value={scheduleForm.scheduledAt.slice(11, 16)}
                    onChange={(event) =>
                      setScheduleForm((current) => ({
                        ...current,
                        scheduledAt: `${current.scheduledAt.slice(0, 10) || formatDateOnly(new Date())}T${event.target.value}`,
                      }))
                    }
                    className="w-full h-11 rounded-xl border border-[#E5E7EB] px-3 text-body-sm text-[#111827]"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="interview-mode" className="block text-body-sm text-[#374151] mb-2">{t("applicationsManagement.scheduleModal.modeLabel")}</label>
                <select
                  id="interview-mode"
                  value={scheduleForm.mode}
                  onChange={(event) => setScheduleForm((current) => ({ ...current, mode: event.target.value }))}
                  className="w-full h-11 rounded-xl border border-[#E5E7EB] px-3 text-body-sm text-[#111827]"
                >
                  <option value="virtual">{t("applicationsManagement.scheduleModal.mode.virtual")}</option>
                  <option value="onsite">{t("applicationsManagement.scheduleModal.mode.onsite")}</option>
                  <option value="phone">{t("applicationsManagement.scheduleModal.mode.phone")}</option>
                  <option value="other">{t("applicationsManagement.scheduleModal.mode.other")}</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="interview-location" className="block text-body-sm text-[#374151] mb-2">{t("applicationsManagement.scheduleModal.locationLabel")}</label>
              <input
                id="interview-location"
                type="text"
                value={scheduleForm.location}
                onChange={(event) => setScheduleForm((current) => ({ ...current, location: event.target.value }))}
                className="w-full h-11 rounded-xl border border-[#E5E7EB] px-3 text-body-sm text-[#111827]"
                placeholder={t("applicationsManagement.scheduleModal.locationPlaceholder")}
              />
            </div>

            <div>
              <label htmlFor="interview-notes" className="block text-body-sm text-[#374151] mb-2">{t("applicationsManagement.scheduleModal.notesLabel")}</label>
              <textarea
                id="interview-notes"
                rows={4}
                value={scheduleForm.notes}
                onChange={(event) => setScheduleForm((current) => ({ ...current, notes: event.target.value }))}
                className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-body-sm text-[#111827]"
                placeholder={t("applicationsManagement.scheduleModal.notesPlaceholder")}
              />
            </div>

            <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => setScheduleTarget(null)}
                className="min-h-11 px-4 rounded-control border border-[#D1D5DB] text-body"
                disabled={isScheduling}
              >
                {t("applicationsManagement.scheduleModal.cancel")}
              </button>
              <button
                type="button"
                onClick={handleScheduleSubmit}
                className="inline-flex min-h-11 items-center justify-center px-4 rounded-control bg-brand text-white text-body font-medium transition hover:opacity-90 disabled:opacity-60"
                disabled={isScheduling}
              >
                {isScheduling
                  ? t("applicationsManagement.scheduleModal.saving")
                  : scheduleTarget.nextInterview
                  ? t("applicationsManagement.scheduleModal.updateTitle")
                  : t("applicationsManagement.scheduleModal.scheduleTitle")}
              </button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
