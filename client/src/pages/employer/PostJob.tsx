import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  Filter,
  MapPin,
  Plus,
  Search,
  WalletCards,
  X,
} from "lucide-react";
import { categoriesAPI, jobsAPI } from "../../services/jobs";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "../../lib/toast";
import { ConfirmDialog } from "../../components/ui";
import { DateField } from "../../components/ui/DateField";
import { ROUTES } from "../../utils/routes";
import { formatMinimumPay } from "../../lib/jobCompensation";
import { formatCurrency } from "../../lib/formatters";

// Converts between the "YYYY-MM-DD" strings this form stores (matching native
// <input type="date"> value format) and the Date objects DateField works with.
function parseDateInputValue(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}
function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type JobEdit = {
  _id: string;
  title?: string;
  category?: { _id?: string; name?: string } | string;
  description?: string;
  requirements?: string[];
  responsibilities?: string[];
  skills?: string[];
  salary?: string;
  location?: string;
  jobType?: string;
  deadline?: string;
  urgent?: boolean;
  positionsNeeded?: number;
  status?: string;
  createdAt?: string;
  applicants?: unknown[];
};

type TFn = (key: string, options?: Record<string, unknown>) => string;

const getJobTypeOptions = (t: TFn) =>
  [
    {
      value: "Short-term",
      label: t("postJob.jobType.shortTerm.label"),
      description: t("postJob.jobType.shortTerm.description"),
    },
    {
      value: "Side hustle",
      label: t("postJob.jobType.sideHustle.label"),
      description: t("postJob.jobType.sideHustle.description"),
    },
    {
      value: "Recruiting",
      label: t("postJob.jobType.recruiting.label"),
      description: t("postJob.jobType.recruiting.description"),
    },
  ] as const;

const LEGACY_JOB_TYPES = ["Fulltime", "Part-time", "Freelance", "Contract", "Remote"] as const;

type FormState = {
  title: string;
  category: string;
  description: string;
  requirements: string;
  skills: string;
  minimumSalary: string;
  province: string;
  city: string;
  barangay: string;
  address: string;
  jobType: string;
  deadline: string;
  positionsNeeded: string;
};

type RequiredFieldKey =
  | "title"
  | "description"
  | "location"
  | "salary"
  | "jobType"
  | "deadline"
  | "category";

const getRequiredFieldLabels = (t: TFn): Record<RequiredFieldKey, string> => ({
  title: t("postJob.requiredFields.title"),
  description: t("postJob.requiredFields.description"),
  location: t("postJob.requiredFields.location"),
  salary: t("postJob.requiredFields.salary"),
  jobType: t("postJob.requiredFields.jobType"),
  deadline: t("postJob.requiredFields.deadline"),
  category: t("postJob.requiredFields.category"),
});

const createEmptyForm = (): FormState => ({
  title: "",
  category: "",
  description: "",
  requirements: "",
  skills: "",
  minimumSalary: "",
  province: "",
  city: "",
  barangay: "",
  address: "",
  jobType: "Short-term",
  deadline: "",
  positionsNeeded: "1",
});

interface ProvinceOption {
  code: string;
  name: string;
}

interface CityOption {
  code: string;
  name: string;
  provinceCode?: string;
}

interface BarangayOption {
  code: string;
  name: string;
}

const PSGC_BASE_URL = "https://psgc.gitlab.io/api";

const parseLocationToParts = (locationText?: string) => {
  const raw = String(locationText || "").trim();
  if (!raw) {
    return {
      address: "",
      barangay: "",
      city: "",
      province: "",
    };
  }

  const parts = raw.split(",").map((item) => item.trim()).filter(Boolean);
  if (parts.length >= 4) {
    return {
      address: parts.slice(0, parts.length - 3).join(", "),
      barangay: parts[parts.length - 3],
      city: parts[parts.length - 2],
      province: parts[parts.length - 1],
    };
  }

  if (parts.length === 3) {
    return {
      address: "",
      barangay: parts[0],
      city: parts[1],
      province: parts[2],
    };
  }

  return {
    address: raw,
    barangay: "",
    city: "",
    province: "",
  };
};

