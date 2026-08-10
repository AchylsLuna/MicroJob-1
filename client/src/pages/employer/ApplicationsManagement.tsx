import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckSquare,
  Eye,
  Filter,
  Grid2X2,
  LayoutList,
  Mail,
  MessageSquare,
  Square,
  Star,
  User as UserIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "../../lib/toast";
import {
  getEmployerApplications,
  hideEmployerApplication,
  scheduleInterview,
  updateApplicationStatus,
  updateInterview,
  getEligibleReviews,
  type ApplicationStatus,
  type ReviewEligibilityItem,
} from "../../services/api";
import { ROUTES } from "../../utils/routes";
import { safeExternalUrl } from "../../utils/safeExternalUrl";
import { RatingDialog, type RatingTarget } from "../../components/reviews/RatingDialog";

const PIPELINE_STATUSES: ApplicationStatus[] = [
  "Applied",
  "Shortlisted",
  "Interview Scheduled",
  "Interviewed",
  "Offer Sent",
  "Hired",
  "Rejected",
];

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
  };
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

const formatDate = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const statusClasses: Record<ApplicationStatus, string> = {
  Applied: "bg-[#E2E8F0] text-[#334155]",
  Shortlisted: "bg-[#1C4D8D]/[0.08] text-[#1C4D8D]",
  "Interview Scheduled": "bg-[#1C4D8D]/10 text-[#1C4D8D]",
  Interviewed: "bg-[#FEF3C7] text-[#B45309]",
  "Offer Sent": "bg-[#FCE7F3] text-[#BE185D]",
  Hired: "bg-[#DCFCE7] text-[#15803D]",
  Rejected: "bg-[#FEE2E2] text-[#B91C1C]",
  Withdrawn: "bg-[#F3F4F6] text-[#6B7280]",
};

const getApplicantName = (application: EmployerApplication) =>
  `${application.applicant?.firstName || ""} ${application.applicant?.lastName || ""}`.trim() ||
  application.applicant?.email ||
  "Applicant";

