import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BriefcaseBusiness, Plus, X } from "lucide-react";
import { categoriesAPI, jobsAPI } from "../../services/jobs";

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

type FormState = {
  title: string;
  category: string;
  description: string;
  requirements: string;
  responsibilities: string;
  skills: string;
  salaryMin: string;
  salaryMax: string;
  location: string;
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
  salary: "Salary range",
  jobType: "Job type",
  deadline: "Deadline",
  category: "Category",
};

const createEmptyForm = (): FormState => ({
  title: "",
  category: "",
  description: "",
  requirements: "",
  responsibilities: "",
  skills: "",
  salaryMin: "",
  salaryMax: "",
  location: "",
  jobType: "Fulltime",
  deadline: "",
  positionsNeeded: "1",
});

const extractSalaryValue = (value: unknown): string => {
  const raw = String(value ?? "").replace(/[^0-9]/g, "");
  return raw ? String(Number(raw)) : "";
};

const formatCurrency = (value: unknown): string => {
  const salary = extractSalaryValue(value);
  if (!salary) return "Not set";
  return `P${new Intl.NumberFormat("en-PH").format(Number(salary))}`;
};

const buildFormFromJob = (job: JobEdit): FormState => {
  const categoryId = typeof job.category === "object" ? job.category?._id : job.category;
  const salary = extractSalaryValue(job.salary);
  return {
    title: job.title || "",
    category: categoryId || "",
    description: job.description || "",
    requirements: job.requirements?.join("\n") || "",
    responsibilities: job.responsibilities?.join("\n") || "",
    skills: job.skills?.join(", ") || "",
    salaryMin: salary,
    salaryMax: salary,
    location: job.location || "",
    jobType: job.jobType || "Fulltime",
    deadline: job.deadline ? new Date(job.deadline).toISOString().slice(0, 10) : "",
    positionsNeeded: job.positionsNeeded ? String(job.positionsNeeded) : "1",
  };
};

const PostJob: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { job?: JobEdit } | null;
  const incomingJobToEdit = locationState?.job;

  const [jobs, setJobs] = useState<JobEdit[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState<JobEdit | null>(null);
  const [formData, setFormData] = useState<FormState>(createEmptyForm());
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    setFormData(createEmptyForm());
    setFormError(null);
    setShowModal(true);
  }, []);

  const openEditModal = useCallback((job: JobEdit) => {
    setEditingJob(job);
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
    if (!incomingJobToEdit?._id) return;
    openEditModal(incomingJobToEdit);
    navigate(location.pathname, { replace: true, state: {} });
  }, [incomingJobToEdit, openEditModal, navigate, location.pathname]);

  const closeModal = () => {
    setShowModal(false);
    setEditingJob(null);
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
      const trimmedLocation = formData.location.trim();
      const deadlineValue = formData.deadline;
      const salaryMin = Number(formData.salaryMin.replace(/[^0-9]/g, "") || 0);
      const salaryMax = Number(formData.salaryMax.replace(/[^0-9]/g, "") || 0);
      const salaryAmount = salaryMax || salaryMin;
      const missingFields: RequiredFieldKey[] = [];

      if (!trimmedTitle) missingFields.push("title");
      if (!trimmedDescription) missingFields.push("description");
      if (!trimmedLocation) missingFields.push("location");
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
      if (Number.isNaN(positionsNeededNum) || positionsNeededNum < 1) {
        setFormError("Please provide a valid number of workers needed (minimum 1).");
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

      if (salaryMin > 0 && salaryMax > 0 && salaryMax < salaryMin) {
        setFormError("Maximum salary cannot be lower than minimum salary.");
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
        responsibilities: formData.responsibilities
          ? formData.responsibilities.split("\n").map((item) => item.trim()).filter(Boolean)
          : [],
        skills: formData.skills
          ? formData.skills.split(",").map((item) => item.trim()).filter(Boolean)
          : [],
        salary: salaryAmount,
        location: trimmedLocation,
        jobType: formData.jobType,
        deadline: parsedDeadline.toISOString(),
        positionsNeeded: Number(formData.positionsNeeded) || 1,
      };

      if (editingJob?._id) {
        await jobsAPI.updateJob(editingJob._id, payload);
      } else {
        await jobsAPI.createJob(payload);
      }
      await loadJobs();
      closeModal();
    } catch (err: any) {
      setFormError(
        err?.response?.data?.message || (editingJob ? "Failed to update job." : "Failed to post job.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteJob = async (job: JobEdit) => {
    const ok = window.confirm(`Delete "${job.title || "this job"}"?`);
    if (!ok || !job._id) return;
    try {
      await jobsAPI.deleteJob(job._id);
      await loadJobs();
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
        <div>
          <h1 className="ui-page-title">My Job Postings</h1>
          <p className="ui-page-subtitle">Create and manage your open positions</p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
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

      {!loadingJobs && jobs.length > 0 && (
        <div className="space-y-4">
          {jobs.map((job) => {
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
                    onClick={() => handleDeleteJob(job)}
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4 md:items-center md:p-8">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <h2 className="text-2xl md:text-3xl font-semibold text-slate-900">
                {editingJob ? "Edit Job" : "Post a New Job"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close modal"
              >
                <X size={24} />
              </button>
            </div>

            <div className="px-6 py-5">
              {formError && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Job Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      data-field="title"
                      value={formData.title}
                      onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                      className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="e.g. Senior Engineer"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Location <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      data-field="location"
                      value={formData.location}
                      onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                      className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="e.g. Manila or Remote"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Job Type</label>
                    <select
                      data-field="jobType"
                      value={formData.jobType}
                      onChange={(e) => setFormData((prev) => ({ ...prev, jobType: e.target.value }))}
                      className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                      required
                    >
                      <option value="Fulltime">Fulltime</option>
                      <option value="Freelance">Freelance</option>
                      <option value="Contract">Contract</option>
                      <option value="Remote">Remote</option>
                      <option value="Part-time">Part-time</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Salary Range (PHP / month) <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <input
                      type="text"
                      data-field="salary"
                      inputMode="numeric"
                      value={formData.salaryMin}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          salaryMin: e.target.value.replace(/[^0-9]/g, ""),
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="Min (e.g. 20000)"
                    />
                    <span className="text-slate-400 text-xl leading-none">-</span>
                    <input
                      type="text"
                      data-field="salary"
                      inputMode="numeric"
                      value={formData.salaryMax}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          salaryMax: e.target.value.replace(/[^0-9]/g, ""),
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="Max (e.g. 50000)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Deadline <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      data-field="deadline"
                      value={formData.deadline}
                      onChange={(e) => setFormData((prev) => ({ ...prev, deadline: e.target.value }))}
                      className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Positions Needed</label>
                    <input
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

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Job Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    data-field="description"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    className="min-h-[110px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Describe the role, responsibilities, and team..."
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Requirements</label>
                  <textarea
                    value={formData.requirements}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, requirements: e.target.value }))
                    }
                    className="min-h-[100px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Skills, experience, qualifications needed..."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Responsibilities</label>
                  <textarea
                    value={formData.responsibilities}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, responsibilities: e.target.value }))
                    }
                    className="min-h-[100px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Daily tasks and ownership for this role..."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Skills (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.skills}
                    onChange={(e) => setFormData((prev) => ({ ...prev, skills: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="React, TypeScript, Communication"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
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
                  className="h-11 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-60"
                  disabled={submitting}
                >
                  {submitting
                    ? editingJob
                      ? "Updating..."
                      : "Posting..."
                    : editingJob
                    ? "Update Job"
                    : "Post Job"}
                </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostJob;
