import { useEffect, useMemo, useState } from "react";
import { Heart, Clock, SlidersHorizontal } from "lucide-react";
import { toast } from "../../lib/toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getJobs, getProfile } from "../../services/api";
import { ROUTES } from "../../utils/routes";
import { useSavedJobs } from "../../hooks/useSavedJobs";
import { useAuth } from "../../contexts/AuthContext";

interface Job {
  id: string;
  title: string;
  company: string;
  companyLogo: string;
  applicants: number;
  type: "Full-Time" | "Part-Time" | "Contract" | "Project Work";
  workMode: "Remote" | "Hybrid" | "On-site";
  description: string;
  location: string;
  salary: string;
  postedDaysAgo: number;
  saved: boolean;
  category: string;
}

interface ApiJob {
  _id: string;
  title: string;
  description: string;
  location?: string;
  salary?: string | number;
  jobType?: string;
  createdAt?: string;
  category?: { name?: string } | string;
  applicants?: string[];
  requirements?: string[];
  jobPoster?: { firstName?: string; lastName?: string; email?: string };
}

const normalizeCadenceLabel = (raw: string) => {
  const source = raw.toLowerCase();
  if (source.includes("/mo") || source.includes("/month") || source.includes("per month")) return "/month";
  if (source.includes("/yr") || source.includes("/year") || source.includes("per year")) return "/year";
  if (source.includes("/week") || source.includes("per week")) return "/week";
  if (source.includes("/day") || source.includes("per day")) return "/day";
  if (source.includes("/hr") || source.includes("/hour") || source.includes("per hour")) return "/hour";
  return "";
};

