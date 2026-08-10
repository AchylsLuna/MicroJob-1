import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
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
import { ConfirmDialog } from "../../components/ui";
import { ROUTES } from "../../utils/routes";

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

const JOB_TYPE_OPTIONS = [
  {
    value: "Short-term",
    label: "Short-term",
    description: "One-time or temporary work with a clear finish.",
  },
  {
    value: "Side hustle",
    label: "Side hustle",
    description: "Flexible work someone can take on for extra income.",
  },
  {
    value: "Recruiting",
    label: "Recruiting",
    description: "Hire for an ongoing or longer-term role.",
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

const REQUIRED_FIELD_LABELS: Record<RequiredFieldKey, string> = {
  title: "Job title",
  description: "Job description",
  location: "Location",
  salary: "Minimum guaranteed pay",
  jobType: "Job type",
  deadline: "Deadline",
  category: "Category",
};

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
  const chunks = [form.address.trim(), form.barangay.trim(), form.city.trim(), form.province.trim()].filter(Boolean);
  return chunks.join(", ");
};

const extractSalaryValue = (value: unknown): string => {
  const raw = String(value ?? "").replace(/[^0-9]/g, "");
  return raw ? String(Number(raw)) : "";
};

const formatCurrency = (value: unknown): string => {
  const salary = extractSalaryValue(value);
  if (!salary) return "Not set";
  return `₱${new Intl.NumberFormat("en-PH").format(Number(salary))} minimum`;
};

const formatPesoAmount = (value: number): string =>
  `₱${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value)}`;

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
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { job?: JobEdit; returnTo?: string } | null;
  const incomingJobToEdit = locationState?.job;

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
      setJobsError(err?.response?.data?.message || "Failed to load job postings.");
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  const openCreateModal = useCallback(() => {
    setEditingJob(null);
    setReturnAfterSave(null);
    setFormData(createEmptyForm());
    setFormError(null);
    setShowModal(true);
  }, []);

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
          `Please complete: ${missingFields.map((field) => REQUIRED_FIELD_LABELS[field]).join(", ")}.`
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
        setFormError("Please provide a whole number of workers needed (minimum 1).");
        setSubmitting(false);
        return;
      }

      const parsedDeadline = new Date(deadlineValue);
      if (!deadlineValue || Number.isNaN(parsedDeadline.getTime())) {
        setFormError("Please provide a valid deadline date.");
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
        setFormError("Minimum guaranteed pay must be greater than zero.");
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
      setFormError(
        err?.response?.data?.message ||
          err?.message ||
          (editingJob ? "Failed to update job." : "Failed to post job.")
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
      setJobsError(err?.response?.data?.message || "Failed to delete job.");
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
      setJobsError(err?.response?.data?.message || "Failed to update job status.");
    }
  };

  return (
    <div className="ui-page px-4 md:px-0 pb-16">
      <div className="ui-page-header">
        <button
          type="button"
          onClick={openCreateModal}
          className="ml-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          <Plus size={20} />
          Post a Job
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="ui-card p-8 text-center">
          <p className="text-4xl font-bold text-slate-900">{totalPostings}</p>
          <p className="mt-2 text-base text-slate-500">Total Postings</p>
        </div>
        <div className="ui-card p-8 text-center">
          <p className="text-4xl font-bold text-emerald-600">{activePostings}</p>
          <p className="mt-2 text-base text-slate-500">Active</p>
        </div>
        <div className="ui-card p-8 text-center">
          <p className="text-4xl font-bold text-slate-400">{closedPostings}</p>
          <p className="mt-2 text-base text-slate-500">Closed</p>
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
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-10 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              >
                <option value="all">All Statuses</option>
                <option value="Available">Available</option>
                <option value="In Progress">In Progress</option>
                <option value="Closed">Closed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div>
              <select
                value={jobTypeFilter}
                onChange={(e) => setJobTypeFilter(e.target.value)}
                className="h-12 w-full rounded-xl border border-indigo-500 bg-white px-4 pr-10 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              >
                <option value="all">All Jobs</option>
                {JOB_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
                {LEGACY_JOB_TYPES.map((type) => (
                  <option key={type} value={type}>{type} (legacy)</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search jobs by title, location, skill, or category..."
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          </div>
        </div>
      )}

      {loadingJobs && (
        <div className="ui-card p-6 text-sm text-slate-500">
          Loading your job postings...
        </div>
      )}

      {jobsError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{jobsError}</div>
      )}

      {!loadingJobs && jobs.length === 0 && (
        <div className="ui-card px-6 py-20 text-center">
          <div className="mx-auto w-fit rounded-full bg-slate-100 p-5">
            <BriefcaseBusiness size={48} className="text-slate-300" />
          </div>
          <h3 className="mt-6 text-3xl font-semibold text-slate-500">No job postings yet</h3>
          <p className="mt-2 text-base text-slate-400">Post your first job to start receiving applications</p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            <Plus size={20} />
            Post a Job
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
                    {job.location || "Location not set"} • {job.jobType || "Job type not set"}
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
                      {job.status || "Available"}
                    </span>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">
                      {formatCurrency(job.salary)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(job)}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(job)}
                    className="h-10 rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    {isClosed ? "Reopen" : "Close"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(job)}
                    className="h-10 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loadingJobs && jobs.length > 0 && filteredJobs.length === 0 && (
        <div className="ui-card p-8 text-center">
          <h3 className="text-xl font-semibold text-slate-700">No jobs match your filters</h3>
          <p className="mt-2 text-sm text-slate-500">
            Try a different keyword or clear one of the filters.
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
            Clear Filters
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
                    <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 sm:flex">
                      <BriefcaseBusiness size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
                        Employer workspace
                      </p>
                      <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                        {editingJob ? "Edit job details" : "Create a job post"}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Only the essential details workers need to decide and apply.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="ml-3 rounded-xl border border-transparent p-2 text-slate-400 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700"
                    aria-label="Close modal"
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
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200">
                        <ClipboardList size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">Role overview</h3>
                        <p className="mt-0.5 text-sm text-slate-500">Name the work and choose the opportunity that fits it best.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="job-title" className="mb-2 block text-sm font-semibold text-slate-700">
                        Job Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="job-title"
                        type="text"
                        data-field="title"
                        value={formData.title}
                        onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                        className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="e.g. Weekend event assistant"
                        maxLength={100}
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="job-category" className="mb-2 block text-sm font-semibold text-slate-700">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="job-category"
                        data-field="category"
                        value={formData.category}
                        onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                        className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                        required
                      >
                        <option value="">Select category</option>
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
                      Opportunity Type <span className="text-red-500">*</span>
                    </legend>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {JOB_TYPE_OPTIONS.map((option) => {
                        const selected = formData.jobType === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setFormData((prev) => ({ ...prev, jobType: option.value }))}
                            className={`rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                              selected
                                ? "border-indigo-600 bg-indigo-50 shadow-sm"
                                : "border-slate-200 bg-white hover:border-indigo-300"
                            }`}
                          >
                            <span className={`block text-sm font-semibold ${selected ? "text-indigo-700" : "text-slate-900"}`}>
                              {option.label}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
                          </button>
                        );
                      })}
                    </div>
                    {formData.jobType && !JOB_TYPE_OPTIONS.some((option) => option.value === formData.jobType) && (
                      <p className="mt-2 text-xs text-amber-700">
                        This existing post uses the legacy type “{formData.jobType}”. Choose a current type to modernize it.
                      </p>
                    )}
                  </fieldset>
                  </section>

                  <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <MapPin size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">Work location</h3>
                        <p className="mt-0.5 text-sm text-slate-500">Choose the area first, then add an optional landmark or street.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label htmlFor="job-province" className="mb-2 block text-sm font-semibold text-slate-700">
                        Province <span className="text-red-500">*</span>
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
                        className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                        required
                      >
                        <option value="">
                          {isLoadingLocationData ? "Loading provinces..." : "Select province"}
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
                        City / Municipality <span className="text-red-500">*</span>
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
                        className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                        required
                      >
                        <option value="">
                          {!formData.province
                            ? "Select province first"
                            : isLoadingLocationData
                            ? "Loading cities..."
                            : "Select city/municipality"}
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
                        Barangay <span className="text-red-500">*</span>
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
                        className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                        required
                      >
                        <option value="">
                          {!formData.city
                            ? "Select city first"
                            : isLoadingBarangays
                            ? "Loading barangays..."
                            : "Select barangay"}
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
                    <label htmlFor="job-address" className="mb-2 block text-sm font-semibold text-slate-700">Street or landmark <span className="font-normal text-slate-400">(optional)</span></label>
                    <input
                      id="job-address"
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                      className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="e.g. Rizal Street, near City Hall"
                    />
                    </div>

                    <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <span>
                        <span className="font-semibold text-slate-700">Location preview:</span>{" "}
                        {composeLocation(formData) || "Select province, city, and barangay"}
                      </span>
                    </div>
                  </section>

                  <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200">
                        <WalletCards size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">Pay and schedule</h3>
                        <p className="mt-0.5 text-sm text-slate-500">Set the guaranteed pay, worker count, and completion deadline.</p>
                      </div>
                    </div>

                    <div>
                    <label htmlFor="job-minimum-pay" className="mb-2 block text-sm font-semibold text-slate-700">
                      Minimum Guaranteed Pay per Worker (PHP) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">₱</span>
                      <input
                        id="job-minimum-pay"
                        aria-label="Minimum guaranteed pay per worker"
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
                        className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="e.g. 1500"
                        required
                      />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Enter the minimum amount guaranteed to each hired worker. This amount is secured in escrow.
                    </p>
                  </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="job-deadline" className="mb-2 block text-sm font-semibold text-slate-700">
                        Deadline <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="job-deadline"
                        type="date"
                        data-field="deadline"
                        value={formData.deadline}
                        onChange={(e) => setFormData((prev) => ({ ...prev, deadline: e.target.value }))}
                        className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="job-positions" className="mb-2 block text-sm font-semibold text-slate-700">Positions Needed</label>
                      <input
                        id="job-positions"
                        type="number"
                        min={1}
                        value={formData.positionsNeeded}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, positionsNeeded: e.target.value }))
                        }
                        className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                    </div>

                    <div className="flex flex-col gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-indigo-950">
                          {editingJob ? "Estimated job value" : "Wallet funds needed"}
                        </p>
                        <p className="mt-0.5 text-xs text-indigo-700">
                          {formatPesoAmount(Number(formData.minimumSalary || 0))} × {Number(formData.positionsNeeded || 0)} worker{Number(formData.positionsNeeded || 0) === 1 ? "" : "s"}
                        </p>
                      </div>
                      <p className="text-2xl font-bold tracking-tight text-indigo-700">
                        {formatPesoAmount(estimatedEscrow)}
                      </p>
                    </div>
                  </section>

                  <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <FileText size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">What the worker will do</h3>
                        <p className="mt-0.5 text-sm text-slate-500">Keep it practical: describe the work, then add only the requirements that matter.</p>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="job-description" className="mb-2 block text-sm font-semibold text-slate-700">
                        Job description <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="job-description"
                        data-field="description"
                        value={formData.description}
                        onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                        className="min-h-[140px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                        placeholder="Explain the task, main responsibilities, expected result, and anything the worker should know."
                        maxLength={3000}
                        required
                      />
                      <p className="mt-2 text-right text-xs text-slate-400">{formData.description.length}/3000</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label htmlFor="job-requirements" className="mb-2 block text-sm font-semibold text-slate-700">
                          Requirements <span className="font-normal text-slate-400">(optional)</span>
                        </label>
                        <textarea
                          id="job-requirements"
                          value={formData.requirements}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, requirements: e.target.value }))
                          }
                          className="min-h-[110px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                          placeholder={"One requirement per line\nExample: Available on weekends"}
                        />
                      </div>

                      <div>
                        <label htmlFor="job-skills" className="mb-2 block text-sm font-semibold text-slate-700">
                          Helpful skills <span className="font-normal text-slate-400">(optional)</span>
                        </label>
                        <textarea
                          id="job-skills"
                          value={formData.skills}
                          onChange={(e) => setFormData((prev) => ({ ...prev, skills: e.target.value }))}
                          className="min-h-[110px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                          placeholder="Communication, driving, customer service"
                        />
                        <p className="mt-2 text-xs text-slate-400">Separate skills with commas.</p>
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
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="h-11 rounded-xl bg-indigo-600 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                      disabled={submitting}
                    >
                      {submitting
                        ? editingJob
                          ? "Updating..."
                          : "Posting..."
                        : editingJob
                        ? "Save changes"
                        : `Post job · ${formatPesoAmount(estimatedEscrow)}`}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      {hasInsufficientBalanceError && typeof document !== "undefined" && createPortal(
        <div
          className="flex items-center justify-center p-4"
          style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100dvh",
            zIndex: 9999,
            backgroundColor: "rgba(107, 114, 128, 0.72)",
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="insufficient-balance-title"
            aria-describedby="insufficient-balance-description"
            className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-6 text-center shadow-2xl"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl font-bold text-red-600">
              !
            </div>
            <h3 id="insufficient-balance-title" className="mt-4 text-xl font-bold text-slate-900">
              Insufficient balance
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
                Not now
              </button>
              <button
                type="button"
                onClick={() => navigate(ROUTES.employer.eWallet)}
                className="h-11 rounded-xl bg-indigo-600 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
              >
                Top up wallet
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete job"
        description={`Delete “${deleteTarget?.title || "this job"}”? This action cannot be undone.`}
        confirmLabel="Delete job"
        destructive
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDeleteJob(deleteTarget)}
      />
    </div>
  );
};

export default PostJob;
