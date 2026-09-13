import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bookmark,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "../../lib/toast";
import { applyForJob, getJobDetails, startJobInquiry } from "../../services/api";
import { ROUTES } from "../../utils/routes";
import { useSavedJobs } from "../../hooks/useSavedJobs";
import { useAuth } from "../../hooks/useAuth";
import { formatCurrency, formatDate } from "../../lib/formatters";

type ApiJob = {
  _id: string;
  title: string;
  description: string;
  location?: string;
  salary?: string;
  jobType?: string;
  deadline?: string;
  createdAt?: string;
  responsibilities?: string[];
  requirements?: string[];
  skills?: string[];
  applicants?: string[];
  applicationStatus?: string | null;
  jobPoster?: { _id?: string; firstName?: string; lastName?: string; email?: string };
};

type JobDetailsLocationState = {
  isApplied?: boolean;
  status?: string;
};

type JobTypeKey = "shortTerm" | "sideHustle" | "recruiting" | "partTime" | "contract" | "projectWork" | "fullTime";

// These keys drive both the badge color lookup (getBadgeClass) and the
// translated label — comparisons must stay on the stable key, never on the
// translated display string, or badge coloring breaks whenever the active
// language isn't English.
const getJobTypeKey = (jobType?: string): JobTypeKey => {
  const normalized = (jobType || "").toLowerCase();
  if (normalized.includes("short")) return "shortTerm";
  if (normalized.includes("side hustle")) return "sideHustle";
  if (normalized.includes("recruit")) return "recruiting";
  if (normalized.includes("part")) return "partTime";
  if (normalized.includes("contract")) return "contract";
  if (normalized.includes("freelance") || normalized.includes("project")) return "projectWork";
  return "fullTime";
};

const getSalaryDisplay = (t: TFunction, salary?: string) => {
  const raw = `${salary || ""}`.trim();
  if (!raw) return { amount: "—", cadence: "" };

  const normalizedCadence = (() => {
    const source = raw.toLowerCase();
    if (source.includes("/mo") || source.includes("/month") || source.includes("per month")) return t("jobDetails.salaryCadence.perMonth");
    if (source.includes("/yr") || source.includes("/year") || source.includes("per year")) return t("jobDetails.salaryCadence.perYear");
    if (source.includes("/week") || source.includes("per week")) return t("jobDetails.salaryCadence.perWeek");
    if (source.includes("/day") || source.includes("per day")) return t("jobDetails.salaryCadence.perDay");
    if (source.includes("/hr") || source.includes("/hour") || source.includes("per hour")) return t("jobDetails.salaryCadence.perHour");
    return "";
  })();

  const numeric = Number.parseFloat(raw.replace(/,/g, "").replace(/[^0-9.]/g, ""));
  if (Number.isFinite(numeric) && numeric > 0) {
    return {
      amount: formatCurrency(numeric, { maximumFractionDigits: 0 }),
      cadence: normalizedCadence,
    };
  }

  const normalizedText = raw
    .replace(/\$/g, "₱")
    .replace(/\bUSD\b/gi, "₱")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { amount: normalizedText, cadence: "" };
};

const formatDeadline = (deadline?: string) => {
  if (!deadline) return null;
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return null;
  return formatDate(date);
};

const getBadgeClass = (kind: "experience" | "jobType" | "workMode", key: string) => {
  if (kind === "experience") {
    if (key === "senior") return "bg-[#F3E8FF] text-[#7E22CE]";
    if (key === "midLevel") return "bg-[#1C4D8D]/10 text-[#1C4D8D]";
    return "bg-[#DCFCE7] text-[#15803D]";
  }
  if (kind === "jobType") {
    if (key === "shortTerm") return "bg-[#E0F2FE] text-[#0369A1]";
    if (key === "sideHustle") return "bg-[#FEF3C7] text-[#B45309]";
    if (key === "recruiting") return "bg-[#DCFCE7] text-[#15803D]";
    if (key === "partTime") return "bg-[#1C4D8D]/[0.08] text-[#1C4D8D]";
    if (key === "contract") return "bg-[#FFEDD5] text-[#C2410C]";
    if (key === "projectWork") return "bg-[#FEF3C7] text-[#B45309]";
    return "bg-[#DFE8FF] text-[#1C4D8D]";
  }
  if (key === "remote") return "bg-[#D1FAE5] text-[#047857]";
  if (key === "hybrid") return "bg-[#CCFBF1] text-[#0F766E]";
  return "bg-[#FFEDD5] text-[#C2410C]";
};

type Props = {
  jobId?: string;
  /** Drops the two-column layout to a single stacked column and is meant to
   *  render inside a narrower host (e.g. the sticky pane in split-pane Find
   *  Jobs) rather than as a full page. */
  compact?: boolean;
  /** Replaces the apply action when this panel is used as a discovery preview. */
  action?: "apply" | "view";
};