export function FindJobs() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = (searchParams.get("q") || "").trim().toLowerCase();
  const { user } = useAuth();
  const { savedJobIds, toggleSavedJob } = useSavedJobs();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"recent" | "salary" | "applicants" | "nearest">("nearest");
  const [workerLocation, setWorkerLocation] = useState({
    province: "",
    city: "",
    barangay: "",
  });

  const sortLabels = {
    recent: "Most recent",
    salary: "Highest salary",
    applicants: "Most applicants",
    nearest: "Nearest to you",
  } as const;

  const handleSortChange = () => {
    setSortBy((prev) =>
      prev === "nearest"
        ? "recent"
        : prev === "recent"
        ? "salary"
        : prev === "salary"
        ? "applicants"
        : "nearest",
    );
  };

  const normalizeToken = (value?: string) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

  const locationScore = (jobLocation: string) => {
    const text = normalizeToken(jobLocation);
    if (!text) return 0;

    const province = normalizeToken(workerLocation.province);
    const city = normalizeToken(workerLocation.city);
    const barangay = normalizeToken(workerLocation.barangay);

    let score = 0;
    if (province && text.includes(province)) score += 1;
    if (city && text.includes(city)) score += 2;
    if (barangay && text.includes(barangay)) score += 3;
    return score;
  };

  const handleSaveJob = async (jobId: string) => {
    try {
      const nextSaved = await toggleSavedJob(jobId);
      toast.success(nextSaved ? "Job saved!" : "Job removed from saved");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update saved jobs.");
    }
  };

  const getJobTypeLabel = (jobType?: string): Job["type"] => {
    const normalized = (jobType || "").toLowerCase();
    switch (true) {
      case normalized.includes("part"):
        return "Part-Time";
      case normalized.includes("contract"):
        return "Contract";
      case normalized.includes("freelance") || normalized.includes("project"):
        return "Project Work";
      default:
        return "Full-Time";
    }
  };

  const getWorkModeLabel = (jobType?: string, location?: string, description?: string): Job["workMode"] => {
    const source = `${jobType || ""} ${location || ""} ${description || ""}`.toLowerCase();
    if (source.includes("remote")) return "Remote";
    if (source.includes("hybrid")) return "Hybrid";
    return "On-site";
  };

  const getPostedDays = (createdAt?: string) => {
    if (!createdAt) return 0;
    const created = new Date(createdAt).getTime();
    if (Number.isNaN(created)) return 0;
    const diff = Date.now() - created;
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  const getCompanyName = (poster?: ApiJob["jobPoster"]) => {
    if (!poster) return "MicroJobs";
    const name = `${poster.firstName || ""} ${poster.lastName || ""}`.trim();
    return name || poster.email || "MicroJobs";
  };

  const mapApiJob = (job: ApiJob): Job => {
    const companyName = getCompanyName(job.jobPoster);
    const categoryName =
      typeof job.category === "string" ? job.category : job.category?.name || "General";
    const salaryLabel = (() => {
      if (typeof job.salary === "number") return `₱${job.salary.toLocaleString()}`;
      const raw = `${job.salary || ""}`.trim();
      if (!raw) return "—";
      const numeric = Number.parseFloat(raw.replace(/,/g, "").replace(/[^0-9.]/g, ""));
      const cadence = normalizeCadenceLabel(raw);
      if (Number.isFinite(numeric) && numeric > 0) {
        return `₱${numeric.toLocaleString()}${cadence ? ` ${cadence}` : ""}`;
      }
      return raw
        .replace(/\$/g, "₱")
        .replace(/\bUSD\b/gi, "₱")
        .replace(/\s{2,}/g, " ")
        .trim();
    })();

    return {
      id: job._id,
      title: job.title,
      company: companyName,
      companyLogo: companyName.charAt(0) || "M",
      applicants: job.applicants?.length || 0,
      type: getJobTypeLabel(job.jobType),
      workMode: getWorkModeLabel(job.jobType, job.location, job.description),
      description: job.description,
      location: job.location || "Location not specified",
      salary: salaryLabel,
      postedDaysAgo: getPostedDays(job.createdAt),
      saved: false,
      category: categoryName,
    };
  };

  useEffect(() => {
    let isMounted = true;

    const loadWorkerLocation = async () => {
      try {
        const profile = await getProfile();
        if (!isMounted) return;
        setWorkerLocation({
          province: String((profile as any)?.province || ""),
          city: String((profile as any)?.city || user?.city || ""),
          barangay: String((profile as any)?.barangay || ""),
        });
      } catch {
        if (!isMounted) return;
        setWorkerLocation({
          province: "",
          city: String(user?.city || ""),
          barangay: "",
        });
      }
    };

    loadWorkerLocation();

    return () => {
      isMounted = false;
    };
  }, [user?.city]);

  useEffect(() => {
    let isMounted = true;
    const loadJobs = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await getJobs({ search: searchQuery || undefined, excludeOwn: true });
        if (!isMounted) return;
        const mapped = Array.isArray(data) ? data.map(mapApiJob) : [];
        setJobs(mapped);
      } catch (error: any) {
        if (!isMounted) return;
        setLoadError(error?.message || "Failed to load jobs.");
        setJobs([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadJobs();
    return () => {
      isMounted = false;
    };
  }, [searchQuery]);

  const getJobTypeColor = (type: string) => {
    switch (type) {
      case "Full-Time":
        return "bg-[#DFE8FF] text-[#365CCE]";
      case "Part-Time":
        return "bg-[#E0F2FE] text-[#0369A1]";
      case "Contract":
        return "bg-[#FFEDD5] text-[#C2410C]";
      case "Project Work":
        return "bg-[#FEF3C7] text-[#B45309]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const getWorkModeColor = (mode: Job["workMode"]) => {
    switch (mode) {
      case "Remote":
        return "bg-[#D1FAE5] text-[#047857]";
      case "Hybrid":
        return "bg-[#CCFBF1] text-[#0F766E]";
      case "On-site":
        return "bg-[#FFEDD5] text-[#C2410C]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const parseSalaryValue = (value: string | number) => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }
    const cleaned = value.replace(/[^0-9.]/g, "");
    const amount = Number.parseFloat(cleaned);
    return Number.isFinite(amount) ? amount : 0;
  };

  const getSalarySuffix = (salary: string) => {
    const normalized = salary.toLowerCase();
    if (normalized === "—") return "";
    if (normalized.includes("/")) return "";
    if (normalized.includes("per month") || normalized.includes("per year")) return "";
    return " /yr";
  };

  const getPostedLabel = (postedDaysAgo: number) => {
    if (postedDaysAgo <= 0) return "Today";
    if (postedDaysAgo === 1) return "1d ago";
    return `${postedDaysAgo}d ago`;
  };

  const jobsWithSavedState = jobs.map((job) => ({
    ...job,
    saved: savedJobIds.has(job.id),
  }));

  const filteredJobs = jobsWithSavedState.filter(job => {
    if (!searchQuery) {
      return true;
    }
    const combined = `${job.title} ${job.company} ${job.category}`.toLowerCase();
    return combined.includes(searchQuery);
  });

  // Sort jobs
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    switch (sortBy) {
      case "nearest":
        return locationScore(b.location) - locationScore(a.location);
      case "recent":
        return a.postedDaysAgo - b.postedDaysAgo;
      case "salary":
        return parseSalaryValue(b.salary) - parseSalaryValue(a.salary);
      case "applicants":
        return b.applicants - a.applicants;
      default:
        return 0;
    }
  });

  const nearestJobs = useMemo(
    () =>
      [...jobsWithSavedState]
        .filter((job) => locationScore(job.location) > 0)
        .sort((a, b) => locationScore(b.location) - locationScore(a.location))
        .slice(0, 3),
    [jobsWithSavedState, workerLocation.province, workerLocation.city, workerLocation.barangay],
  );

  return (
    <div className="max-w-[1341px] mx-auto space-y-5 font-sans">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[24px] leading-none font-semibold text-[#111827]">
          {sortedJobs.length} {sortedJobs.length === 1 ? "job" : "Jobs"} Found
        </p>
        <button
          type="button"
          onClick={handleSortChange}
          className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] border border-[#D1D5DB] bg-white text-[#4B5563] hover:bg-[#F9FAFB] transition-colors"
          title={`Sort by ${sortLabels[sortBy]}`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-[14px] font-semibold hidden sm:inline">{sortLabels[sortBy]}</span>
          <span className="text-[14px] font-semibold sm:hidden">Filters</span>
        </button>
      </div>

      {nearestJobs.length > 0 && (
        <div className="bg-[#EFF6FF] rounded-[14px] border border-[#BFDBFE] px-4 py-3">
          <p className="text-[13px] font-semibold text-[#1D4ED8]">Suggested near your location</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {nearestJobs.map((job) => (
              <button
                key={`near-${job.id}`}
                type="button"
                onClick={() => navigate(ROUTES.worker.jobDetails(job.id))}
                className="rounded-full bg-white border border-[#BFDBFE] px-3 py-1 text-[12px] text-[#1E3A8A] hover:bg-[#DBEAFE]"
              >
                {job.title} - {job.location}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="bg-white rounded-[18px] border border-[#E5E7EB] p-8 text-center text-[#6B7280]">
          Loading jobs...
        </div>
      )}

      {loadError && !isLoading && (
        <div className="bg-[#FEF2F2] rounded-[18px] border border-[#FECACA] p-6 text-center text-[#B91C1C]">
          {loadError}
        </div>
      )}

      {!isLoading && !loadError && sortedJobs.length === 0 && (
        <div className="bg-white rounded-[18px] border border-[#E5E7EB] p-8 text-center text-[#6B7280]">
          No Jobs Found. Try Another Search.
        </div>
      )}

      {!isLoading && !loadError && sortedJobs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {sortedJobs.map((job) => (
            <div
              key={job.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(ROUTES.worker.jobDetails(job.id))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(ROUTES.worker.jobDetails(job.id));
                }
              }}
              className="bg-white rounded-[18px] border border-[#E5E7EB] p-6 transition-all cursor-pointer hover:shadow-[0_8px_30px_rgba(15,23,42,0.06)] hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-14 h-14 rounded-[16px] bg-[#E7ECF8] text-[#365CCE] flex items-center justify-center text-[30px] font-semibold shrink-0">
                    {job.companyLogo || job.company.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-[18px] leading-tight text-[#111827] line-clamp-1">
                      {job.title}
                    </h3>
                    <p className="text-[16px] text-[#6B7280] mt-1 line-clamp-1">
                      {job.company} · {job.applicants} Applicants
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleSaveJob(job.id);
                  }}
                  className="text-[#9CA3AF] hover:text-[#EF4444] transition-colors"
                  title={job.saved ? "Remove from saved" : "Save job"}
                >
                  <Heart className={`w-6 h-6 ${job.saved ? "fill-[#EF4444] text-[#EF4444]" : ""}`} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <span className={`px-3 py-1 rounded-full text-[11px] font-semibold ${getJobTypeColor(job.type)}`}>
                  {job.type}
                </span>
                <span className={`px-3 py-1 rounded-full text-[11px] font-semibold ${getWorkModeColor(job.workMode)}`}>
                  {job.workMode}
                </span>
              </div>

              <p className="text-[14px] text-[#6B7280] leading-relaxed mt-4 line-clamp-2">
                {job.description}
              </p>

              <p className="mt-2 text-[12px] text-[#6B7280] line-clamp-1">{job.location}</p>

              <div className="flex items-center justify-between mt-5">
                <p className="text-[18px] font-bold text-[#111827]">
                  {job.salary}
                  <span className="text-[14px] font-medium text-[#6B7280]">{getSalarySuffix(job.salary)}</span>
                </p>
                <div className="flex items-center gap-1.5 text-[14px] text-[#6B7280]">
                  <Clock className="w-4 h-4" />
                  <span>{getPostedLabel(job.postedDaysAgo)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
