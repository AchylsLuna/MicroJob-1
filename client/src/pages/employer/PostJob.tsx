import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BriefcaseBusiness, Filter, Plus, Search, X } from "lucide-react";
import { categoriesAPI, jobsAPI } from "../../services/jobs";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "../../lib/toast";
import { ConfirmDialog } from "../../components/ui";
import { ROUTES } from "../../utils/routes";
import { formatMinimumPay } from "../../lib/jobCompensation";
import PostJobWizard from "../../components/job/PostJobWizard";
import {
  type JobEdit,
  type FormState,
  type ProvinceOption,
  type CityOption,
  type BarangayOption,
  type RequiredFieldKey,
  getJobTypeOptions,
  getRequiredFieldLabels,
  LEGACY_JOB_TYPES,
  createEmptyForm,
  buildFormFromJob,
  composeLocation,
} from "../../components/job/postJobForm";

const PSGC_BASE_URL = "https://psgc.gitlab.io/api";

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

  const selectedCity = cityOptions.find(
    (item) => item.name.toLowerCase() === formData.city.trim().toLowerCase(),
  );

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
  const hasCompleteProfile = Boolean(user?.avatarUrl?.trim());

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
                <PostJobWizard
                  formData={formData}
                  setFormData={setFormData}
                  editingJob={editingJob}
                  categories={categories}
                  provinceOptions={provinceOptions}
                  cityOptions={cityOptions}
                  barangayOptions={barangayOptions}
                  isLoadingLocationData={isLoadingLocationData}
                  isLoadingBarangays={isLoadingBarangays}
                  submitting={submitting}
                  formError={formError}
                  hasInsufficientBalanceError={hasInsufficientBalanceError}
                  onSubmit={handleSubmit}
                  onCancel={closeModal}
                />
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