const composeLocation = (form: FormState) => {
  // The free-text address field commonly repeats the barangay/city/province the
  // employer already picked via the dropdowns above it (e.g. typing "Pantal, City
  // of Dagupan, Pangasinan" as the address when those are also selected), which
  // used to produce a doubled string like "Pantal, City of Dagupan, Pangasinan,
  // Pantal, City of Dagupan, Pangasinan". Flattening every field's own comma
  // segments before deduping catches that case (and a genuine street address like
  // "123 Rizal St., Pantal, ...") without losing real detail — a segment is only
  // ever dropped if it exactly repeats one already kept, preserving order.
  const segments = [form.address, form.barangay, form.city, form.province]
    .flatMap((field) => field.split(","))
    .map((segment) => segment.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const deduped = segments.filter((segment) => {
    const key = segment.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped.join(", ");
};

const extractSalaryValue = (value: unknown): string => {
  const raw = String(value ?? "").replace(/[^0-9]/g, "");
  return raw ? String(Number(raw)) : "";
};

const buildFormFromJob = (job: JobEdit): FormState => {
  const categoryId = typeof job.category === "object" ? job.category?._id : job.category;
  const salary = extractSalaryValue(job.salary);
  const locationParts = parseLocationToParts(job.location);
  return {
    title: job.title || "",
    category: categoryId || "",
    description: job.description || "",
    requirements: job.requirements?.join("\n") || "",
    skills: job.skills?.join(", ") || "",
    minimumSalary: salary,
    province: locationParts.province,
    city: locationParts.city,
    barangay: locationParts.barangay,
    address: locationParts.address,
    jobType: job.jobType || "Short-term",
    deadline: job.deadline ? new Date(job.deadline).toISOString().slice(0, 10) : "",
    positionsNeeded: job.positionsNeeded ? String(job.positionsNeeded) : "1",
  };
};

const PostJob: React.FC = () => {
  const { t } = useTranslation("employer");
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { job?: JobEdit; returnTo?: string } | null;
  const incomingJobToEdit = locationState?.job;
  const prefersReducedMotion = useReducedMotion();
  const jobTypeOptions = useMemo(() => getJobTypeOptions(t), [t]);
  const requiredFieldLabels = useMemo(() => getRequiredFieldLabels(t), [t]);
  const statusLabels: Record<string, string> = useMemo(
    () => ({
      Available: t("postJob.status.available"),
      "In Progress": t("postJob.status.inProgress"),
      Closed: t("postJob.status.closed"),
      Cancelled: t("postJob.status.cancelled"),
      Completed: t("postJob.status.completed"),
    }),
    [t]
  );

  const [jobs, setJobs] = useState<JobEdit[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState<JobEdit | null>(null);
  const [returnAfterSave, setReturnAfterSave] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormState>(createEmptyForm());
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<JobEdit | null>(null);
  const [provinceOptions, setProvinceOptions] = useState<ProvinceOption[]>([]);
  const [cityOptions, setCityOptions] = useState<CityOption[]>([]);
  const [barangayOptions, setBarangayOptions] = useState<BarangayOption[]>([]);
  const [isLoadingLocationData, setIsLoadingLocationData] = useState(false);
  const [isLoadingBarangays, setIsLoadingBarangays] = useState(false);
  const hasInsufficientBalanceError = /(?:insufficient|not have enough) balance/i.test(formError || "");

  const selectedProvince = provinceOptions.find(
    (item) => item.name.toLowerCase() === formData.province.trim().toLowerCase(),
  );

  const selectedCity = cityOptions.find(
    (item) => item.name.toLowerCase() === formData.city.trim().toLowerCase(),
  );

  const filteredCityOptions = selectedProvince?.code
    ? cityOptions.filter((item) => item.provinceCode === selectedProvince.code)
    : cityOptions;

  const estimatedEscrow = useMemo(() => {
    const payPerWorker = Number(formData.minimumSalary.replace(/[^0-9]/g, "") || 0);
    const workerCount = Number(formData.positionsNeeded || 0);

    if (!Number.isFinite(payPerWorker) || !Number.isInteger(workerCount) || workerCount < 1) {
      return 0;
    }

    return payPerWorker * workerCount;
  }, [formData.minimumSalary, formData.positionsNeeded]);

  const totalPostings = jobs.length;
  const activePostings = useMemo(
    () =>
      jobs.filter((job) => {
        const status = String(job.status || "");
        return status === "Available" || status === "In Progress";
      }).length,
    [jobs]
  );
  const closedPostings = useMemo(
    () =>
      jobs.filter((job) => {
        const status = String(job.status || "");
        return status === "Closed" || status === "Cancelled" || status === "Completed";
      }).length,
    [jobs]
  );
  const filteredJobs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return jobs.filter((job) => {
      const status = String(job.status || "Available");
      const jobType = String(job.jobType || "");
      const categoryName =
        typeof job.category === "object" ? String(job.category?.name || "") : "";
      const skillsText = Array.isArray(job.skills) ? job.skills.join(" ") : "";

      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }

      if (jobTypeFilter !== "all" && jobType !== jobTypeFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableText = [
        job.title,
        job.location,
        status,
        jobType,
        categoryName,
        job.description,
        skillsText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [jobs, searchQuery, statusFilter, jobTypeFilter]);

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    setJobsError(null);
    try {
      const response = await jobsAPI.getMyJobs();
      setJobs(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      setJobsError(err?.response?.data?.message || t("postJob.errors.loadFailed"));
    } finally {
      setLoadingJobs(false);
    }
  }, [t]);

  // Mirrors the server's own gate (getEmployerProfileRequirementError) so an
  // incomplete profile is caught before the modal even opens, not as a raw
  // error after filling out the whole form. The server enforces this
  // regardless — this is only the friendlier path to the same rule.
  const hasCompleteProfile = Boolean(user?.companyName?.trim()) && Boolean(user?.avatarUrl?.trim());

  const openCreateModal = useCallback(() => {
    if (!hasCompleteProfile) {
      toast.error(t("postJob.profileIncomplete.toast"));
      navigate(ROUTES.employer.settings);
      return;
    }
    setEditingJob(null);
    setReturnAfterSave(null);
    setFormData(createEmptyForm());
    setFormError(null);
    setShowModal(true);
  }, [hasCompleteProfile, navigate, t]);

  const openEditModal = useCallback((job: JobEdit, returnTo: string | null = null) => {
    setEditingJob(job);
    setReturnAfterSave(returnTo);
    setFormData(buildFormFromJob(job));
    setFormError(null);
    setShowModal(true);
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await categoriesAPI.getCategories();
        setCategories(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Failed to load categories", err);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    let isMounted = true;

    const loadLocationData = async () => {
      setIsLoadingLocationData(true);
      try {
        const [provinceResponse, cityResponse] = await Promise.all([
          fetch(`${PSGC_BASE_URL}/provinces/`),
          fetch(`${PSGC_BASE_URL}/cities-municipalities/`),
        ]);

        if (!provinceResponse.ok || !cityResponse.ok) {
          throw new Error("Failed to load location options");
        }

        const [provinceJson, cityJson] = await Promise.all([provinceResponse.json(), cityResponse.json()]);

        if (!isMounted) return;

        const provinces: ProvinceOption[] = (provinceJson || [])
          .map((item: any) => ({ code: String(item.code || ""), name: String(item.name || "").trim() }))
          .filter((item: ProvinceOption) => item.code && item.name)
          .sort((a: ProvinceOption, b: ProvinceOption) => a.name.localeCompare(b.name));

        const cities: CityOption[] = (cityJson || [])
          .map((item: any) => ({
            code: String(item.code || ""),
            name: String(item.name || "").trim(),
            provinceCode: item.provinceCode ? String(item.provinceCode) : undefined,
          }))
          .filter((item: CityOption) => item.code && item.name)
          .sort((a: CityOption, b: CityOption) => a.name.localeCompare(b.name));

        setProvinceOptions(provinces);
        setCityOptions(cities);
      } catch (error) {
        console.error("Failed to load PH location data:", error);
      } finally {
        if (isMounted) setIsLoadingLocationData(false);
      }
    };

    loadLocationData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadBarangays = async () => {
      if (!selectedCity?.code) {
        setBarangayOptions([]);
        return;
      }
      setIsLoadingBarangays(true);
      try {
        const response = await fetch(`${PSGC_BASE_URL}/cities-municipalities/${selectedCity.code}/barangays/`);
        if (!response.ok) {
          throw new Error("Failed to load barangays");
        }
        const json = await response.json();
        if (!isMounted) return;

        const items: BarangayOption[] = (json || [])
          .map((item: any) => ({ code: String(item.code || ""), name: String(item.name || "").trim() }))
          .filter((item: BarangayOption) => item.code && item.name)
          .sort((a: BarangayOption, b: BarangayOption) => a.name.localeCompare(b.name));

        setBarangayOptions(items);
      } catch (error) {
        console.error("Failed to load barangays:", error);
        if (isMounted) setBarangayOptions([]);
      } finally {
        if (isMounted) setIsLoadingBarangays(false);
      }
    };

    loadBarangays();

    return () => {
      isMounted = false;
    };
  }, [selectedCity?.code]);

  useEffect(() => {
    if (!incomingJobToEdit?._id) return;
    const safeReturnTo = locationState?.returnTo === ROUTES.employer.jobs
      ? ROUTES.employer.jobs
      : null;
    openEditModal(incomingJobToEdit, safeReturnTo);
    navigate(location.pathname, { replace: true, state: {} });
  }, [incomingJobToEdit, locationState?.returnTo, openEditModal, navigate, location.pathname]);

  const closeModal = () => {
    setShowModal(false);
    setEditingJob(null);
    setReturnAfterSave(null);
    setFormData(createEmptyForm());
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const trimmedTitle = formData.title.trim();
      const trimmedDescription = formData.description.trim();
      const composedLocation = composeLocation(formData);
      const deadlineValue = formData.deadline;
      const salaryAmount = Number(formData.minimumSalary.replace(/[^0-9]/g, "") || 0);
      const missingFields: RequiredFieldKey[] = [];

      if (!trimmedTitle) missingFields.push("title");
      if (!trimmedDescription) missingFields.push("description");
      if (!formData.province || !formData.city || !formData.barangay) missingFields.push("location");
      if (!salaryAmount) missingFields.push("salary");
      if (!formData.jobType) missingFields.push("jobType");
      if (!deadlineValue) missingFields.push("deadline");
      if (!formData.category) missingFields.push("category");

      if (missingFields.length > 0) {
        setFormError(
          t("postJob.errors.missingFields", {
            fields: missingFields.map((field) => requiredFieldLabels[field]).join(", "),
          })
        );
        const firstField = missingFields[0];
        requestAnimationFrame(() => {
          const selector =
            firstField === "salary" ? '[data-field="salary"]' : `[data-field="${firstField}"]`;
          const target = document.querySelector<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
          >(selector);
          if (!target) return;
          target.focus();
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        setSubmitting(false);
        return;
      }

      const positionsNeededNum = Number(formData.positionsNeeded || 1);
      if (!Number.isInteger(positionsNeededNum) || positionsNeededNum < 1) {
        setFormError(t("postJob.errors.invalidPositions"));
        setSubmitting(false);
        return;
      }

      const parsedDeadline = new Date(deadlineValue);
      if (!deadlineValue || Number.isNaN(parsedDeadline.getTime())) {
        setFormError(t("postJob.errors.invalidDeadline"));
        requestAnimationFrame(() => {
          const deadlineInput = document.querySelector<HTMLInputElement>('[data-field="deadline"]');
          if (!deadlineInput) return;
          deadlineInput.focus();
          deadlineInput.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        setSubmitting(false);
        return;
      }

      if (!Number.isFinite(salaryAmount) || salaryAmount <= 0) {
        setFormError(t("postJob.errors.invalidSalary"));
        setSubmitting(false);
        return;
      }

      const payload = {
        title: trimmedTitle,
        category: formData.category,
        description: trimmedDescription,
        requirements: formData.requirements
          ? formData.requirements.split("\n").map((item) => item.trim()).filter(Boolean)
          : [],
        skills: formData.skills
          ? formData.skills.split(",").map((item) => item.trim()).filter(Boolean)
          : [],
        salary: salaryAmount,
        location: composedLocation,
        jobType: formData.jobType,
        deadline: parsedDeadline.toISOString(),
        positionsNeeded: Number(formData.positionsNeeded) || 1,
      };

      if (editingJob?._id) {
        await jobsAPI.updateJob(editingJob._id, payload);
      } else {
        await jobsAPI.createJob(payload);
      }
      if (editingJob?._id && returnAfterSave) {
        navigate(returnAfterSave, { replace: true });
        return;
      }
      await loadJobs();
      closeModal();
    } catch (err: any) {
      // The server enforces this regardless of the openCreateModal pre-check
      // above (e.g. the profile was edited to remove the logo in another tab
      // while this modal stayed open) — redirect the same way rather than
      // showing a generic "post failed" message for a fixable cause.
      if (err?.code === "EMPLOYER_PROFILE_INCOMPLETE") {
        closeModal();
        toast.error(t("postJob.profileIncomplete.toast"));
        navigate(ROUTES.employer.settings);
        return;
      }
      setFormError(
        err?.response?.data?.message ||
          err?.message ||
          (editingJob ? t("postJob.errors.updateFailed") : t("postJob.errors.postFailed"))
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteJob = async (job: JobEdit) => {
    if (!job._id) return;
    try {
      await jobsAPI.deleteJob(job._id);
      await loadJobs();
      setDeleteTarget(null);
    } catch (err: any) {
      setJobsError(err?.response?.data?.message || t("postJob.errors.deleteFailed"));
    }
  };

  const handleToggleStatus = async (job: JobEdit) => {
    if (!job._id) return;
    const current = String(job.status || "Available");
    const nextStatus = current === "Closed" ? "Available" : "Closed";
    try {
      await jobsAPI.changeJobStatus(job._id, nextStatus);
      await loadJobs();
    } catch (err: any) {
      setJobsError(err?.response?.data?.message || t("postJob.errors.statusUpdateFailed"));
    }
  };

  return (
    <div className="ui-page px-4 md:px-0 pb-16">
      <div className="ui-page-header">
        <div>
          <h1 className="ui-page-title">{t("postJob.header.title")}</h1>
          <p className="ui-page-subtitle">{t("postJob.header.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1C4D8D] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#163f75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2"
        >
          <Plus size={20} />
          {t("postJob.actions.postJob")}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="ui-card p-5">
          <p className="text-sm font-medium text-slate-500">{t("postJob.stats.totalPostings")}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{totalPostings}</p>
        </div>
        <div className="ui-card p-5">
          <p className="text-sm font-medium text-slate-500">{t("postJob.stats.active")}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-emerald-600">{activePostings}</p>
        </div>
        <div className="ui-card p-5">
          <p className="text-sm font-medium text-slate-500">{t("postJob.status.closed")}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-400">{closedPostings}</p>
        </div>
      </div>

      {!loadingJobs && jobs.length > 0 && (
        <div className="ui-card p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[240px_240px_1fr]">
            <div className="relative">
              <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-10 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="all">{t("postJob.filters.allStatuses")}</option>
                <option value="Available">{t("postJob.status.available")}</option>
                <option value="In Progress">{t("postJob.status.inProgress")}</option>
                <option value="Closed">{t("postJob.status.closed")}</option>
                <option value="Cancelled">{t("postJob.status.cancelled")}</option>
                <option value="Completed">{t("postJob.status.completed")}</option>
              </select>
            </div>

            <div>
              <select
                value={jobTypeFilter}
                onChange={(e) => setJobTypeFilter(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
              >
                <option value="all">{t("postJob.filters.allJobs")}</option>
                {jobTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
                {LEGACY_JOB_TYPES.map((type) => (
                  <option key={type} value={type}>{t("postJob.filters.legacyOption", { type })}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("postJob.filters.searchPlaceholder")}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
        </div>
      )}

      {loadingJobs && (
        <div className="ui-card p-6 text-sm text-slate-500">
          {t("postJob.loading")}
        </div>
      )}

      {jobsError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{jobsError}</div>
      )}

      {!loadingJobs && jobs.length === 0 && (
        <div className="ui-card px-6 py-14 text-center">
          <div className="mx-auto w-fit rounded-full bg-blue-50 p-4">
            <BriefcaseBusiness size={32} className="text-[#1C4D8D]" />
          </div>
          <h3 className="mt-5 text-xl font-semibold text-slate-900">{t("postJob.emptyState.title")}</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">{t("postJob.emptyState.subtitle")}</p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[#1C4D8D] px-6 text-sm font-semibold text-white transition hover:bg-[#163f75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2"
          >
            <Plus size={20} />
            {t("postJob.actions.postJob")}
          </button>
        </div>
      )}

      {!loadingJobs && jobs.length > 0 && filteredJobs.length > 0 && (
        <div className="space-y-4">
          {filteredJobs.map((job) => {
            const categoryName = typeof job.category === "object" ? job.category?.name : "";
            const isClosed =
              job.status === "Closed" || job.status === "Cancelled" || job.status === "Completed";

            return (
              <div
                key={job._id}
                className="ui-card flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{job.title}</h3>
                  <div className="mt-1 text-slate-500">
                    {job.location || t("postJob.card.locationNotSet")} • {job.jobType || t("postJob.card.jobTypeNotSet")}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {categoryName && (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                        {categoryName}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-semibold ${
                        isClosed ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {statusLabels[job.status || "Available"] || job.status || t("postJob.status.available")}
                    </span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                      {formatMinimumPay(job.salary, t("postJob.card.payNotSet"))}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(job)}
                    className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2"
                  >
                    {t("postJob.card.edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(job)}
                    className="inline-flex min-h-11 items-center rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2"
                  >
                    {isClosed ? t("postJob.card.reopen") : t("postJob.card.close")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(job)}
                    className="inline-flex min-h-11 items-center rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
                  >
                    {t("postJob.card.delete")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loadingJobs && jobs.length > 0 && filteredJobs.length === 0 && (
        <div className="ui-card p-8 text-center">
          <h3 className="text-xl font-semibold text-slate-700">{t("postJob.noMatch.title")}</h3>
          <p className="mt-2 text-sm text-slate-500">
            {t("postJob.noMatch.subtitle")}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
              setJobTypeFilter("all");
            }}
            className="mt-4 inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {t("postJob.noMatch.clearFilters")}
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 p-3 md:p-8">
          <div className="flex min-h-full items-start justify-center">
            <div className="flex w-full max-w-5xl max-h-[calc(100vh-1.5rem)] md:max-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-5 md:px-7">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 sm:flex">
                      <BriefcaseBusiness size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                        {t("postJob.modal.employerWorkspace")}
                      </p>
                      <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                        {editingJob ? t("postJob.modal.editTitle") : t("postJob.modal.createTitle")}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {t("postJob.modal.subtitle")}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="ml-3 rounded-xl border border-transparent p-2 text-slate-400 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700"
                    aria-label={t("postJob.modal.closeAria")}
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
                {formError && !hasInsufficientBalanceError && (
                  <div
                    className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700"
                    role="alert"
                  >
                    <p>{formError}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-6">
                  <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
                        <ClipboardList size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{t("postJob.modal.roleOverview.title")}</h3>
                        <p className="mt-0.5 text-sm text-slate-500">{t("postJob.modal.roleOverview.subtitle")}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="job-title" className="mb-2 block text-sm font-semibold text-slate-700">
                        {t("postJob.modal.fields.jobTitle.label")} <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="job-title"
                        type="text"
                        data-field="title"
                        value={formData.title}
                        onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                        className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t("postJob.modal.fields.jobTitle.placeholder")}
                        maxLength={100}
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="job-category" className="mb-2 block text-sm font-semibold text-slate-700">
                        {t("postJob.modal.fields.category.label")} <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="job-category"
                        data-field="category"
                        value={formData.category}
                        onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                        className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">{t("postJob.modal.fields.category.placeholder")}</option>
                        {categories.map((category) => (
                          <option key={category._id} value={category._id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <fieldset data-field="jobType">
                    <legend className="mb-2 block text-sm font-semibold text-slate-700">
                      {t("postJob.modal.fields.opportunityType")} <span className="text-red-500">*</span>
                    </legend>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {jobTypeOptions.map((option) => {
                        const selected = formData.jobType === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setFormData((prev) => ({ ...prev, jobType: option.value }))}
                            className={`rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              selected
                                ? "border-blue-600 bg-blue-50 shadow-sm"
                                : "border-slate-200 bg-white hover:border-blue-300"
                            }`}
                          >
                            <span className={`block text-sm font-semibold ${selected ? "text-blue-700" : "text-slate-900"}`}>
                              {option.label}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
                          </button>
                        );
                      })}
                    </div>
                    {formData.jobType && !jobTypeOptions.some((option) => option.value === formData.jobType) && (
                      <p className="mt-2 text-xs text-amber-700">
                        {t("postJob.modal.legacyTypeWarning", { type: formData.jobType })}
                      </p>
                    )}
                  </fieldset>
                  </section>

                  <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <MapPin size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{t("postJob.modal.location.title")}</h3>
                        <p className="mt-0.5 text-sm text-slate-500">{t("postJob.modal.location.subtitle")}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label htmlFor="job-province" className="mb-2 block text-sm font-semibold text-slate-700">
                        {t("postJob.modal.location.province.label")} <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="job-province"
                        data-field="location"
                        value={formData.province}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            province: e.target.value,
                            city: "",
                            barangay: "",
                          }))
                        }
                        disabled={isLoadingLocationData}
                        className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">
                          {isLoadingLocationData ? t("postJob.modal.location.province.loading") : t("postJob.modal.location.province.placeholder")}
                        </option>
                        {provinceOptions.map((province) => (
                          <option key={province.code} value={province.name}>
                            {province.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="job-city" className="mb-2 block text-sm font-semibold text-slate-700">
                        {t("postJob.modal.location.city.label")} <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="job-city"
                        value={formData.city}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            city: e.target.value,
                            barangay: "",
                          }))
                        }
                        disabled={isLoadingLocationData || !formData.province}
                        className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">
                          {!formData.province
                            ? t("postJob.modal.location.city.selectProvinceFirst")
                            : isLoadingLocationData
                            ? t("postJob.modal.location.city.loading")
                            : t("postJob.modal.location.city.placeholder")}
                        </option>
                        {filteredCityOptions.map((city) => (
                          <option key={city.code} value={city.name}>
                            {city.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="job-barangay" className="mb-2 block text-sm font-semibold text-slate-700">
                        {t("postJob.modal.location.barangay.label")} <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="job-barangay"
                        value={formData.barangay}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            barangay: e.target.value,
                          }))
                        }
                        disabled={isLoadingBarangays || !formData.city}
                        className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">
                          {!formData.city
                            ? t("postJob.modal.location.barangay.selectCityFirst")
                            : isLoadingBarangays
                            ? t("postJob.modal.location.barangay.loading")
                            : t("postJob.modal.location.barangay.placeholder")}
                        </option>
                        {barangayOptions.map((barangay) => (
                          <option key={barangay.code} value={barangay.name}>
                            {barangay.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                    <div>
                    <label htmlFor="job-address" className="mb-2 block text-sm font-semibold text-slate-700">{t("postJob.modal.location.address.label")} <span className="font-normal text-slate-400">{t("postJob.modal.location.address.optional")}</span></label>
                    <input
                      id="job-address"
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                      className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t("postJob.modal.location.address.placeholder")}
                    />
                    </div>

                    <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <span>
                        <span className="font-semibold text-slate-700">{t("postJob.modal.location.preview.label")}</span>{" "}
                        {composeLocation(formData) || t("postJob.modal.location.preview.placeholder")}
                      </span>
                    </div>
                  </section>

                  <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
                        <WalletCards size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{t("postJob.modal.pay.title")}</h3>
                        <p className="mt-0.5 text-sm text-slate-500">{t("postJob.modal.pay.subtitle")}</p>
                      </div>
                    </div>

                    <div>
                    <label htmlFor="job-minimum-pay" className="mb-2 block text-sm font-semibold text-slate-700">
                      {t("postJob.modal.pay.label")} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">₱</span>
                      <input
                        id="job-minimum-pay"
                        aria-label={t("postJob.modal.pay.ariaLabel")}
                        type="text"
                        data-field="salary"
                        inputMode="numeric"
                        value={formData.minimumSalary}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            minimumSalary: e.target.value.replace(/[^0-9]/g, ""),
                          }))
                        }
                        className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t("postJob.modal.pay.placeholder")}
                        required
                      />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {t("postJob.modal.pay.helper")}
                    </p>
                  </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <DateField
                        id="job-deadline"
                        label={t("postJob.modal.deadline.label")}
                        dataField="deadline"
                        required
                        minDate={new Date()}
                        value={formData.deadline ? parseDateInputValue(formData.deadline) : null}
                        onChange={(next) => setFormData((prev) => ({ ...prev, deadline: next ? formatDateInputValue(next) : "" }))}
                      />
                    </div>

                    <div>
                      <label htmlFor="job-positions" className="mb-2 block text-sm font-semibold text-slate-700">{t("postJob.modal.positions.label")}</label>
                      <input
                        id="job-positions"
                        type="number"
                        min={1}
                        value={formData.positionsNeeded}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, positionsNeeded: e.target.value }))
                        }
                        className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    </div>

                    <div className="flex flex-col gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-blue-900">
                          {editingJob ? t("postJob.modal.walletSummary.estimatedValue") : t("postJob.modal.walletSummary.fundsNeeded")}
                        </p>
                        <p className="mt-0.5 text-xs text-blue-700">
                          {t("postJob.modal.walletSummary.formula", {
                            rate: formatCurrency(Number(formData.minimumSalary || 0), { maximumFractionDigits: 0 }),
                            count: Number(formData.positionsNeeded || 0),
                          })}
                        </p>
                      </div>
                      <p className="text-2xl font-bold tracking-tight text-blue-700">
                        {formatCurrency(estimatedEscrow, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </section>

                  <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <FileText size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{t("postJob.description.title")}</h3>
                        <p className="mt-0.5 text-sm text-slate-500">{t("postJob.description.subtitle")}</p>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="job-description" className="mb-2 block text-sm font-semibold text-slate-700">
                        {t("postJob.description.label")} <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="job-description"
                        data-field="description"
                        value={formData.description}
                        onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                        className="min-h-[140px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        placeholder={t("postJob.description.placeholder")}
                        maxLength={3000}
                        required
                      />
                      <p className="mt-2 text-right text-xs text-slate-400">{t("postJob.description.counter", { count: formData.description.length })}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label htmlFor="job-requirements" className="mb-2 block text-sm font-semibold text-slate-700">
                          {t("postJob.requirements.label")} <span className="font-normal text-slate-400">{t("postJob.requirements.optional")}</span>
                        </label>
                        <textarea
                          id="job-requirements"
                          value={formData.requirements}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, requirements: e.target.value }))
                          }
                          className="min-h-[110px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          placeholder={t("postJob.requirements.placeholder")}
                        />
                      </div>

                      <div>
                        <label htmlFor="job-skills" className="mb-2 block text-sm font-semibold text-slate-700">
                          {t("postJob.skills.label")} <span className="font-normal text-slate-400">{t("postJob.skills.optional")}</span>
                        </label>
                        <textarea
                          id="job-skills"
                          value={formData.skills}
                          onChange={(e) => setFormData((prev) => ({ ...prev, skills: e.target.value }))}
                          className="min-h-[110px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          placeholder={t("postJob.skills.placeholder")}
                        />
                        <p className="mt-2 text-xs text-slate-400">{t("postJob.skills.helper")}</p>
                      </div>
                    </div>
                  </section>

                  <div className="sticky -bottom-5 z-10 grid grid-cols-2 gap-3 border-t border-slate-200 bg-white px-1 pb-1 pt-5">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="h-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      disabled={submitting}
                    >
                      {t("postJob.actions.cancel")}
                    </button>
                    <button
                      type="submit"
                      className="h-11 rounded-xl bg-[#1C4D8D] text-sm font-semibold text-white transition hover:bg-[#163f75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2 disabled:opacity-60"
                      disabled={submitting}
                    >
                      {submitting
                        ? editingJob
                          ? t("postJob.actions.updating")
                          : t("postJob.actions.posting")
                        : editingJob
                        ? t("postJob.actions.saveChanges")
                        : t("postJob.actions.postJobWithPrice", {
                            amount: formatCurrency(estimatedEscrow, { maximumFractionDigits: 0 }),
                          })}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {hasInsufficientBalanceError && (
            <motion.div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
            >
              <motion.div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="insufficient-balance-title"
                aria-describedby="insufficient-balance-description"
                className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-6 text-center shadow-2xl"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl font-bold text-red-600">
                  !
                </div>
                <h3 id="insufficient-balance-title" className="mt-4 text-xl font-bold text-slate-900">
                  {t("postJob.insufficientBalance.title")}
                </h3>
                <p id="insufficient-balance-description" className="mt-2 text-sm leading-6 text-slate-600">
                  {formError}
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormError(null)}
                    className="h-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    {t("postJob.insufficientBalance.notNow")}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(ROUTES.employer.eWallet)}
                    className="h-11 rounded-xl bg-[#1C4D8D] text-sm font-semibold text-white transition hover:bg-[#163f75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2"
                  >
                    {t("postJob.insufficientBalance.topUp")}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t("postJob.deleteDialog.title")}
        description={t("postJob.deleteDialog.description", {
          title: deleteTarget?.title || t("postJob.deleteDialog.defaultTitle"),
        })}
        confirmLabel={t("postJob.deleteDialog.confirm")}
        destructive
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDeleteJob(deleteTarget)}
      />
    </div>
  );
};

export default PostJob;
