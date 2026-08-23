import { useMemo, useState } from "react";
import {
  Bookmark,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  ExternalLink,
  MapPin,
  Trash2,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "../../lib/toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ROUTES } from "../../utils/routes";
import { useSavedJobs } from "../../hooks/useSavedJobs";
import type { SavedJobRecord } from "../../services/api";
import { formatCurrency, formatDate } from "../../lib/formatters";

type SavedJobView = {
  id: string;
  title: string;
  company: string;
  salary: string;
  description: string;
  location: string;
  workMode: "Remote" | "Hybrid" | "On-site";
  postedLabel: string;
  applicants: number;
  logo: string;
  deadline: string;
  requirements: string[];
};

// Maps the internal work-mode enum to a translation key. A factory (not a
// plain module-level constant) so it can be recomputed via
// useMemo(() => getWorkModeLabels(t), [t]) whenever the active language
// changes — a constant built once at import time would freeze stale text.
const WORK_MODE_KEYS: Record<SavedJobView["workMode"], string> = {
  Remote: "remote",
  Hybrid: "hybrid",
  "On-site": "onSite",
};

function getWorkModeLabels(t: TFunction): Record<SavedJobView["workMode"], string> {
  const labels = {} as Record<SavedJobView["workMode"], string>;
  for (const [mode, key] of Object.entries(WORK_MODE_KEYS) as Array<[SavedJobView["workMode"], string]>) {
    labels[mode] = t(`savedJobs.workMode.${key}`);
  }
  return labels;
}

const getCompanyName = (job: any) => {
  const poster = job?.jobPoster;
  if (!poster) return "MicroJobs";
  const companyName = String(poster.companyName || "").trim();
  if (companyName) return companyName;
  const name = `${poster.firstName || ""} ${poster.lastName || ""}`.trim();
  return name || poster.email || "MicroJobs";
};

const getWorkMode = (job: any): SavedJobView["workMode"] => {
  const source = `${job?.jobType || ""} ${job?.location || ""} ${job?.description || ""}`.toLowerCase();
  if (source.includes("remote")) return "Remote";
  if (source.includes("hybrid")) return "Hybrid";
  return "On-site";
};

const formatSalary = (t: TFunction, value?: string | number) => {
  if (typeof value === "number") return formatCurrency(value, { maximumFractionDigits: 0 });
  const raw = String(value || "").trim();
  if (!raw) return t("savedJobs.card.salaryFallback");
  return raw.replace(/\$/g, "PHP ").replace(/\bUSD\b/gi, "PHP");
};

const formatDeadline = (t: TFunction, value?: string) => {
  if (!value) return t("savedJobs.card.deadlineFallback");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return t("savedJobs.card.deadlineFallback");
  return formatDate(parsed);
};

const formatPostedLabel = (t: TFunction, value?: string) => {
  if (!value) return t("savedJobs.card.savedRecently");
  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) return t("savedJobs.card.savedRecently");
  const diffDays = Math.max(0, Math.floor((Date.now() - parsed) / (1000 * 60 * 60 * 24)));
  if (diffDays === 0) return t("savedJobs.card.today");
  return t("savedJobs.card.daysAgo", { count: diffDays });
};

const mapSavedJob = (t: TFunction, record: SavedJobRecord): SavedJobView | null => {
  const job = record.job as any;
  if (!job?._id) return null;

  const company = getCompanyName(job);
  const requirements = Array.isArray(job.requirements)
    ? job.requirements
    : Array.isArray(job.skills)
      ? job.skills
      : [];

  return {
    id: String(job._id),
    title: String(job.title || t("savedJobs.card.untitledJob")),
    company,
    salary: formatSalary(t, job.salary),
    description: String(job.description || t("savedJobs.card.noDescription")),
    location: String(job.location || t("savedJobs.card.remoteLocation")),
    workMode: getWorkMode(job),
    postedLabel: formatPostedLabel(t, job.createdAt || record.savedAt || record.createdAt),
    applicants: Array.isArray(job.applicants) ? job.applicants.length : 0,
    logo: company.charAt(0).toUpperCase() || "M",
    deadline: formatDeadline(t, job.deadline),
    requirements,
  };
};

