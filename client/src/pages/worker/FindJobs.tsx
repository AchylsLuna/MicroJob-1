import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "../../lib/toast";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getCategories, getProfile, updateJobPreferences } from "../../services/api";
import { useWorkerJobs } from "../../hooks/queries/useWorkerJobs";
import { useRecommendedJobs } from "../../hooks/queries/useRecommendedJobs";
import { Skeleton } from "../../components/ui/Skeleton";
import { ROUTES } from "../../utils/routes";
import { useSavedJobs } from "../../hooks/useSavedJobs";
import { useAuth } from "../../contexts/AuthContext";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { Button, StatusState } from "../../components/ui";
import { JobListRow } from "../../components/job/JobListRow";
import { JobDetailPanel } from "../../components/job/JobDetailPanel";
import { FilterPill, type FilterOption } from "../../components/job/FilterPill";
import { toJobCardData } from "../../components/job/jobCardModel";
import { formatCurrency } from "../../lib/formatters";

interface Job {
  id: string;
  title: string;
  company: string;
  applicants: number;
  type: "Short-term" | "Side hustle" | "Recruiting" | "Full-Time" | "Part-Time" | "Contract" | "Project Work";
  location: string;
  salary: string;
  postedDaysAgo: number;
  saved: boolean;
  category: string;
  categoryId?: string;
  skills: string[];
  urgent: boolean;
  highlighted: boolean;
  employerVerified: boolean;
  discoveryPriority: 0 | 1 | 2;
  deadline?: string;
  applicationStatus?: string | null;
}

// Sort-order labels shown in the sort dropdown and in the "sorted by ..."
// summary sentence. A factory (not a plain module-level constant) so it can
// be recomputed via useMemo(() => getSortLabels(t), [t]) whenever the active
// language changes — a plain constant built once at import time would freeze
// stale text.
function getSortLabels(t: TFunction): Record<"recent" | "salary" | "applicants" | "nearest", string> {
  return {
    recent: t("findJobs.sort.options.recent"),
    salary: t("findJobs.sort.options.salary"),
    applicants: t("findJobs.sort.options.applicants"),
    nearest: t("findJobs.sort.options.nearest"),
  };
}

// Fetched wider than shown so "see more" reveals the rest without a second
// request. The server clamps this to 50 and defaults to 12.
const RECOMMENDED_FETCH_LIMIT = 12;
// Kept small on purpose: the section sits above the real search results, and a
// tall block of recommendations would push them off the first screen.
const RECOMMENDED_VISIBLE = 6;

// Job type filter values line up with getJobTypeLabel's output below; labels
// are pulled from jobDetails.jobTypeLabels so this filter and the job detail
// page never drift into two different translations of the same job type.
const JOB_TYPE_FILTER_OPTIONS: Array<{ value: Job["type"]; labelKey: string }> = [
  { value: "Short-term", labelKey: "shortTerm" },
  { value: "Side hustle", labelKey: "sideHustle" },
  { value: "Recruiting", labelKey: "recruiting" },
  { value: "Full-Time", labelKey: "fullTime" },
  { value: "Part-Time", labelKey: "partTime" },
  { value: "Contract", labelKey: "contract" },
  { value: "Project Work", labelKey: "projectWork" },
];

const MIN_PAY_OPTIONS = [100, 200, 500, 1000];

interface ApiJob {
  _id: string;
  title: string;
  description: string;
  location?: string;
  salary?: string | number;
  jobType?: string;
  createdAt?: string;
  category?: { _id?: string; name?: string } | string;
  applicants?: string[];
  requirements?: string[];
  skills?: string[];
  urgent?: boolean;
  highlighted?: boolean;
  employerVerified?: boolean;
  discoveryPriority?: number;
  deadline?: string;
  applicationStatus?: string | null;
  jobPoster?: { firstName?: string; lastName?: string; email?: string };
}