export function JobDetailPanel({ jobId, compact = false, action = "apply" }: Props) {
  const { t } = useTranslation("worker");
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isJobSaved, toggleSavedJob } = useSavedJobs();
  const [isSaved, setIsSaved] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [job, setJob] = useState<ApiJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startingInquiry, setStartingInquiry] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadJob = async () => {
      if (!jobId) return;
      setIsLoading(true);
      setLoadError(null);
      setJob(null);
      setHasApplied(false);
      try {
        const data = await getJobDetails(jobId);
        if (!isMounted) return;
        const jobData = data as ApiJob;
        setJob(jobData);
        if (jobData.applicationStatus) setHasApplied(true);
        // Check if the current user has already applied by inspecting the applicants array
        if (user?.id && Array.isArray(jobData.applicants)) {
          const alreadyApplied = jobData.applicants.map(String).includes(String(user.id));
          if (alreadyApplied) setHasApplied(true);
        }
      } catch (error: any) {
        if (!isMounted) return;
        setLoadError(error?.message || t("jobDetails.loadError"));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadJob();
    return () => {
      isMounted = false;
    };
  }, [jobId, user?.id, t]);

  useEffect(() => {
    const state = (location.state as JobDetailsLocationState | null) || null;
    // Only set hasApplied from state if it's explicitly true (don't reset it to false)
    if (state?.isApplied) setHasApplied(true);
    setIsSaved(jobId ? isJobSaved(jobId) : false);
  }, [isJobSaved, jobId, location.state]);

  useEffect(() => {
    setIsSaved(jobId ? isJobSaved(jobId) : false);
  }, [isJobSaved, jobId]);

  const handleApply = async () => {
    if (!job?._id) return;
    if (job.applicationStatus === "Rejected") {
      toast.error(t("jobDetails.toast.applicationRejected"));
      return;
    }
    // Mirrors the server's own gate (getWorkerProfileRequirementError) so a
    // worker with no photo yet is sent straight to the fix rather than a
    // generic "application failed" toast — the server enforces this
    // regardless of what runs here.
    if (!user?.avatarUrl?.trim()) {
      toast.error(t("jobDetails.toast.profileIncomplete"));
      navigate(ROUTES.worker.settings);
      return;
    }
    try {
      await applyForJob(job._id);
      setHasApplied(true);
      toast.success(t("jobDetails.toast.applySuccess"));
    } catch (error: any) {
      if (error?.code === "WORKER_PROFILE_INCOMPLETE") {
        toast.error(t("jobDetails.toast.profileIncomplete"));
        navigate(ROUTES.worker.settings);
        return;
      }
      toast.error(error?.message || t("jobDetails.toast.applyFailed"));
    }
  };

  const handleViewJob = () => {
    if (!job?._id) return;
    const detailsUrl = `${window.location.origin}${ROUTES.worker.jobDetails(job._id)}`;
    window.open(detailsUrl, "_blank", "noopener,noreferrer");
  };

  const handleSave = async () => {
    if (!job?._id) return;
    try {
      const nextSaved = await toggleSavedJob(job._id);
      setIsSaved(nextSaved);
      toast.success(nextSaved ? t("jobDetails.toast.saveSuccess") : t("jobDetails.toast.removeSuccess"));
    } catch (error: any) {
      toast.error(error?.message || t("jobDetails.toast.saveFailed"));
    }
  };

  const handleMessageEmployer = async () => {
    if (!job?._id) {
      toast.error(t("jobDetails.toast.jobInfoMissing"));
      return;
    }
    if (startingInquiry) return;

    setStartingInquiry(true);
    try {
      // The server resolves the employer from the job post, so the inquiry always
      // lands in the worker <-> job poster thread instead of Admin/Support.
      const response = await startJobInquiry(job._id, { sendInitialMessage: false });
      const conversation = (response as any)?.data?.conversation ?? (response as any)?.conversation;
      const employerId = conversation?.otherUserId;
      if (!employerId) {
        toast.error(t("jobDetails.toast.employerInfoMissing"));
        return;
      }

      const employerName = conversation.otherUserName || t("jobDetails.employerFallback");
      const params = new URLSearchParams({
        contact: conversation.conversationId || `${employerId}::${job._id}`,
        startUser: employerId,
        jobId: conversation.jobId || job._id,
        startName: employerName,
        source: "job-details",
        draft: t("jobDetails.messageDraft", { employerName, jobTitle: job.title }),
      });
      navigate(`/worker/messages?${params.toString()}`);
    } catch (error: any) {
      toast.error(error?.message || t("jobDetails.toast.startConversationFailed"));
    } finally {
      setStartingInquiry(false);
    }
  };

  const handleCompanyProfile = () => {
    const employerId = typeof job?.jobPoster === "object" ? job.jobPoster?._id : null;
    if (!employerId) {
      toast.error(t("jobDetails.toast.employerProfileMissing"));
      return;
    }
    navigate(`${ROUTES.publicProfile(employerId)}?viewAs=employer`);
  };

  const companyName = job?.jobPoster
    ? `${job.jobPoster.firstName || ""} ${job.jobPoster.lastName || ""}`.trim() || job.jobPoster.email || ""
    : "";
  const hasEmployerName = Boolean(
    job?.jobPoster &&
      (`${job.jobPoster.firstName || ""} ${job.jobPoster.lastName || ""}`.trim() || job.jobPoster.email),
  );
  const isAdminViewer = ["admin", "superadmin"].includes(String(user?.role || "").toLowerCase());
  const companyLogo = companyName.charAt(0);
  const jobTypeKey = getJobTypeKey(job?.jobType);
  const jobTypeLabel = t(`jobDetails.jobTypeLabels.${jobTypeKey}`);
  const salaryDisplay = getSalaryDisplay(t, job?.salary);
  const skills = (job?.skills || []).map((skill) => skill.trim()).filter(Boolean);
  const requirements = (job?.requirements || []).map((item) => item.trim()).filter(Boolean);
  const responsibilities = (job?.responsibilities || []).map((item) => item.trim()).filter(Boolean);
  const deadlineLabel = formatDeadline(job?.deadline);

  return (
    <div className="space-y-6 font-sans">
      {isLoading && (
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-8 text-center text-[#6B7280]">
          {t("jobDetails.loading")}
        </div>
      )}

      {loadError && !isLoading && (
        <div className="bg-[#FEF2F2] rounded-[16px] border border-[#FECACA] p-6 text-[#B91C1C]">
          {loadError}
        </div>
      )}

      {!isLoading && !loadError && !job && (
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-8 text-center text-[#6B7280]">
          {t("jobDetails.notAvailable")}
        </div>
      )}

      {!isLoading && !loadError && job && (
        <div className={compact ? "space-y-6" : "grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6"}>
          <div className="space-y-6">
            <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-4 sm:p-8">
              <div className="flex items-start gap-4">
                {companyLogo ? (
                  <div className="w-[74px] h-[74px] rounded-[18px] bg-[#E7ECF8] text-[#1C4D8D] flex items-center justify-center text-[36px] font-semibold shrink-0">
                    {companyLogo}
                  </div>
                ) : null}
                <div className="min-w-0">
                  <h1 className="text-[28px] sm:text-[32px] leading-tight font-bold text-[#0F172A]">{job.title}</h1>
                  {hasEmployerName ? (
                    <button
                      onClick={handleCompanyProfile}
                      className="mt-2 flex items-center gap-2 text-[16px] font-semibold text-[#1C4D8D] hover:opacity-80"
                    >
                      <Building2 className="w-4 h-4" />
                      {companyName}
                    </button>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[15px] text-[#6B7280]">
                    {job.location?.trim() ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" />
                        {job.location}
                      </span>
                    ) : null}
                    {job?.jobType?.trim() ? (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1.5">
                          <Briefcase className="w-4 h-4" />
                          {jobTypeLabel}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              {job?.jobType ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className={`px-3 py-1 rounded-full text-[12px] font-semibold ${getBadgeClass("jobType", jobTypeKey)}`}>
                    {jobTypeLabel}
                  </span>
                </div>
              ) : null}

              {job.salary !== undefined && job.salary !== null && String(job.salary).trim() ? <div className="mt-6">
                <p className="text-[32px] sm:text-[40px] font-bold text-[#2FA66D] leading-none">
                  {salaryDisplay.amount}
                  {salaryDisplay.cadence && (
                    <span className="text-[18px] font-medium text-[#6B7280] ml-2">{salaryDisplay.cadence}</span>
                  )}
                </p>
              </div> : null}

              <div className="mt-8 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
                {isAdminViewer ? (
                  <div className="w-full rounded-[14px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-[13px] text-[#64748B]">
                    {t("jobDetails.adminReadOnly")}
                  </div>
                ) : (
                  <>
                    {action === "view" ? (
                      <button
                        type="button"
                        onClick={handleViewJob}
                        className="col-span-2 min-h-14 w-full flex-1 rounded-[14px] bg-[#1C4D8D] px-6 py-4 font-semibold text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:min-w-[240px]"
                      >
                        {t("jobDetails.viewJob")}
                      </button>
                    ) : job.applicationStatus === "Rejected" ? (
                      <div className="col-span-2 w-full rounded-[14px] border border-red-200 bg-red-50 px-6 py-4 text-center text-sm font-semibold text-red-700 sm:min-w-[240px]">
                        <p>{t("jobDetails.applicationRejected")}</p>
                      </div>
                    ) : hasApplied ? (
                      <button
                        disabled
                        className="col-span-2 flex min-h-14 w-full flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#D1FAE5] px-6 py-4 font-semibold text-[#065F46] sm:min-w-[240px]"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        {t("jobDetails.applicationSubmitted")}
                      </button>
                    ) : (
                      <button
                        onClick={handleApply}
                        className="col-span-2 min-h-14 w-full flex-1 rounded-[14px] bg-[#1C4D8D] px-6 py-4 font-semibold text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:min-w-[240px]"
                      >
                        {t("jobDetails.applyNow")}
                      </button>
                    )}

                    <button
                      onClick={handleMessageEmployer}
                      disabled={startingInquiry}
                      className="min-h-12 rounded-[14px] bg-[#1C4D8D]/[0.06] px-4 text-[#1C4D8D] transition-colors hover:opacity-90/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60 sm:h-16 sm:w-16 sm:px-0"
                      title={t("jobDetails.messageEmployerLabel")}
                      aria-label={t("jobDetails.messageEmployerLabel")}
                    >
                      <MessageCircle className="w-6 h-6" />
                    </button>
                    <button
                      onClick={handleSave}
                      className={`min-h-12 rounded-[14px] border px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:h-16 sm:w-16 sm:px-0 ${
                        isSaved
                          ? "bg-[#1C4D8D] text-white border-[#1C4D8D]"
                          : "bg-[#F9FAFB] text-[#374151] border-[#D1D5DB] hover:bg-[#F3F4F6]"
                      }`}
                      title={isSaved ? t("jobDetails.save.removeTitle") : t("jobDetails.save.saveTitle")}
                      aria-label={isSaved ? t("jobDetails.save.removeAria") : t("jobDetails.save.saveAria")}
                      aria-pressed={isSaved}
                    >
                      <Bookmark className={`w-6 h-6 ${isSaved ? "fill-current" : ""}`} />
                    </button>
                  </>
                )}
              </div>
            </section>

            {job.description?.trim() ? <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-8">
              <h2 className="text-[20px] font-bold text-[#111827] mb-4">{t("jobDetails.sections.description")}</h2>
              <p className="text-[16px] text-[#6B7280] leading-relaxed">{job.description}</p>
            </section> : null}

            {responsibilities.length ? <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-8">
              <h2 className="text-[20px] font-bold text-[#111827] mb-4">{t("jobDetails.sections.responsibilities")}</h2>
              <ul className="space-y-3">
                {responsibilities.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px] text-[#6B7280]">
                    <div className="w-2 h-2 rounded-full bg-[#1C4D8D] mt-3.5 shrink-0"></div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section> : null}

            {requirements.length ? <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-8">
              <h2 className="text-[20px] font-bold text-[#111827] mb-4">{t("jobDetails.sections.requirements")}</h2>
              <ul className="space-y-3">
                {requirements.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px] text-[#6B7280]">
                    <div className="w-2 h-2 rounded-full bg-[#1C4D8D] mt-3.5 shrink-0"></div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section> : null}
          </div>

          <aside className="space-y-6">
            {deadlineLabel || job?.jobType ? <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
              <h3 className="text-[18px] font-bold text-[#111827] mb-5">{t("jobDetails.overview.title")}</h3>
              <div className="space-y-5">
                {deadlineLabel ? <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-[14px] bg-[#FFF7ED] flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-[#EA580C]" />
                  </div>
                  <div>
                    <p className="text-[14px] text-[#6B7280]">{t("jobDetails.overview.deadline")}</p>
                    <p className="text-[16px] font-semibold text-[#111827]">{deadlineLabel}</p>
                  </div>
                </div> : null}

                {job?.jobType ? <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-[14px] bg-[#1C4D8D]/10 flex items-center justify-center shrink-0">
                    <Briefcase className="w-5 h-5 text-[#1C4D8D]" />
                  </div>
                  <div>
                    <p className="text-[14px] text-[#6B7280]">{t("jobDetails.overview.jobType")}</p>
                    <p className="text-[16px] font-semibold text-[#111827]">{jobTypeLabel}</p>
                  </div>
                </div> : null}
              </div>
            </section> : null}

            {skills.length ? <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
              <h3 className="text-[18px] font-bold text-[#111827] mb-5">{t("jobDetails.sections.requiredSkills")}</h3>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-4 py-2 rounded-full bg-[#E7ECF8] text-[#1C4D8D] text-[14px] font-semibold"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section> : null}
          </aside>
        </div>
      )}
    </div>
  );
}