export function SavedJobs() {
  const { t } = useTranslation("worker");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = (searchParams.get("q") || "").trim().toLowerCase();
  const { savedJobs, isLoading, error, removeSavedJob } = useSavedJobs();
  const [filter, setFilter] = useState<"all" | "Remote" | "Hybrid" | "On-site">("all");

  const workModeLabels = useMemo(() => getWorkModeLabels(t), [t]);

  const jobs = useMemo(
    () => savedJobs.map((record) => mapSavedJob(t, record)).filter((job): job is SavedJobView => Boolean(job)),
    [savedJobs, t],
  );

  const filteredJobs = useMemo(
    () =>
      jobs.filter((job) => {
        if (filter !== "all" && job.workMode !== filter) return false;
        if (!searchQuery) return true;
        const combined = `${job.title} ${job.company} ${job.location} ${job.requirements.join(" ")}`.toLowerCase();
        return combined.includes(searchQuery);
      }),
    [filter, jobs, searchQuery],
  );

  const handleUnsave = async (jobId: string) => {
    try {
      await removeSavedJob(jobId);
      toast.success(t("savedJobs.toast.removeSuccess"));
    } catch (removeError: any) {
      toast.error(removeError?.message || t("savedJobs.toast.removeFailed"));
    }
  };

  const handleOpenDetails = (jobId: string) => {
    navigate(ROUTES.worker.jobDetails(jobId));
  };

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[14px] text-[#6B7280]">
            {t("savedJobs.summary", { count: jobs.length })}
          </p>
          <h1 className="text-[28px] font-semibold text-[#111827] mt-1">{t("savedJobs.title")}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["all", "Remote", "Hybrid", "On-site"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              aria-pressed={filter === item}
              className={`px-4 py-2 rounded-[10px] text-[14px] font-medium transition-all ${
                filter === item
                  ? "bg-[#1C4D8D] text-white shadow-md"
                  : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
              }`}
            >
              {item === "all" ? t("savedJobs.filters.all") : workModeLabels[item]}
            </button>
          ))}
        </div>
      </div>

      {isLoading && jobs.length === 0 ? (
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-10 text-center text-[#6B7280]">
          {t("savedJobs.loading")}
        </div>
      ) : null}

      {error ? (
        <div className="bg-[#FEF2F2] rounded-[16px] border border-[#FECACA] p-4 text-[14px] text-[#B91C1C]">
          {error}
        </div>
      ) : null}

      {!isLoading && filteredJobs.length === 0 ? (
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-12 text-center">
          <Bookmark className="w-16 h-16 text-[#D1D5DB] mx-auto mb-4" />
          <h3 className="text-[18px] font-semibold text-[#111827] mb-2">{t("savedJobs.emptyState.title")}</h3>
          <p className="text-[14px] text-[#6B7280] mb-6">
            {jobs.length === 0
              ? t("savedJobs.emptyState.descriptionNoJobs")
              : t("savedJobs.emptyState.descriptionNoMatch")}
          </p>
          <button
            onClick={() => navigate(ROUTES.worker.findJobs)}
            className="inline-flex items-center gap-2 bg-[#1C4D8D] text-white px-5 py-3 rounded-[12px] font-semibold hover:opacity-90 transition-colors"
          >
            <Briefcase className="w-4 h-4" />
            {t("savedJobs.emptyState.browseJobs")}
          </button>
        </div>
      ) : null}

      {filteredJobs.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 hover:shadow-lg hover:border-[#1C4D8D] transition-all duration-300 group"
            >
              <div className="flex items-start justify-between mb-4 gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-14 h-14 rounded-[14px] bg-[#1C4D8D] flex items-center justify-center text-white font-bold text-[16px] shadow-md flex-shrink-0">
                    {job.logo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[18px] font-bold text-[#111827] mb-1 group-hover:opacity-80 transition-colors line-clamp-1">
                      {job.title}
                    </h3>
                    <p className="text-[13px] text-[#6B7280] flex items-center gap-1 mb-2 line-clamp-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {job.company}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-3 py-1.5 rounded-[8px] text-[11px] font-semibold ${
                          job.workMode === "Remote"
                            ? "bg-[#1C4D8D]/10 text-[#1C4D8D]"
                            : job.workMode === "Hybrid"
                              ? "bg-[#FEF3C7] text-[#92400E]"
                              : "bg-[#D1FAE5] text-[#065F46]"
                        }`}
                      >
                        {workModeLabels[job.workMode]}
                      </span>
                      <div className="flex items-center gap-1 text-[12px] text-[#6B7280]">
                        <MapPin className="w-3.5 h-3.5" />
                        {job.location}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnsave(job.id)}
                  className="p-2 hover:bg-[#FEE2E2] rounded-lg transition-colors"
                  title={t("savedJobs.card.removeTitle")}
                  aria-label={t("savedJobs.card.removeAria", { title: job.title })}
                >
                  <Trash2 className="w-5 h-5 text-[#6B7280] hover:text-[#EF4444]" />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-[#10B981]" />
                <p className="text-[16px] font-bold text-[#10B981]">{job.salary}</p>
              </div>

              <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4 line-clamp-2">{job.description}</p>

              <div className="mb-4 flex flex-wrap gap-2">
                {(job.requirements.length ? job.requirements : [t("savedJobs.card.generalRequirement")])
                  .slice(0, 4)
                  .map((requirement) => (
                    <span
                      key={`${job.id}-${requirement}`}
                      className="px-3 py-1.5 bg-[#F3F4F6] text-[#111827] rounded-[8px] text-[11px] font-medium"
                    >
                      {requirement}
                    </span>
                  ))}
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-[#E5E7EB] text-[12px] text-[#6B7280]">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {job.postedLabel}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {t("savedJobs.card.applicants", { count: job.applicants })}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {t("savedJobs.card.deadlineLabel", { deadline: job.deadline })}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => handleOpenDetails(job.id)}
                  className="brand-primary-interactive flex flex-1 items-center justify-center gap-2 rounded-[10px] px-4 py-3 font-semibold hover:shadow-lg"
                >
                  <Briefcase className="w-4 h-4" />
                  {t("savedJobs.card.viewJob")}
                </button>
                <button
                  onClick={() => handleOpenDetails(job.id)}
                  className="px-4 py-3 border border-[#E5E7EB] text-[#6B7280] font-semibold rounded-[10px] hover:bg-[#F9FAFB] transition-colors"
                  title={t("savedJobs.card.viewDetailsTitle")}
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