const getApplicantInitials = (application: EmployerApplication) =>
  getApplicantName(application)
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
  onScheduleInterview,
  onOpenProfile,
  onMessage,
  reviewEligibility,
  onRate,
}: {
  application: EmployerApplication;
  selected: boolean;
  onToggleSelected: (applicationId: string) => void;
  onStatusChange: (applicationId: string, status: ApplicationStatus) => void;
  onHide: (applicationId: string) => void;
  onScheduleInterview: (application: EmployerApplication) => void;
  onOpenProfile: (application: EmployerApplication) => void;
  onMessage: (application: EmployerApplication) => void;
  reviewEligibility?: ReviewEligibilityItem;
  onRate: (application: EmployerApplication) => void;
}) {
  const resumeUrl = toAbsoluteAssetUrl(application.applicant?.resumeUrl || application.applicant?.resume);

  return (
    <div className="rounded-[16px] border border-[#E5E7EB] bg-white p-4 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onToggleSelected(application._id)}
          className="mt-1 text-[#64748B] hover:opacity-80"
          aria-label={selected ? "Deselect application" : "Select application"}
        >
          {selected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#1C4D8D]/[0.06] text-[#1C4D8D] flex items-center justify-center font-semibold">
              {getApplicantInitials(application)}
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[#111827] line-clamp-1">{getApplicantName(application)}</p>
              <p className="text-[12px] text-[#6B7280] line-clamp-1">{application.applicant?.email || "No email provided"}</p>
            </div>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusClasses[application.status]}`}>
          {application.status}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">
          {Number(application.match?.percentage || 0)}% Match
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          {Number(application.applicant?.rating?.averageRating || 0).toFixed(1)} ({application.applicant?.rating?.totalReviews || 0})
        </span>
      </div>

      <div>
        <p className="text-[14px] font-medium text-[#111827]">{application.job?.title || "Untitled role"}</p>
        <p className="text-[12px] text-[#6B7280] mt-1">Applied {formatDate(application.createdAt)}</p>
      </div>

      {application.nextInterview ? (
        <div className="rounded-[12px] border border-[#1C4D8D]/20 bg-[#1C4D8D]/[0.06] px-3 py-2 text-[12px] text-[#1C4D8D]">
          Next interview: {formatDate(application.nextInterview.scheduledAt)}
          {application.nextInterview.location ? ` · ${application.nextInterview.location}` : ""}
        </div>
      ) : null}

      {application.coverLetter ? (
        <p className="text-[13px] text-[#475569] line-clamp-3">{application.coverLetter}</p>
      ) : null}

      <div className="grid grid-cols-3 gap-2 text-center text-[12px]">
        <div className="rounded-[12px] bg-[#F8FAFC] border border-[#E5E7EB] px-2 py-2">
          <div className="text-[#111827] font-semibold">{application.applicant?.jobsApplied || 0}</div>
          <div className="text-[#6B7280] mt-1">Applied</div>
        </div>
        <div className="rounded-[12px] bg-[#F8FAFC] border border-[#E5E7EB] px-2 py-2">
          <div className="text-[#111827] font-semibold">{application.applicant?.projectsCompleted || 0}</div>
          <div className="text-[#6B7280] mt-1">Completed</div>
        </div>
        <div className="rounded-[12px] bg-[#F8FAFC] border border-[#E5E7EB] px-2 py-2">
          <div className="text-[#111827] font-semibold">{application.applicant?.successRate || "0%"}</div>
          <div className="text-[#6B7280] mt-1">Success</div>
        </div>
      </div>

      <div className="space-y-2">
        <select
          value={application.status}
          onChange={(event) => onStatusChange(application._id, event.target.value as ApplicationStatus)}
          className="w-full h-10 rounded-[12px] border border-[#E5E7EB] px-3 text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]"
        >
          {PIPELINE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onScheduleInterview(application)}
            className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-[#1C4D8D]/20 bg-[#1C4D8D]/[0.06] px-3 py-2 text-[12px] font-semibold text-[#1C4D8D]"
          >
            <Calendar className="w-4 h-4" />
            {application.nextInterview ? "Reschedule" : "Schedule"}
          </button>
          <button
            type="button"
            onClick={() => onHide(application._id)}
            className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] font-semibold text-[#B91C1C]"
          >
            <Eye className="w-4 h-4" />
            Hide
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenProfile(application)}
            className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-[#E5E7EB] px-3 py-2 text-[12px] font-semibold text-[#111827]"
          >
            <UserIcon className="w-4 h-4" />
            Profile
          </button>
          <button
            type="button"
            onClick={() => onMessage(application)}
            className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-[#E5E7EB] px-3 py-2 text-[12px] font-semibold text-[#111827]"
          >
            <MessageSquare className="w-4 h-4" />
            Message
          </button>
        </div>

        {resumeUrl ? (
          <a
            href={resumeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#1C4D8D]"
          >
            <Mail className="w-4 h-4" />
            View Resume
          </a>
        ) : null}
        {reviewEligibility?.canReview ? (
          <button type="button" onClick={() => onRate(application)} className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-amber-500 px-3 py-2 text-[12px] font-semibold text-white">
            <Star className="h-4 w-4" /> Rate Worker
          </button>
        ) : reviewEligibility?.existingReview ? (
          <p className="text-center text-[12px] font-semibold text-emerald-700">Review submitted</p>
        ) : null}
      </div>
    </div>
  );
}

export function ApplicationsManagement() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"board" | "table">("board");
  const [statusFilter, setStatusFilter] = useState<"all" | ApplicationStatus>("all");
  const [jobFilter, setJobFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
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

  const loadApplications = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [response, reviewResponse] = await Promise.all([
        getEmployerApplications({
          ...(statusFilter !== "all" ? { status: statusFilter } : {}),
          ...(jobFilter !== "all" ? { jobId: jobFilter } : {}),
          ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
        }),
        getEligibleReviews().catch(() => null),
      ]);
      const nextApplications = Array.isArray(response) ? (response as EmployerApplication[]) : [];
      setApplications(nextApplications.filter((item) => item.status !== "Withdrawn"));
      setReviewEligibility(Object.fromEntries((reviewResponse?.asEmployer || []).map((item) => [item.applicationId, item])));
      setSelectedIds((current) => current.filter((id) => nextApplications.some((item) => item._id === id)));
    } catch (error: any) {
      setLoadError(error?.message || "Failed to load applications.");
      setApplications([]);
    } finally {
      setIsLoading(false);
    }
  }, [jobFilter, searchTerm, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(loadApplications, 250);
    return () => window.clearTimeout(timer);
  }, [loadApplications]);

  const groupedApplications = useMemo(
    () =>
      PIPELINE_STATUSES.reduce<Record<ApplicationStatus, EmployerApplication[]>>((acc, status) => {
        acc[status] = applications.filter((application) => application.status === status);
        return acc;
      }, {} as Record<ApplicationStatus, EmployerApplication[]>),
    [applications],
  );

  const jobOptions = useMemo(() => {
    const unique = new Map<string, string>();
    applications.forEach((application) => {
      if (application.job?._id) {
        unique.set(application.job._id, application.job.title);
      }
    });
    return Array.from(unique.entries()).map(([id, title]) => ({ id, title }));
  }, [applications]);

  const visibleApplications = useMemo(
    () => (statusFilter === "all" ? applications : applications.filter((application) => application.status === statusFilter)),
    [applications, statusFilter],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const updateLocalApplication = (applicationId: string, updater: (item: EmployerApplication) => EmployerApplication) => {
    setApplications((current) => current.map((item) => (item._id === applicationId ? updater(item) : item)));
  };

  const handleStatusChange = async (applicationId: string, nextStatus: ApplicationStatus) => {
    try {
      await updateApplicationStatus(applicationId, nextStatus);
      updateLocalApplication(applicationId, (item) => ({ ...item, status: nextStatus }));
      toast.success(`Application moved to ${nextStatus}.`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update application status.");
    }
  };

  const handleHideApplications = async (applicationIds: string[]) => {
    if (applicationIds.length === 0) return;
    const results = await Promise.allSettled(applicationIds.map((applicationId) => hideEmployerApplication(applicationId)));
    const succeeded = applicationIds.filter((_, index) => results[index].status === "fulfilled");
    const failed = applicationIds.length - succeeded.length;
    setApplications((current) => current.filter((item) => !succeeded.includes(item._id)));
    setSelectedIds((current) => current.filter((id) => !succeeded.includes(id)));
    if (succeeded.length) toast.success(`${succeeded.length} application${succeeded.length === 1 ? "" : "s"} hidden.`);
    if (failed) toast.error(`${failed} application${failed === 1 ? "" : "s"} could not be hidden. Try again.`);
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
      if (succeeded.size) toast.success(`Updated ${succeeded.size} application${succeeded.size === 1 ? "" : "s"}.`);
      if (failed) toast.error(`${failed} application${failed === 1 ? "" : "s"} could not be updated and remain selected.`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update selected applications.");
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
    const name = getApplicantName(application);
    const params = new URLSearchParams({
      contact: `${application.applicant._id}::${application.job?._id || ""}`,
      startUser: application.applicant._id,
      jobId: application.job?._id || "",
      startName: name,
      draft: `Hi ${name}, I would like to discuss your application for ${application.job?.title || "this role"}.`,
    });
    navigate(`${ROUTES.employer.messages}?${params.toString()}`);
  };

  const handleRateWorker = (application: EmployerApplication) => {
    setRatingTarget({
      applicationId: application._id,
      name: getApplicantName(application),
      jobTitle: application.job?.title || "Completed job",
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
      toast.error("Interview date and time are required.");
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
      toast.success(scheduleTarget.nextInterview ? "Interview rescheduled." : "Interview scheduled.");
      setScheduleTarget(null);
      await loadApplications();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save interview schedule.");
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-semibold text-[#111827]">Applications</h1>
            <p className="text-[13px] text-[#6B7280] mt-1">Review applicants by stage, schedule interviews, and run bulk workflow actions safely.</p>
          </div>
          <div className="inline-flex items-center rounded-[12px] border border-[#E5E7EB] overflow-hidden self-start">
            <button
              type="button"
              onClick={() => setViewMode("board")}
              aria-pressed={viewMode === "board"}
              className={`inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold ${viewMode === "board" ? "bg-[#1C4D8D]/[0.06] text-[#1C4D8D]" : "bg-white text-[#475569]"}`}
            >
              <Grid2X2 className="w-4 h-4" />
              Board
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              aria-pressed={viewMode === "table"}
              className={`inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold border-l border-[#E5E7EB] ${viewMode === "table" ? "bg-[#1C4D8D]/[0.06] text-[#1C4D8D]" : "bg-white text-[#475569]"}`}
            >
              <LayoutList className="w-4 h-4" />
              Table
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_180px_180px] gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by applicant, email, or job title"
              aria-label="Search applications"
              className="w-full h-11 rounded-[12px] border border-[#E5E7EB] pl-9 pr-3 text-[13px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]"
            />
          </div>
          <select
            aria-label="Filter applications by stage"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-11 rounded-[12px] border border-[#E5E7EB] px-3 text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]"
          >
            <option value="all">All stages</option>
            {PIPELINE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter applications by job"
            value={jobFilter}
            onChange={(event) => setJobFilter(event.target.value)}
            className="h-11 rounded-[12px] border border-[#E5E7EB] px-3 text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]"
          >
            <option value="all">All jobs</option>
            {jobOptions.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        </div>

        {selectedIds.length > 0 ? (
          <div className="rounded-[14px] border border-[#1C4D8D]/20 bg-[#1C4D8D]/[0.06] px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="text-[13px] text-[#1C4D8D] font-medium">
              {selectedIds.length} application{selectedIds.length === 1 ? "" : "s"} selected
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                aria-label="Bulk application stage"
                value={bulkStatus}
                onChange={(event) => setBulkStatus(event.target.value as ApplicationStatus)}
                className="h-10 rounded-[10px] border border-[#1C4D8D]/20 px-3 text-[13px] text-[#111827]"
              >
                {PIPELINE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    Move to {status}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleBulkStatusChange}
                disabled={isBulkUpdating}
                className="h-10 rounded-[10px] bg-[#1C4D8D] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {isBulkUpdating ? "Updating..." : "Apply Bulk Status"}
              </button>
              <button
                type="button"
                onClick={() => handleHideApplications(selectedIds)}
                className="h-10 rounded-[10px] border border-[#FCA5A5] bg-white px-4 text-[13px] font-semibold text-[#B91C1C]"
              >
                Hide Selected
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {loadError ? (
        <div className="bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] px-4 py-3 rounded-[12px] text-[13px]">
          {loadError}
        </div>
      ) : null}

      {isLoading ? (
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-10 text-center text-[#6B7280]">
          Loading applications...
        </div>
      ) : null}

      {!isLoading && applications.length === 0 ? (
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-10 text-center text-[#6B7280]">
          No applications matched the current filters.
        </div>
      ) : null}

      {!isLoading && applications.length > 0 && viewMode === "board" ? (
        <div className="flex flex-col gap-4 pb-2 md:flex-row md:overflow-x-auto">
          {PIPELINE_STATUSES.map((status) => (
            <div key={status} className="w-full rounded-[18px] bg-[#F8FAFC] border border-[#E5E7EB] p-4 space-y-4 md:min-w-[320px] md:max-w-[320px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[16px] font-semibold text-[#111827]">{status}</h3>
                  <p className="text-[12px] text-[#6B7280] mt-1">{groupedApplications[status].length} applicant{groupedApplications[status].length === 1 ? "" : "s"}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusClasses[status]}`}>
                  {groupedApplications[status].length}
                </span>
              </div>

              <div className="space-y-3">
                {groupedApplications[status].length === 0 ? (
                  <div className="rounded-[14px] border border-dashed border-[#CBD5E1] bg-white px-4 py-8 text-center text-[13px] text-[#94A3B8]">
                    No applicants here.
                  </div>
                ) : (
                  groupedApplications[status].map((application) => (
                    <ApplicationCard
                      key={application._id}
                      application={application}
                      selected={selectedSet.has(application._id)}
                      onToggleSelected={handleToggleSelected}
                      onStatusChange={handleStatusChange}
                      onHide={(applicationId) => handleHideApplications([applicationId])}
                      onScheduleInterview={handleOpenSchedule}
                      onOpenProfile={handleOpenProfile}
                      onMessage={handleMessage}
                      reviewEligibility={reviewEligibility[application._id]}
                      onRate={handleRateWorker}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!isLoading && applications.length > 0 && viewMode === "table" ? (
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[#6B7280] border-b border-[#E5E7EB]">
                <th className="py-3 pr-4 font-medium">
                  <button type="button" onClick={handleToggleSelectAll} className="text-[#64748B] hover:opacity-80">
                    {visibleApplications.length > 0 && visibleApplications.every((application) => selectedSet.has(application._id)) ? (
                      <CheckSquare className="w-5 h-5" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </th>
                <th className="py-3 pr-4 font-medium">Applicant</th>
                <th className="py-3 pr-4 font-medium">Role</th>
                <th className="py-3 pr-4 font-medium">Stage</th>
                <th className="py-3 pr-4 font-medium">Interview</th>
                <th className="py-3 pr-4 font-medium">Applied</th>
                <th className="py-3 pr-4 font-medium">Resume</th>
                <th className="py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleApplications.map((application) => {
                const resumeUrl = toAbsoluteAssetUrl(application.applicant?.resumeUrl || application.applicant?.resume);
                return (
                  <tr key={application._id} className="border-b border-[#F3F4F6] align-top">
                    <td className="py-3 pr-4">
                      <button type="button" onClick={() => handleToggleSelected(application._id)} className="text-[#64748B] hover:opacity-80">
                        {selectedSet.has(application._id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                      </button>
                    </td>
                    <td className="py-3 pr-4 text-[#111827]">
                      <div className="font-medium">{getApplicantName(application)}</div>
                      <div className="text-[12px] text-[#6B7280] mt-1">{application.applicant?.email || "—"}</div>
                    </td>
                    <td className="py-3 pr-4 text-[#6B7280]">{application.job?.title || "—"}</td>
                    <td className="py-3 pr-4">
                      <select
                        value={application.status}
                        onChange={(event) => handleStatusChange(application._id, event.target.value as ApplicationStatus)}
                        className="h-10 rounded-[10px] border border-[#E5E7EB] px-3 text-[12px] text-[#111827]"
                      >
                        {PIPELINE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-4 text-[#6B7280]">
                      {application.nextInterview ? formatDate(application.nextInterview.scheduledAt) : "Not scheduled"}
                    </td>
                    <td className="py-3 pr-4 text-[#6B7280]">{formatDate(application.createdAt)}</td>
                    <td className="py-3 pr-4">
                      {resumeUrl ? (
                        <a href={resumeUrl} target="_blank" rel="noreferrer" className="text-[#1C4D8D] font-semibold">
                          View Resume
                        </a>
                      ) : (
                        <span className="text-[#9CA3AF]">No resume</span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenSchedule(application)}
                          className="px-3 py-2 rounded-[10px] border border-[#1C4D8D]/20 bg-[#1C4D8D]/[0.06] text-[#1C4D8D] font-semibold"
                        >
                          Interview
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenProfile(application)}
                          className="px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[#111827] font-semibold"
                        >
                          Profile
                        </button>
                        <button
                          type="button"
                          onClick={() => handleHideApplications([application._id])}
                          className="px-3 py-2 rounded-[10px] border border-[#FECACA] text-[#B91C1C] font-semibold"
                        >
                          Hide
                        </button>
                        {reviewEligibility[application._id]?.canReview ? (
                          <button type="button" onClick={() => handleRateWorker(application)} className="inline-flex items-center gap-1 rounded-[10px] bg-amber-500 px-3 py-2 font-semibold text-white">
                            <Star className="h-4 w-4" /> Rate
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {ratingTarget ? (
        <RatingDialog target={ratingTarget} onClose={() => setRatingTarget(null)} onSubmitted={loadApplications} />
      ) : null}

      {scheduleTarget ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-xl bg-white rounded-[18px] p-6 shadow-xl space-y-5">
            <div>
              <h3 className="text-[20px] font-semibold text-[#111827]">
                {scheduleTarget.nextInterview ? "Update Interview" : "Schedule Interview"}
              </h3>
              <p className="text-[13px] text-[#6B7280] mt-1">
                {getApplicantName(scheduleTarget)} · {scheduleTarget.job?.title || "Role"}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="interview-date" className="block text-[13px] text-[#374151] mb-2">Date and time</label>
                <input
                  id="interview-date"
                  type="datetime-local"
                  value={scheduleForm.scheduledAt}
                  onChange={(event) => setScheduleForm((current) => ({ ...current, scheduledAt: event.target.value }))}
                  className="w-full h-11 rounded-[12px] border border-[#E5E7EB] px-3 text-[13px] text-[#111827]"
                />
              </div>
              <div>
                <label htmlFor="interview-mode" className="block text-[13px] text-[#374151] mb-2">Mode</label>
                <select
                  id="interview-mode"
                  value={scheduleForm.mode}
                  onChange={(event) => setScheduleForm((current) => ({ ...current, mode: event.target.value }))}
                  className="w-full h-11 rounded-[12px] border border-[#E5E7EB] px-3 text-[13px] text-[#111827]"
                >
                  <option value="virtual">Virtual</option>
                  <option value="onsite">On-site</option>
                  <option value="phone">Phone</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="interview-location" className="block text-[13px] text-[#374151] mb-2">Location or meeting link</label>
              <input
                id="interview-location"
                type="text"
                value={scheduleForm.location}
                onChange={(event) => setScheduleForm((current) => ({ ...current, location: event.target.value }))}
                className="w-full h-11 rounded-[12px] border border-[#E5E7EB] px-3 text-[13px] text-[#111827]"
                placeholder="Google Meet link, office address, or call instructions"
              />
            </div>

            <div>
              <label htmlFor="interview-notes" className="block text-[13px] text-[#374151] mb-2">Notes</label>
              <textarea
                id="interview-notes"
                rows={4}
                value={scheduleForm.notes}
                onChange={(event) => setScheduleForm((current) => ({ ...current, notes: event.target.value }))}
                className="w-full rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-[13px] text-[#111827]"
                placeholder="Interview preparation, interviewer names, or custom instructions"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setScheduleTarget(null)}
                className="px-4 py-2 rounded-[10px] border border-[#D1D5DB] text-[14px]"
                disabled={isScheduling}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleScheduleSubmit}
                className="px-4 py-2 rounded-[10px] bg-[#1C4D8D] text-white text-[14px] font-medium disabled:opacity-60"
                disabled={isScheduling}
              >
                {isScheduling ? "Saving..." : scheduleTarget.nextInterview ? "Update Interview" : "Schedule Interview"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
