import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Search, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "../../lib/toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getCategories, getJobs, getProfile, updateJobPreferences } from "../../services/api";
import { ROUTES } from "../../utils/routes";
import { useSavedJobs } from "../../hooks/useSavedJobs";
import { useAuth } from "../../contexts/AuthContext";
import { Button, StatusState } from "../../components/ui";
import { DateField } from "../../components/ui/DateField";
import { isDateDisabled, type DateRange } from "../../lib/calendarModel";
import { JobCard } from "../../components/job/JobCard";
import { toJobCardData } from "../../components/job/jobCardModel";
import { formatCurrency } from "../../lib/formatters";

// Converts between the "YYYY-MM-DD" strings stored in the URL (?from=&to=)
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
  deadline?: string;
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
  deadline?: string;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = (searchParams.get("q") || "").trim().toLowerCase();
  const selectedCategory = searchParams.get("category") || "";
  const dateFromParam = searchParams.get("from") || "";
  const dateToParam = searchParams.get("to") || "";
  const deadlineRange: DateRange = {
    start: dateFromParam ? parseDateOnly(dateFromParam) : null,
    end: dateToParam ? parseDateOnly(dateToParam) : null,
  };
  const setDeadlineRange = (next: DateRange) => {
    const nextParams = new URLSearchParams(searchParams);
    if (next.start) nextParams.set("from", formatDateOnly(next.start));
    else nextParams.delete("from");
    if (next.end) nextParams.set("to", formatDateOnly(next.end));
    else nextParams.delete("to");
    setSearchParams(nextParams);
  };
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
  const [isLocationLoaded, setIsLocationLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [categories, setCategories] = useState<Array<{ _id: string; name: string }>>([]);
  const [preferredCategoryIds, setPreferredCategoryIds] = useState<string[]>([]);
  const [jobPreferenceText, setJobPreferenceText] = useState("");
  const [savingPreferences, setSavingPreferences] = useState(false);

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
      deadline: job.deadline,
    };
  }, [t]);

  useEffect(() => {
    let isMounted = true;

    const loadWorkerLocation = async () => {
      setIsLocationLoaded(false);
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
  }, [user?.city]);

  useEffect(() => {
    let isMounted = true;
    const loadJobs = async () => {
      if (!isLocationLoaded) return;
      if (!workerLocation.city.trim()) {
        setJobs([]);
        setLoadError(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await getJobs({
          search: searchQuery || undefined,
          category: selectedCategory || undefined,
          city: workerLocation.city.trim(),
          excludeOwn: true,
        });
        if (!isMounted) return;
        const mapped = Array.isArray(data) ? data.map(mapApiJob) : [];
        setJobs(mapped);
      } catch (error: any) {
        if (!isMounted) return;
        setLoadError(error?.message || t("findJobs.toast.loadJobsFailed"));
        setJobs([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadJobs();
    return () => {
      isMounted = false;
    };
  }, [isLocationLoaded, workerLocation.city, searchQuery, selectedCategory, reloadKey, mapApiJob, t]);

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

  const filteredJobs = jobsWithSavedState.filter(job => {
    const workerCity = normalizeToken(workerLocation.city);
    if (!workerCity || !normalizeToken(job.location).includes(workerCity)) {
      return false;
    }
    if (deadlineRange.start && deadlineRange.end) {
      if (!job.deadline) return false;
      const deadlineDate = new Date(job.deadline);
      if (Number.isNaN(deadlineDate.getTime())) return false;
      if (isDateDisabled(deadlineDate, { minDate: deadlineRange.start, maxDate: deadlineRange.end })) return false;
    }
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

  const workerCity = workerLocation.city.trim();
  const workerLocationLabel = workerCity || t("findJobs.hero.setCityLabel");

  const savePreferences = async () => {
    setSavingPreferences(true);
    try {
      await updateJobPreferences({
        preferredCategories: preferredCategoryIds,
        jobPreferences: jobPreferenceText.split(",").map((item) => item.trim()).filter(Boolean),
      });
      toast.success(t("findJobs.toast.preferencesSaved"));
      setReloadKey((value) => value + 1);
    } catch (error: any) {
      toast.error(error?.message || t("findJobs.toast.preferencesSaveFailed"));
    } finally {
      setSavingPreferences(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 font-sans">
      <section className="relative overflow-hidden rounded-3xl bg-[#1C4D8D] px-5 py-7 text-white shadow-[0_14px_36px_rgba(28,77,141,0.18)] sm:px-8 lg:px-10" aria-labelledby="job-search-heading">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-blue-400/10" aria-hidden="true" />
        <div className="relative max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/85">{t("findJobs.hero.eyebrow")}</p>
          <h1 id="job-search-heading" className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">{t("findJobs.hero.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">{t("findJobs.hero.subtitle")}</p>
        </div>

        <form
          className="relative mt-6 grid gap-3 rounded-2xl bg-white/10 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(11rem,0.3fr)_minmax(11rem,0.3fr)_minmax(11rem,0.3fr)]"
          role="search"
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="relative min-w-0">
            <span className="sr-only">{t("findJobs.hero.searchAria")}</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={searchParams.get("q") || ""}
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                if (event.target.value) next.set("q", event.target.value);
                else next.delete("q");
                setSearchParams(next);
              }}
              placeholder={t("findJobs.hero.searchPlaceholder")}
              className="h-14 w-full rounded-xl border-0 bg-white pl-12 pr-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="min-w-0">
            <span className="sr-only">{t("findJobs.hero.categoryFilterAria")}</span>
            <select
              value={selectedCategory}
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                if (event.target.value) next.set("category", event.target.value);
                else next.delete("category");
                setSearchParams(next);
              }}
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
          <DateField
            mode="range"
            minDate={new Date()}
            value={deadlineRange}
            onChange={setDeadlineRange}
            placeholder={t("findJobs.hero.deadlinePlaceholder")}
            className="min-w-0"
            buttonClassName="flex h-14 w-full items-center gap-2 rounded-xl border-0 bg-white px-4 text-left text-sm font-semibold text-slate-700 outline-none transition focus:ring-2 focus:ring-blue-500"
          />
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

      <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3">
          <div>
            <p className="text-sm font-bold text-slate-900">{t("findJobs.preferences.title")}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t("findJobs.preferences.subtitle")}</p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-[#1C4D8D] group-open:hidden">{t("findJobs.preferences.manage")}</span>
          <span className="hidden shrink-0 text-xs font-semibold text-[#1C4D8D] group-open:inline">{t("findJobs.preferences.close")}</span>
        </summary>
        <div className="border-t border-slate-100 px-5 pb-5 pt-4">
          <div className="flex flex-wrap gap-2">
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
      </details>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xl font-bold leading-tight text-slate-950 sm:text-2xl" aria-live="polite">
            {t("findJobs.results.countLabel", { count: sortedJobs.length })}
          </p>
          <p className="mt-1 text-sm text-slate-500">{t("findJobs.results.sortedBy", { sort: sortLabels[sortBy].toLowerCase() })}</p>
        </div>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-600 shadow-sm focus-within:ring-2 focus-within:ring-blue-600">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{t("findJobs.sort.ariaLabel")}</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="min-h-10 bg-transparent text-sm font-semibold outline-none" aria-label={t("findJobs.sort.ariaLabel")}>
            {Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      {isLoading && (
        <StatusState tone="loading" title={t("findJobs.status.loading.title")} description={t("findJobs.status.loading.description")} />
      )}

      {loadError && !isLoading && (
        <StatusState tone="error" title={t("findJobs.status.error.title")} description={loadError} action={<Button onClick={() => setReloadKey((value) => value + 1)}>{t("findJobs.status.error.retry")}</Button>} />
      )}

      {!isLoading && !loadError && sortedJobs.length === 0 && (
        <StatusState title={searchQuery ? t("findJobs.status.empty.searchTitle") : t("findJobs.status.empty.defaultTitle")} description={searchQuery ? t("findJobs.status.empty.searchDescription") : t("findJobs.status.empty.defaultDescription")} />
      )}

      {!isLoading && !loadError && sortedJobs.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {sortedJobs.map((job, index) => (
            <JobCard
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
              })}
              variant="list"
              saved={job.saved}
              index={index}
              onPress={() => navigate(ROUTES.worker.jobDetails(job.id))}
              onToggleSave={() => handleSaveJob(job.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
