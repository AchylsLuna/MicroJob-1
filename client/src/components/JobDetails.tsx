import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Users,
} from "lucide-react";
import { toast } from "../lib/toast";
import { applyForJob, getJobDetails } from "../services/api";
import { ROUTES } from "../utils/routes";
import { useSavedJobs } from "../hooks/useSavedJobs";
import { useAuth } from "../hooks/useAuth";

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
  jobPoster?: { _id?: string; firstName?: string; lastName?: string; email?: string };
};

type JobDetailsLocationState = {
  isApplied?: boolean;
  status?: string;
};

const getJobTypeLabel = (jobType?: string) => {
  const normalized = (jobType || "").toLowerCase();
  if (normalized.includes("part")) return "Part-Time";
  if (normalized.includes("contract")) return "Contract";
  if (normalized.includes("freelance") || normalized.includes("project")) return "Project Work";
  return "Full-Time";
};

const getWorkModeLabel = (job?: ApiJob) => {
  const source = `${job?.jobType || ""} ${job?.location || ""} ${job?.description || ""}`.toLowerCase();
  if (source.includes("remote")) return "Remote";
  if (source.includes("hybrid")) return "Hybrid";
  return "On-site";
};

const getExperienceLevel = (job?: ApiJob) => {
  const details = `${job?.title || ""} ${(job?.requirements || []).join(" ")}`.toLowerCase();
  if (/(senior|lead|principal|architect|manager|[5-9]\+?\s*years?)/.test(details)) {
    return "Senior";
  }
  if (/(mid|intermediate|[3-4]\+?\s*years?)/.test(details)) {
    return "Mid-Level";
  }
  return "Entry Level";
};

const getPostedLabel = (createdAt?: string) => {
  if (!createdAt) return "Posted recently";
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return "Posted recently";
  const postedDaysAgo = Math.max(0, Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24)));
  if (postedDaysAgo === 0) return "Posted today";
  if (postedDaysAgo === 1) return "Posted 1d ago";
  return `Posted ${postedDaysAgo}d ago`;
};