// Detects the pay cadence embedded in a raw backend salary string (e.g.
// "15000/mo"). The matched substrings are backend data patterns, not
// user-facing text, so they stay literal English regardless of UI language.
function getCadenceKey(raw: string): string {
  const source = raw.toLowerCase();
  if (source.includes("/mo") || source.includes("/month") || source.includes("per month")) return "month";
  if (source.includes("/yr") || source.includes("/year") || source.includes("per year")) return "year";
  if (source.includes("/week") || source.includes("per week")) return "week";
  if (source.includes("/day") || source.includes("per day")) return "day";
  if (source.includes("/hr") || source.includes("/hour") || source.includes("per hour")) return "hour";
  return "";
}

// Cadence suffix labels (e.g. "/month"), keyed by the cadence detected via
// getCadenceKey. A factory (not a plain module-level constant) so it can be
// recomputed whenever the active language changes — a plain constant built
// once at import time would freeze stale text.
function getCadenceLabels(t: TFunction): Record<string, string> {
  return {
    month: t("findJobs.cadence.month"),
    year: t("findJobs.cadence.year"),
    week: t("findJobs.cadence.week"),
    day: t("findJobs.cadence.day"),
    hour: t("findJobs.cadence.hour"),
  };
}

export function FindJobs() {
  const { t } = useTranslation("worker");
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = (searchParams.get("q") || "").trim().toLowerCase();
  const selectedCategory = searchParams.get("category") || "";
  const datePosted = searchParams.get("datePosted") || "";
  const jobTypeFilter = useMemo(
    () => (searchParams.get("type") || "").split(",").filter(Boolean) as Job["type"][],
    [searchParams],
  );
  const minPay = searchParams.get("minPay") || "";
  const fewApplicantsOnly = searchParams.get("fewApplicants") === "1";
  const selectedJobId = searchParams.get("jobId") || "";
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const { user } = useAuth();
  const { savedJobIds, toggleSavedJob } = useSavedJobs();
  const [sortBy, setSortBy] = useState<"recent" | "salary" | "applicants" | "nearest">("nearest");
  const [showAllRecommended, setShowAllRecommended] = useState(false);
  const [workerLocation, setWorkerLocation] = useState({
    province: "",
    city: "",
    barangay: "",
  });
  const [isLocationLoaded, setIsLocationLoaded] = useState(false);
  const [categories, setCategories] = useState<Array<{ _id: string; name: string }>>([]);
  const [preferredCategoryIds, setPreferredCategoryIds] = useState<string[]>([]);
  const [jobPreferenceText, setJobPreferenceText] = useState("");
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const preferencesRef = useRef<HTMLDivElement>(null);
  const preferencesTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    getCategories()
      .then((items) => {
        if (active) setCategories(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => { active = false; };
  }, []);

  const sortLabels = useMemo(() => getSortLabels(t), [t]);

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
    // Signed-out visitors on the public /jobs route have nowhere to save a
    // job to — send them to sign in first, then back to exactly this search.
    if (!user) {
      navigate(ROUTES.signIn, { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    try {
      const nextSaved = await toggleSavedJob(jobId);
      toast.success(nextSaved ? t("findJobs.toast.jobSaved") : t("findJobs.toast.jobRemoved"));
    } catch (error: any) {
      toast.error(error?.message || t("findJobs.toast.saveJobFailed"));
    }
  };

  const getJobTypeLabel = (jobType?: string): Job["type"] => {
    const normalized = (jobType || "").toLowerCase();
    switch (true) {
      case normalized.includes("short"):
        return "Short-term";
      case normalized.includes("side hustle"):
        return "Side hustle";
      case normalized.includes("recruit"):
        return "Recruiting";
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
      typeof job.category === "string" ? job.category : job.category?.name || t("findJobs.card.categoryFallback");
    const cadenceLabels = getCadenceLabels(t);
    const salaryLabel = (() => {
      if (typeof job.salary === "number") return formatCurrency(job.salary, { maximumFractionDigits: 0 });
      const raw = `${job.salary || ""}`.trim();
      if (!raw) return "—";
      const numeric = Number.parseFloat(raw.replace(/,/g, "").replace(/[^0-9.]/g, ""));
      const cadenceKey = getCadenceKey(raw);
      const cadence = cadenceKey ? cadenceLabels[cadenceKey] : "";
      if (Number.isFinite(numeric) && numeric > 0) {
        return `${formatCurrency(numeric, { maximumFractionDigits: 0 })}${cadence ? ` ${cadence}` : ""}`;
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
      applicants: job.applicants?.length || 0,
      type: getJobTypeLabel(job.jobType),
      location: job.location || t("findJobs.card.locationFallback"),
      salary: salaryLabel,
      postedDaysAgo: getPostedDays(job.createdAt),
      saved: false,
      category: categoryName,
      categoryId: typeof job.category === "string" ? undefined : job.category?._id,
      skills: job.skills || [],
      urgent: Boolean(job.urgent),
      highlighted: Boolean(job.highlighted),
      employerVerified: Boolean(job.employerVerified),
      discoveryPriority: job.highlighted ? 0 : job.discoveryPriority === 1 ? 1 : 2,
      deadline: job.deadline,
      applicationStatus: job.applicationStatus,
    };
  }, [t]);

  useEffect(() => {
    let isMounted = true;

    const loadWorkerLocation = async () => {
      setIsLocationLoaded(false);
      // Signed-out visitors (the public /jobs route) have no profile to fetch —
      // skip straight to "loaded" with an empty location so the job list below
      // isn't gated on a city that will never arrive.
      if (!user) {
        setWorkerLocation({ province: "", city: "", barangay: "" });
        setIsLocationLoaded(true);
        return;
      }
      try {
        const profile = await getProfile();
        if (!isMounted) return;
        setWorkerLocation({
          province: String((profile as any)?.province || ""),
          city: String((profile as any)?.city || user?.city || ""),
          barangay: String((profile as any)?.barangay || ""),
        });
        setPreferredCategoryIds(
          Array.isArray((profile as any)?.preferredCategories)
            ? (profile as any).preferredCategories.map((item: any) => String(item?._id || item)).filter(Boolean)
            : []
        );
        setJobPreferenceText(
          Array.isArray((profile as any)?.jobPreferences) ? (profile as any).jobPreferences.join(", ") : ""
        );
      } catch {
        if (!isMounted) return;
        setWorkerLocation({
          province: "",
          city: String(user?.city || ""),
          barangay: "",
        });
      } finally {
        if (isMounted) setIsLocationLoaded(true);
      }
    };

    loadWorkerLocation();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Only a logged-in worker's missing city blocks the list (their location
  // determines ranking and the empty state points them at Settings).
  // Signed-out visitors have no city concept at all — they still get the
  // nationwide, search-driven list.
  const canLoadJobs = isLocationLoaded && !(user && !workerLocation.city.trim());

  const { data: jobsData, isPending, error: jobsError, refetch: refetchJobs } = useWorkerJobs({
    userId: user?.id,
    search: searchQuery,
    category: selectedCategory,
    city: workerLocation.city.trim(),
    enabled: canLoadJobs,
  });

  // A disabled query stays "pending" forever, so gate the loading state on the
  // query actually being allowed to run.
  const isLoading = canLoadJobs && isPending;
  const loadError = jobsError ? (jobsError as Error).message || t("findJobs.toast.loadJobsFailed") : null;

  const jobs = useMemo<Job[]>(
    () => (Array.isArray(jobsData?.jobs) ? (jobsData.jobs as ApiJob[]).map(mapApiJob) : []),
    [jobsData?.jobs, mapApiJob],
  );

  const applicationStatuses = useMemo(() => {
    const statuses: Record<string, string> = {};
    if (Array.isArray(jobsData?.applications)) {
      jobsData.applications.forEach((application: any) => {
        const jobId = String(application?.job?._id || application?.job?.id || application?.job || "");
        const status = String(application?.status || "").trim();
        if (jobId && status) statuses[jobId] = status;
      });
    }
    return statuses;
  }, [jobsData?.applications]);

  // Recommendations are a separate, supplementary query: they have their own
  // ranking, ignore the filter pills entirely, and must not disturb the search
  // results if they fail. See useRecommendedJobs for why it does not retry.
  const { data: recommendedData, isError: recommendationsFailed } = useRecommendedJobs({
    userId: user?.id,
    limit: RECOMMENDED_FETCH_LIMIT,
    enabled: Boolean(user?.id),
  });

  const recommendedJobs = useMemo(() => {
    if (!Array.isArray(recommendedData)) return [];
    return (recommendedData as Array<ApiJob & { match?: { percentage?: number; level?: string } }>).map((job) => ({
      ...mapApiJob(job),
      matchPercentage: Number(job.match?.percentage) || 0,
      matchLevel: job.match?.level || "",
    }));
  }, [recommendedData, mapApiJob]);

  // A worker with an empty profile does not get an empty response -- every job
  // scores zero and the server falls back to recency. Presenting that as
  // "recommended for you" would be a lie, so an all-zero result is treated as
  // "no matches yet" and we ask for the profile data that would fix it.
  const hasNoRealMatches =
    recommendedJobs.length > 0 && recommendedJobs.every((job) => job.matchPercentage === 0);
  const showRecommendations = !recommendationsFailed && recommendedJobs.length > 0;

  const parseSalaryValue = (value: string | number) => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }
    const cleaned = value.replace(/[^0-9.]/g, "");
    const amount = Number.parseFloat(cleaned);
    return Number.isFinite(amount) ? amount : 0;
  };

  const getSalaryDisplay = (salary: string) => {
    const normalized = salary.toLowerCase();
    if (normalized === "—") return salary;
    if (normalized.includes("/")) return salary;
    if (normalized.includes("per month") || normalized.includes("per year")) return salary;
    return t("findJobs.card.salaryMinimum", { salary });
  };

  const jobsWithSavedState = jobs.map((job) => ({
    ...job,
    saved: savedJobIds.has(job.id),
  }));

  // Search plus the four filter pills. Locality is never a filter here — the
  // worker's city only decides ranking (see the "nearest" sort and
  // locationScore below) — filtering on it previously hid every out-of-city
  // job and showed an empty page to anyone without a city set.
  const filteredJobs = jobsWithSavedState.filter((job) => {
    if (searchQuery) {
      const combined = `${job.title} ${job.company} ${job.category}`.toLowerCase();
      if (!combined.includes(searchQuery)) return false;
    }
    if (datePosted) {
      // postedDaysAgo is day-granularity (floor), so "past 24 hours" means
      // "posted today" rather than a rolling 24-hour window.
      if (datePosted === "24h" && job.postedDaysAgo > 0) return false;
      if (datePosted === "week" && job.postedDaysAgo > 7) return false;
      if (datePosted === "month" && job.postedDaysAgo > 30) return false;
    }
    if (jobTypeFilter.length > 0 && !jobTypeFilter.includes(job.type)) return false;
    if (minPay && parseSalaryValue(job.salary) < Number(minPay)) return false;
    if (fewApplicantsOnly && job.applicants >= 10) return false;
    return true;
  });

  // Sort jobs
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    const discoveryPriority = a.discoveryPriority - b.discoveryPriority;
    if (discoveryPriority !== 0) return discoveryPriority;

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

  const workerCity = workerLocation.city.trim();
  const workerLocationLabel = workerCity || t("findJobs.hero.setCityLabel");

  const updateSearchParam = useCallback((key: string, value: string | null, options?: { replace?: boolean }) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, options);
  }, [searchParams, setSearchParams]);

  // Keeps ?jobId in sync with the visible results: defaults to the first
  // result once jobs load, and re-points to the new first result whenever a
  // filter/sort change removes whatever was selected. Only the split-pane
  // layout has somewhere to show it, so below `lg` we leave the URL alone
  // rather than selecting a job into a pane nobody can see.
  useEffect(() => {
    if (isLoading || !isLargeScreen) return;
    if (sortedJobs.length === 0) {
      if (selectedJobId) updateSearchParam("jobId", null, { replace: true });
      return;
    }
    if (!sortedJobs.some((job) => job.id === selectedJobId)) {
      // A falsy id would make updateSearchParam delete ?jobId instead of
      // setting it, and this effect would immediately run again — a render
      // loop. Skip rather than spin.
      const firstId = sortedJobs[0]?.id;
      if (firstId) updateSearchParam("jobId", firstId, { replace: true });
    }
    // sortedJobs is a new array every render; keying off its id sequence
    // avoids re-running this effect on every keystroke elsewhere on the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedJobs.map((job) => job.id).join(","), isLoading, selectedJobId, isLargeScreen]);

  const handleJobPress = (jobId: string) => {
    if (isLargeScreen) {
      updateSearchParam("jobId", jobId);
    } else {
      const detailsUrl = `${window.location.origin}${ROUTES.worker.jobDetails(jobId)}`;
      window.open(detailsUrl, "_blank", "noopener,noreferrer");
    }
  };

  const savePreferences = async () => {
    setSavingPreferences(true);
    try {
      await updateJobPreferences({
        preferredCategories: preferredCategoryIds,
        jobPreferences: jobPreferenceText.split(",").map((item) => item.trim()).filter(Boolean),
      });
      toast.success(t("findJobs.toast.preferencesSaved"));
      void refetchJobs();
      setShowPreferences(false);
    } catch (error: any) {
      toast.error(error?.message || t("findJobs.toast.preferencesSaveFailed"));
    } finally {
      setSavingPreferences(false);
    }
  };

  useEffect(() => {
    if (!showPreferences) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (preferencesRef.current && !preferencesRef.current.contains(event.target as Node)) setShowPreferences(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowPreferences(false);
        preferencesTriggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showPreferences]);

  const dateOptions: FilterOption[] = [
    { value: "24h", label: t("findJobs.filters.datePosted.past24Hours") },
    { value: "week", label: t("findJobs.filters.datePosted.pastWeek") },
    { value: "month", label: t("findJobs.filters.datePosted.pastMonth") },
  ];
  const jobTypeOptions: FilterOption[] = JOB_TYPE_FILTER_OPTIONS.map((option) => ({
    value: option.value,
    label: t(`jobDetails.jobTypeLabels.${option.labelKey}`),
  }));
  const minPayOptions: FilterOption[] = MIN_PAY_OPTIONS.map((amount) => ({
    value: String(amount),
    label: t("findJobs.filters.minimumPay.option", { amount: formatCurrency(amount, { maximumFractionDigits: 0 }) }),
  }));

  const activeFilterCount =
    (datePosted ? 1 : 0) + (jobTypeFilter.length > 0 ? 1 : 0) + (minPay ? 1 : 0) + (fewApplicantsOnly ? 1 : 0);
  const preferencesActive = preferredCategoryIds.length > 0 || jobPreferenceText.trim().length > 0;

  const clearAllFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("datePosted");
    next.delete("type");
    next.delete("minPay");
    next.delete("fewApplicants");
    setSearchParams(next);
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 font-sans">
      <section className="relative overflow-hidden rounded-3xl bg-[#1C4D8D] px-5 py-7 text-white shadow-[0_14px_36px_rgba(28,77,141,0.18)] sm:px-8 lg:px-10" aria-labelledby="job-search-heading">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-blue-400/10" aria-hidden="true" />
        <div className="relative max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/85">{t("findJobs.hero.eyebrow")}</p>
          <h1 id="job-search-heading" className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">{t("findJobs.hero.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">{t("findJobs.hero.subtitle")}</p>
        </div>

        <form
          className="relative mt-6 grid gap-3 rounded-2xl bg-white/10 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(11rem,0.35fr)_minmax(11rem,0.35fr)]"
          role="search"
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="relative min-w-0">
            <span className="sr-only">{t("findJobs.hero.searchAria")}</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={searchParams.get("q") || ""}
              onChange={(event) => updateSearchParam("q", event.target.value || null)}
              placeholder={t("findJobs.hero.searchPlaceholder")}
              className="h-14 w-full rounded-xl border-0 bg-white pl-12 pr-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="min-w-0">
            <span className="sr-only">{t("findJobs.hero.categoryFilterAria")}</span>
            <select
              value={selectedCategory}
              onChange={(event) => updateSearchParam("category", event.target.value || null)}
              className="h-14 w-full rounded-xl border-0 bg-white px-4 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t("findJobs.hero.allCategories")}</option>
              {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => navigate(ROUTES.settings)} className="flex min-h-14 min-w-0 items-center gap-3 rounded-xl bg-white px-4 text-left text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C4D8D]" aria-label={workerCity ? t("findJobs.hero.cityButtonAriaSet", { location: workerLocationLabel }) : t("findJobs.hero.cityButtonAriaUnset", { location: workerLocationLabel })}>
            <MapPin className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
            <span className="truncate text-sm font-semibold">{workerLocationLabel}</span>
          </button>
        </form>
      </section>

      {isLocationLoaded && !workerCity && (
        <aside role="status" className="flex flex-col gap-3 rounded-2xl border border-[#1C4D8D]/20 bg-[#1C4D8D]/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-slate-950">{t("findJobs.locationBanner.title")}</p>
            <p className="mt-1 text-sm text-slate-600">{t("findJobs.locationBanner.subtitle")}</p>
          </div>
          <button type="button" onClick={() => navigate(ROUTES.settings)} className="brand-primary-interactive min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold">{t("findJobs.locationBanner.updateLocation")}</button>
        </aside>
      )}

      {/* `relative` is the anchor for the filter dropdowns below sm, where they
          span the full row instead of hanging off a single pill. */}
      <div className="relative flex flex-wrap items-center gap-2">
        <FilterPill mode="radio" label={t("findJobs.filters.datePosted.label")} options={dateOptions} value={datePosted} onApply={(value) => updateSearchParam("datePosted", value || null)} />
        <FilterPill mode="checkbox" label={t("findJobs.filters.jobType.label")} options={jobTypeOptions} value={jobTypeFilter} onApply={(values) => updateSearchParam("type", values.length ? values.join(",") : null)} />
        <FilterPill mode="radio" label={t("findJobs.filters.minimumPay.label")} options={minPayOptions} value={minPay} onApply={(value) => updateSearchParam("minPay", value || null)} />
        <FilterPill mode="toggle" label={t("findJobs.filters.fewApplicants.label")} value={fewApplicantsOnly} onApply={(value) => updateSearchParam("fewApplicants", value ? "1" : null)} />

        {/* Same anchoring rule as FilterPill: row-anchored on mobile, pill-anchored from sm up. */}
        <div className="sm:relative" ref={preferencesRef}>
          <button
            ref={preferencesTriggerRef}
            type="button"
            onClick={() => setShowPreferences((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={showPreferences}
            className={`inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${
              preferencesActive ? "border-[#1C4D8D] bg-[#EAF2FC] text-[#1C4D8D]" : "border-slate-300 text-slate-700 hover:border-slate-400"
            }`}
          >
            {t("findJobs.preferences.title")}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showPreferences ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {showPreferences ? (
            <div role="menu" aria-label={t("findJobs.preferences.title")} className="absolute left-0 right-0 top-full z-50 mt-2 w-auto overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.16)] sm:right-auto sm:w-96">
              <p className="text-xs text-slate-500">{t("findJobs.preferences.subtitle")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((category) => {
                  const selected = preferredCategoryIds.includes(category._id);
                  return (
                    <button
                      key={`preferred-${category._id}`}
                      type="button"
                      onClick={() => setPreferredCategoryIds((current) =>
                        selected ? current.filter((id) => id !== category._id) : [...current, category._id]
                      )}
                      aria-pressed={selected}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        selected
                          ? "border-[#1C4D8D] bg-[#EAF2FC] text-[#1C4D8D]"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <label htmlFor="job-preferences" className="sr-only">{t("findJobs.preferences.keywordsLabel")}</label>
                <input
                  id="job-preferences"
                  value={jobPreferenceText}
                  onChange={(event) => setJobPreferenceText(event.target.value)}
                  placeholder={t("findJobs.preferences.keywordsPlaceholder")}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1C4D8D] focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={savePreferences}
                  disabled={savingPreferences}
                  className="min-h-11 rounded-xl bg-[#1C4D8D] px-5 text-sm font-bold text-white transition hover:bg-[#163F75] disabled:opacity-50"
                >
                  {savingPreferences ? t("findJobs.preferences.saving") : t("findJobs.preferences.save")}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {activeFilterCount > 0 ? (
          <>
            <span className="text-[13px] text-slate-400">{t("findJobs.filters.activeCount", { count: activeFilterCount })}</span>
            <button type="button" onClick={clearAllFilters} className="text-[13px] font-semibold text-[#1C4D8D] hover:underline">
              {t("findJobs.filters.clearAll")}
            </button>
          </>
        ) : null}
      </div>

      {/* Recommendations sit above the search results and are deliberately
          silent on failure -- see showRecommendations. When the worker has no
          profile data to match on we show a prompt instead of zero-percent
          cards dressed up as personalised picks. */}
      {showRecommendations ? (
        <section aria-labelledby="recommended-heading" className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 id="recommended-heading" className="text-[15px] font-bold text-slate-950">
            {t("findJobs.recommended.title")}
          </h2>
          {hasNoRealMatches ? (
            <div className="mt-2">
              <p className="text-sm text-slate-500">{t("findJobs.recommended.emptyProfileBody")}</p>
              <Button className="mt-3" onClick={() => navigate(ROUTES.worker.profile)}>
                {t("findJobs.recommended.emptyProfileAction")}
              </Button>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-500">{t("findJobs.recommended.subtitle")}</p>
              <div className="mt-3 space-y-1">
                {(showAllRecommended ? recommendedJobs : recommendedJobs.slice(0, RECOMMENDED_VISIBLE)).map((job, index) => (
                  <JobListRow
                    key={`recommended-${job.id}`}
                    job={toJobCardData({
                      id: job.id,
                      title: job.title,
                      company: job.company,
                      location: job.location,
                      type: job.type,
                      salary: getSalaryDisplay(job.salary),
                      categoryId: job.categoryId,
                      categoryName: job.category,
                      skills: job.skills,
                      urgent: job.urgent,
                      highlighted: job.highlighted,
                      employerVerified: job.employerVerified,
                      matchPercentage: job.matchPercentage,
                      matchLevel: job.matchLevel,
                    })}
                    saved={savedJobIds.has(job.id)}
                    applicationStatus={applicationStatuses[job.id]}
                    index={index}
                    onPress={() => handleJobPress(job.id)}
                    onToggleSave={() => handleSaveJob(job.id)}
                  />
                ))}
              </div>
              {recommendedJobs.length > RECOMMENDED_VISIBLE ? (
                <button
                  type="button"
                  onClick={() => setShowAllRecommended((previous) => !previous)}
                  className="mt-2 text-[13px] font-semibold text-[#1C4D8D] hover:underline"
                >
                  {showAllRecommended
                    ? t("findJobs.recommended.showLess")
                    : t("findJobs.recommended.showAll", { count: recommendedJobs.length })}
                </button>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xl font-bold leading-tight text-slate-950 sm:text-2xl" aria-live="polite">
            {t("findJobs.results.countLabel", { count: sortedJobs.length })}
          </p>
          {/* Discovery is nationwide; when the worker has a city we say so
              explicitly, since "nearest first" is otherwise invisible ordering. */}
          <p className="mt-1 text-sm text-slate-500">
            {workerCity && sortBy === "nearest"
              ? t("findJobs.results.nearestFirst", { city: workerCity })
              : t("findJobs.results.sortedBy", { sort: sortLabels[sortBy].toLowerCase() })}
          </p>
        </div>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-600 shadow-sm focus-within:ring-2 focus-within:ring-blue-600">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{t("findJobs.sort.ariaLabel")}</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="min-h-10 bg-transparent text-sm font-semibold outline-none" aria-label={t("findJobs.sort.ariaLabel")}>
            {Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      {/* Placeholder rows echo the JobListRow layout (category tile, title,
          meta line) so the list does not reflow when results land. The
          wrapper mirrors the loaded grid below exactly -- without it the
          placeholder list spanned the full width on lg+ and then snapped
          into the 380px column once results arrived. The tile is 44px /
          rounded-[14px] to match CategoryTile size="sm". */}
      {isLoading && (
        <div role="status" aria-label={t("findJobs.status.loading.title")} className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className="space-y-1">
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="flex items-start gap-3 rounded-xl border-l-2 border-l-transparent bg-white p-3">
                <Skeleton className="h-11 w-11 rounded-[14px]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-3 w-3/5" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>

          {/* Detail-pane placeholder is CSS-only on purpose: the real pane
              below is gated on isLargeScreen so it never mounts (and never
              fetches) on a phone. A skeleton has nothing to fetch, so
              `hidden lg:block` is enough here. */}
          <div className="hidden lg:block">
            <Skeleton className="h-[420px] w-full rounded-xl" />
          </div>
        </div>
      )}

      {loadError && !isLoading && (
        <StatusState tone="error" title={t("findJobs.status.error.title")} description={loadError} action={<Button onClick={() => void refetchJobs()}>{t("findJobs.status.error.retry")}</Button>} />
      )}

      {!isLoading && !loadError && sortedJobs.length === 0 && (
        <StatusState title={searchQuery ? t("findJobs.status.empty.searchTitle") : t("findJobs.status.empty.defaultTitle")} description={searchQuery ? t("findJobs.status.empty.searchDescription") : t("findJobs.status.empty.defaultDescription")} />
      )}

      {!isLoading && !loadError && sortedJobs.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className="space-y-1">
            {sortedJobs.map((job, index) => (
              <JobListRow
                key={job.id}
                job={toJobCardData({
                  id: job.id,
                  title: job.title,
                  company: job.company,
                  location: job.location,
                  type: job.type,
                  salary: getSalaryDisplay(job.salary),
                  categoryId: job.categoryId,
                  categoryName: job.category,
                  skills: job.skills,
                  urgent: job.urgent,
                  highlighted: job.highlighted,
                  employerVerified: job.employerVerified,
                })}
                selected={isLargeScreen && job.id === selectedJobId}
                saved={job.saved}
                applicationStatus={applicationStatuses[job.id]}
                index={index}
                onPress={() => handleJobPress(job.id)}
                onToggleSave={() => handleSaveJob(job.id)}
              />
            ))}
          </div>

          {/* Gated on isLargeScreen, not just `hidden lg:block`: a CSS-hidden
              panel still mounts and fetches the job, so on a phone every
              filter change would fire a request for a pane nobody can see. */}
          <div className="hidden lg:block lg:sticky lg:top-4 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
            {isLargeScreen && selectedJobId ? (
              <JobDetailPanel jobId={selectedJobId} compact />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
