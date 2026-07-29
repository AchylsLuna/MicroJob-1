import { useCallback, useEffect, useMemo, useState } from "react";
import { Heart, Clock, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "../../lib/toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getJobs, getProfile } from "../../services/api";
import { ROUTES } from "../../utils/routes";
import { useSavedJobs } from "../../hooks/useSavedJobs";
import { useAuth } from "../../contexts/AuthContext";
import { Button, StatusState } from "../../components/ui";

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
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [reloadKey, setReloadKey] = useState(0);

  const sortLabels = {
    recent: "Most recent",
    salary: "Highest salary",
    applicants: "Most applicants",
    nearest: "Nearest to you",
  } as const;

  const normalizeToken = useCallback((value?: string) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim(), []);

  const locationScore = useCallback((jobLocation: string) => {
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
  }, [normalizeToken, workerLocation]);

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

  const mapApiJob = useCallback((job: ApiJob): Job => {
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
  }, []);

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
  }, [searchQuery, reloadKey, mapApiJob]);

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
    [jobsWithSavedState, locationScore],
  );

  const workerLocationLabel = [workerLocation.city, workerLocation.province].filter(Boolean).join(", ") || "Philippines";

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 font-sans">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#15376f] via-[#1C4D8D] to-[#2563eb] px-5 py-8 text-white shadow-[0_18px_50px_rgba(28,77,141,0.20)] sm:px-8 sm:py-10 lg:px-12 lg:py-12" aria-labelledby="job-search-heading">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-blue-400/10" aria-hidden="true" />
        <div className="relative max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">Job search</p>
          <h2 id="job-search-heading" className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">Find work that fits your skills and goals</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50/90 sm:text-base">Search verified opportunities, compare job details, and save the roles worth returning to.</p>
        </div>

        <form
          className="relative mt-7 grid gap-3 rounded-2xl bg-white/10 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.35fr)_auto]"
          role="search"
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="relative min-w-0">
            <span className="sr-only">Search jobs</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={searchParams.get("q") || ""}
              onChange={(event) => setSearchParams(event.target.value ? { q: event.target.value } : {})}
              placeholder="Job title, company, or category"
              className="h-14 w-full rounded-xl border-0 bg-white pl-12 pr-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <div className="flex min-h-14 min-w-0 items-center gap-3 rounded-xl bg-white px-4 text-slate-700" aria-label={`Search location: ${workerLocationLabel}`}>
            <MapPin className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
            <span className="truncate text-sm font-semibold">{workerLocationLabel}</span>
          </div>
          <button type="submit" className="min-h-14 rounded-xl bg-[#0f2f63] px-7 font-bold text-white shadow-sm transition hover:bg-[#0b244c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C4D8D]">Search</button>
        </form>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xl font-bold leading-tight text-slate-950 sm:text-2xl" aria-live="polite">
            {sortedJobs.length} {sortedJobs.length === 1 ? "job" : "jobs"} found
          </p>
          <p className="mt-1 text-sm text-slate-500">Opportunities are sorted by {sortLabels[sortBy].toLowerCase()}.</p>
        </div>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-600 shadow-sm focus-within:ring-2 focus-within:ring-blue-600">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Sort jobs</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="min-h-10 bg-transparent text-sm font-semibold outline-none" aria-label="Sort jobs">
            {Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      {nearestJobs.length > 0 && (
        <aside className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-4 sm:px-5">
          <p className="text-sm font-bold text-blue-800">Suggested near your location</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {nearestJobs.map((job) => (
              <button
                key={`near-${job.id}`}
                type="button"
                onClick={() => navigate(ROUTES.worker.jobDetails(job.id))}
                className="min-h-9 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-900 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                {job.title} - {job.location}
              </button>
            ))}
          </div>
        </aside>
      )}

      {isLoading && (
        <StatusState tone="loading" title="Loading jobs" description="Finding current opportunities for you." />
      )}

      {loadError && !isLoading && (
        <StatusState tone="error" title="Jobs could not be loaded" description={loadError} action={<Button onClick={() => setReloadKey((value) => value + 1)}>Try again</Button>} />
      )}

      {!isLoading && !loadError && sortedJobs.length === 0 && (
        <StatusState title={searchQuery ? "No jobs match your search" : "No jobs are available"} description={searchQuery ? "Try a different title, company, or category." : "Please check again later for new opportunities."} />
      )}

      {!isLoading && !loadError && sortedJobs.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
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
              className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:p-6"
              aria-label={`View ${job.title} at ${job.company}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xl font-bold text-blue-700 ring-1 ring-blue-100">
                    {job.companyLogo || job.company.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="line-clamp-1 text-lg font-bold leading-tight text-slate-950 group-hover:text-blue-700">
                      {job.title}
                    </h3>
                    <p className="mt-1 line-clamp-1 text-sm text-slate-500">
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
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  title={job.saved ? "Remove from saved" : "Save job"}
                  aria-label={job.saved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}
                  aria-pressed={job.saved}
                >
                  <Heart className={`h-5 w-5 ${job.saved ? "fill-rose-500 text-rose-500" : ""}`} />
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

              <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">
                {job.description}
              </p>

              <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="line-clamp-1">{job.location}</span></p>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <p className="min-w-0 truncate text-lg font-bold text-slate-950">
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