const getSalaryDisplay = (salary?: string) => {
  const raw = `${salary || ""}`.trim();
  if (!raw) return { amount: "—", cadence: "" };

  const normalizedCadence = (() => {
    const source = raw.toLowerCase();
    if (source.includes("/mo") || source.includes("/month") || source.includes("per month")) return "per month";
    if (source.includes("/yr") || source.includes("/year") || source.includes("per year")) return "per year";
    if (source.includes("/week") || source.includes("per week")) return "per week";
    if (source.includes("/day") || source.includes("per day")) return "per day";
    if (source.includes("/hr") || source.includes("/hour") || source.includes("per hour")) return "per hour";
    return "";
  })();

  const numeric = Number.parseFloat(raw.replace(/,/g, "").replace(/[^0-9.]/g, ""));
  if (Number.isFinite(numeric) && numeric > 0) {
    return {
      amount: `₱${numeric.toLocaleString()}`,
      cadence: normalizedCadence || "per year",
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
  if (!deadline) return "Not specified";
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return "Not specified";
  return date.toLocaleDateString("en-US");
};

const getBadgeClass = (kind: "experience" | "jobType" | "workMode", value: string) => {
  if (kind === "experience") {
    if (value === "Senior") return "bg-[#F3E8FF] text-[#7E22CE]";
    if (value === "Mid-Level") return "bg-[#1C4D8D]/10 text-[#1C4D8D]";
    return "bg-[#DCFCE7] text-[#15803D]";
  }
  if (kind === "jobType") {
    if (value === "Part-Time") return "bg-[#1C4D8D]/[0.08] text-[#1C4D8D]";
    if (value === "Contract") return "bg-[#FFEDD5] text-[#C2410C]";
    if (value === "Project Work") return "bg-[#FEF3C7] text-[#B45309]";
    return "bg-[#DFE8FF] text-[#1C4D8D]";
  }
  if (value === "Remote") return "bg-[#D1FAE5] text-[#047857]";
  if (value === "Hybrid") return "bg-[#CCFBF1] text-[#0F766E]";
  return "bg-[#FFEDD5] text-[#C2410C]";
};

export function JobDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobId } = useParams();
  const { user } = useAuth();
  const { isJobSaved, toggleSavedJob } = useSavedJobs();
  const [isSaved, setIsSaved] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [job, setJob] = useState<ApiJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadJob = async () => {
      if (!jobId) return;
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await getJobDetails(jobId);
        if (!isMounted) return;
        const jobData = data as ApiJob;
        setJob(jobData);
        // Check if the current user has already applied by inspecting the applicants array
        if (user?.id && Array.isArray(jobData.applicants)) {
          const alreadyApplied = jobData.applicants.map(String).includes(String(user.id));
          if (alreadyApplied) setHasApplied(true);
        }
      } catch (error: any) {
        if (!isMounted) return;
        setLoadError(error?.message || "Failed to load job details.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadJob();
    return () => {
      isMounted = false;
    };
  }, [jobId, user?.id]);

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
    try {
      await applyForJob(job._id);
      setHasApplied(true);
      toast.success("Application submitted successfully!");
    } catch (error: any) {
      toast.error(error?.message || "Failed to apply.");
    }
  };

  const handleSave = async () => {
    if (!job?._id) return;
    try {
      const nextSaved = await toggleSavedJob(job._id);
      setIsSaved(nextSaved);
      toast.success(nextSaved ? "Job saved successfully!" : "Job removed from saved");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update saved jobs.");
    }
  };

  const handleMessageEmployer = () => {
    if (!job?._id) {
      toast.error("Job information not available.");
      return;
    }

    const employerId = typeof job.jobPoster === "object" && job.jobPoster?._id ? job.jobPoster._id : null;
    if (!employerId) {
      toast.error("Employer information not available.");
      return;
    }

    const employerName = `${job.jobPoster?.firstName || ""} ${job.jobPoster?.lastName || ""}`.trim() || "Employer";
    const initialMessage = `Hi ${employerName}, I'm interested in the ${job.title} position. I would like to discuss this opportunity further.`;
    const params = new URLSearchParams({
      contact: `${employerId}::${job._id}`,
      startUser: employerId,
      jobId: job._id,
      startName: employerName,
      source: "job-details",
      draft: initialMessage,
    });
    navigate(`/worker/messages?${params.toString()}`);
  };

  const handleCompanyProfile = () => {
    const employerId = typeof job?.jobPoster === "object" ? job.jobPoster?._id : null;
    if (!employerId) {
      toast.error("Employer profile is not available for this job.");
      return;
    }
    navigate(`${ROUTES.publicProfile(employerId)}?viewAs=employer`);
  };

  const companyName = job?.jobPoster
    ? `${job.jobPoster.firstName || ""} ${job.jobPoster.lastName || ""}`.trim() || job.jobPoster.email || "MicroJobs"
    : "MicroJobs";
  const isAdminViewer = ["admin", "superadmin"].includes(String(user?.role || "").toLowerCase());
  const companyLogo = companyName.charAt(0) || "M";
  const jobTypeLabel = getJobTypeLabel(job?.jobType);
  const workModeLabel = getWorkModeLabel(job || undefined);
  const experienceLevel = getExperienceLevel(job || undefined);
  const salaryDisplay = getSalaryDisplay(job?.salary);
  const fallbackSkills = ["Web Development", "Mobile Apps", "Cloud Infrastructure", "DevOps"];
  const skills = job?.skills?.length ? job.skills : fallbackSkills;

  return (
    <div className="max-w-[1341px] mx-auto space-y-6 font-sans">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-[14px] text-[#6B7280] hover:text-[#111827] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to jobs
      </button>

      {isLoading && (
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-8 text-center text-[#6B7280]">
          Loading job details...
        </div>
      )}

      {loadError && !isLoading && (
        <div className="bg-[#FEF2F2] rounded-[16px] border border-[#FECACA] p-6 text-[#B91C1C]">
          {loadError}
        </div>
      )}

      {!isLoading && !loadError && !job && (
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-8 text-center text-[#6B7280]">
          Job details are not available.
        </div>
      )}

      {!isLoading && !loadError && job && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
          <div className="space-y-6">
            <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-4 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="w-[74px] h-[74px] rounded-[18px] bg-[#E7ECF8] text-[#1C4D8D] flex items-center justify-center text-[36px] font-semibold shrink-0">
                  {companyLogo}
                </div>
                <div className="min-w-0">
                  <h1 className="text-[28px] sm:text-[32px] leading-tight font-bold text-[#0F172A]">{job.title}</h1>
                  <button
                    onClick={handleCompanyProfile}
                    className="mt-2 flex items-center gap-2 text-[16px] font-semibold text-[#1C4D8D] hover:opacity-80"
                  >
                    <Building2 className="w-4 h-4" />
                    {companyName}
                  </button>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[15px] text-[#6B7280]">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      {job.location || "Remote"}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4" />
                      {jobTypeLabel}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {getPostedLabel(job.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className={`px-3 py-1 rounded-full text-[12px] font-semibold ${getBadgeClass("experience", experienceLevel)}`}>
                  {experienceLevel}
                </span>
                <span className={`px-3 py-1 rounded-full text-[12px] font-semibold ${getBadgeClass("jobType", jobTypeLabel)}`}>
                  {jobTypeLabel}
                </span>
                <span className={`px-3 py-1 rounded-full text-[12px] font-semibold ${getBadgeClass("workMode", workModeLabel)}`}>
                  {workModeLabel}
                </span>
              </div>

              <div className="mt-6">
                <p className="text-[32px] sm:text-[40px] font-bold text-[#2FA66D] leading-none">
                  {salaryDisplay.amount}
                  {salaryDisplay.cadence && (
                    <span className="text-[18px] font-medium text-[#6B7280] ml-2">{salaryDisplay.cadence}</span>
                  )}
                </p>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
                {isAdminViewer ? (
                  <div className="w-full rounded-[14px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-[13px] text-[#64748B]">
                    Read-only admin view. Use Admin Job Monitoring to delete this job.
                  </div>
                ) : (
                  <>
                    {hasApplied ? (
                      <button
                        disabled
                        className="col-span-2 flex min-h-14 w-full flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#D1FAE5] px-6 py-4 font-semibold text-[#065F46] sm:min-w-[240px]"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        Application Submitted
                      </button>
                    ) : (
                      <button
                        onClick={handleApply}
                        className="col-span-2 min-h-14 w-full flex-1 rounded-[14px] bg-[#1C4D8D] px-6 py-4 font-semibold text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:min-w-[240px]"
                      >
                        Apply Now
                      </button>
                    )}

                    <button
                      onClick={handleMessageEmployer}
                      className="min-h-12 rounded-[14px] bg-[#1C4D8D]/[0.06] px-4 text-[#1C4D8D] transition-colors hover:opacity-90/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:h-16 sm:w-16 sm:px-0"
                      title="Message employer"
                      aria-label="Message employer"
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
                      title={isSaved ? "Remove from saved" : "Save job"}
                      aria-label={isSaved ? "Remove job from saved jobs" : "Save job"}
                      aria-pressed={isSaved}
                    >
                      <Bookmark className={`w-6 h-6 ${isSaved ? "fill-current" : ""}`} />
                    </button>
                  </>
                )}
              </div>
            </section>

            <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-8">
              <h2 className="text-[20px] font-bold text-[#111827] mb-4">Job Description</h2>
              <p className="text-[16px] text-[#6B7280] leading-relaxed">
                {job.description || "No description provided."}
              </p>
            </section>

            <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-8">
              <h2 className="text-[20px] font-bold text-[#111827] mb-4">Responsibilities</h2>
              <ul className="space-y-3">
                {(job.responsibilities?.length ? job.responsibilities : ["No responsibilities provided."]).map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px] text-[#6B7280]">
                    <div className="w-2 h-2 rounded-full bg-[#1C4D8D] mt-3.5 shrink-0"></div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-8">
              <h2 className="text-[20px] font-bold text-[#111827] mb-4">Requirements</h2>
              <ul className="space-y-3">
                {(job.requirements?.length ? job.requirements : ["No requirements provided."]).map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px] text-[#6B7280]">
                    <div className="w-2 h-2 rounded-full bg-[#1C4D8D] mt-3.5 shrink-0"></div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
              <h3 className="text-[18px] font-bold text-[#111827] mb-5">Job Overview</h3>
              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-[14px] bg-[#FFF7ED] flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-[#EA580C]" />
                  </div>
                  <div>
                    <p className="text-[14px] text-[#6B7280]">Application Deadline</p>
                    <p className="text-[16px] font-semibold text-[#111827]">{formatDeadline(job.deadline)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-[14px] bg-[#F3E8FF] flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-[#7E22CE]" />
                  </div>
                  <div>
                    <p className="text-[14px] text-[#6B7280]">Total Applicants</p>
                    <p className="text-[16px] font-semibold text-[#111827]">{job.applicants?.length || 0} applicants</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-[14px] bg-[#DCFCE7] flex items-center justify-center shrink-0">
                    <BadgeCheck className="w-5 h-5 text-[#15803D]" />
                  </div>
                  <div>
                    <p className="text-[14px] text-[#6B7280]">Experience Level</p>
                    <p className="text-[16px] font-semibold text-[#111827]">{experienceLevel}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-[14px] bg-[#1C4D8D]/10 flex items-center justify-center shrink-0">
                    <Briefcase className="w-5 h-5 text-[#1C4D8D]" />
                  </div>
                  <div>
                    <p className="text-[14px] text-[#6B7280]">Job Type</p>
                    <p className="text-[16px] font-semibold text-[#111827]">{jobTypeLabel}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
              <h3 className="text-[18px] font-bold text-[#111827] mb-5">Required Skills</h3>
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
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
