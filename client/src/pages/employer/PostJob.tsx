import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { categoriesAPI, jobsAPI } from "../../services/jobs";
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
};

const PostJob: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const jobToEdit = (location.state as { job?: JobEdit } | undefined)?.job;
  const isEditing = Boolean(jobToEdit?._id);
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    description: "",
    requirements: "",
    responsibilities: "",
    skills: "",
    salary: "",
    location: "",
    jobType: "Fulltime",
    deadline: "",
    positionsNeeded: "1",
  });
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [showCategoryOptions, setShowCategoryOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedSalary = useMemo(() => {
    if (!jobToEdit?.salary) return "";
    const matches = jobToEdit.salary.match(/\d[\d,]*/g);
    return matches?.[0] || "";
  }, [jobToEdit]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await categoriesAPI.getCategories();
        setCategories(response.data || []);
      } catch (err) {
        console.error("Failed to load categories", err);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!categoryQuery) {
      setFormData((prev) => {
        if (isEditing && prev.category) return prev;
        return { ...prev, category: "" };
      });
      return;
    }

    const match = categories.find((category) =>
      category.name.toLowerCase() === categoryQuery.toLowerCase()
    );
    setFormData((prev) => ({ ...prev, category: match?._id || prev.category }));
  }, [categoryQuery, categories, isEditing]);

  useEffect(() => {
    if (!jobToEdit) return;
    const categoryId = typeof jobToEdit.category === "object" ? jobToEdit.category?._id : jobToEdit.category;
    const categoryName = typeof jobToEdit.category === "object" ? jobToEdit.category?.name : "";
    const deadlineValue = jobToEdit.deadline
      ? new Date(jobToEdit.deadline).toISOString().slice(0, 10)
      : "";
    setFormData({
      title: jobToEdit.title || "",
      category: categoryId || "",
      description: jobToEdit.description || "",
      requirements: jobToEdit.requirements?.join("\n") || "",
      responsibilities: jobToEdit.responsibilities?.join("\n") || "",
      skills: jobToEdit.skills?.join(", ") || "",
      salary: parsedSalary,
      location: jobToEdit.location || "",
      jobType: jobToEdit.jobType || "Fulltime",
      deadline: deadlineValue,
      positionsNeeded: (jobToEdit as any).positionsNeeded ? String((jobToEdit as any).positionsNeeded) : "1",
    });
    setCategoryQuery(categoryName || "");
  }, [jobToEdit, parsedSalary]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const trimmedTitle = formData.title.trim();
      const trimmedDescription = formData.description.trim();
      const trimmedLocation = formData.location.trim();
      const deadlineValue = formData.deadline;
      const rawSalary = formData.salary.replace(/[^0-9]/g, "");
      const salaryAmount = rawSalary ? Number(rawSalary) : 0;
      const missingFields: string[] = [];

      if (!trimmedTitle) missingFields.push("title");
      if (!trimmedDescription) missingFields.push("description");
      if (!trimmedLocation) missingFields.push("location");
      if (!rawSalary) missingFields.push("salary");
      if (!formData.jobType) missingFields.push("job type");
      if (!deadlineValue) missingFields.push("deadline");

      if (missingFields.length > 0) {
        setError(`Missing required fields: ${missingFields.join(", ")}.`);
        setSubmitting(false);
        return;
      }

      const positionsNeededNum = Number(formData.positionsNeeded || 1);
      if (Number.isNaN(positionsNeededNum) || positionsNeededNum < 1) {
        setError('Please provide a valid number of workers needed (minimum 1).');
        setSubmitting(false);
        return;
      }

      const parsedDeadline = new Date(deadlineValue);
      if (!deadlineValue || Number.isNaN(parsedDeadline.getTime())) {
        setError("Please provide a valid deadline date.");
        setSubmitting(false);
        return;
      }

      if (!formData.category && !(isEditing && jobToEdit?.category)) {
        setError("Please select a valid category from the list.");
        setSubmitting(false);
        return;
      }
      const payload = {
        title: trimmedTitle,
        category: formData.category || undefined,
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

      if (isEditing && jobToEdit?._id) {
        await jobsAPI.updateJob(jobToEdit._id, payload);
      } else {
        await jobsAPI.createJob(payload);
      }
      navigate(ROUTES.employer.jobPosts);
    } catch (err: any) {
      setError(err?.response?.data?.message || (isEditing ? "Failed to update job." : "Failed to post job."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      <div>
        <h2 className="font-semibold text-[20px] text-[#111827]">{isEditing ? "Edit Job" : "Post a Job"}</h2>
        <p className="text-[14px] text-[#6B7280] mt-1">Find the right talent for your project.</p>
      </div>

      <div className="pb-20">
        <div className="bg-white rounded-2xl p-8 shadow-sm max-w-4xl border border-gray-200">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 mb-6">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-base font-semibold text-gray-900 mb-2">Job Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="e.g. Senior React Developer"
                  required
                />
              </div>


              <div>
                <label className="block text-base font-semibold text-gray-900 mb-2">Category</label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={categoryQuery}
                      onChange={(e) => {
                        setCategoryQuery(e.target.value);
                        setShowCategoryOptions(true);
                      }}
                      onFocus={() => setShowCategoryOptions(true)}
                      onBlur={() => setTimeout(() => setShowCategoryOptions(false), 150)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="Type a category (e.g. Pets, Errands)"
                      required
                    />
                    {showCategoryOptions && (
                      <div className="absolute z-10 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-52 overflow-auto">
                        {categories
                          .filter((category) =>
                            category.name.toLowerCase().includes(categoryQuery.toLowerCase())
                          )
                          .map((category) => (
                            <button
                              key={category._id}
                              type="button"
                              className="w-full text-left px-4 py-2 hover:bg-sky-50"
                              onMouseDown={() => {
                                setCategoryQuery(category.name);
                                setFormData((prev) => ({ ...prev, category: category._id }));
                                setShowCategoryOptions(false);
                              }}
                            >
                              {category.name}
                            </button>
                          ))}
                        {categories.length === 0 && (
                          <div className="px-4 py-2 text-sm text-gray-500">No categories found.</div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="h-12 w-12 rounded-xl bg-sky-600 text-white text-xl font-bold hover:bg-sky-700"
                    title="Add category"
                    onClick={async () => {
                      if (!categoryQuery.trim()) {
                        setError("Type a category name first.");
                        return;
                      }
                      try {
                        setError(null);
                        const response = await categoriesAPI.createCategory(categoryQuery.trim());
                        const newCategory = response.data?.category;
                        if (newCategory) {
                          setCategories((prev) => [newCategory, ...prev]);
                          setFormData((prev) => ({ ...prev, category: newCategory._id }));
                          setShowCategoryOptions(false);
                        }
                      } catch (err: any) {
                        setError(err?.response?.data?.message || "Failed to add category.");
                      }
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-900 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-sky-500 h-32"
                  placeholder="Describe the job role and responsibilities..."
                  required
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-900 mb-2">Responsibilities</label>
                <textarea
                  value={formData.responsibilities}
                  onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-sky-500 h-28"
                  placeholder="List responsibilities..."
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-900 mb-2">Requirements</label>
                <textarea
                  value={formData.requirements}
                  onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-sky-500 h-28"
                  placeholder="List requirements..."
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-900 mb-2">Skills</label>
                <input
                  type="text"
                  value={formData.skills}
                  onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="React, TypeScript, GraphQL"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-900 mb-2">Salary Range</label>
                <div className="flex items-center gap-2">
                  <span className="px-4 py-3 rounded-xl bg-sky-50 text-sky-700 font-semibold">PHP</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9,]*"
                    value={formData.salary}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      const formatted = raw
                        ? new Intl.NumberFormat("en-PH").format(Number(raw))
                        : "";
                      setFormData({ ...formData, salary: formatted });
                    }}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="e.g. 50,000"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Currency is set to PHP automatically.</p>
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-900 mb-2">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="e.g. Makati, PH"
                  required
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-900 mb-2">Job Type</label>
                <select
                  value={formData.jobType}
                  onChange={(e) => setFormData({ ...formData, jobType: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                >
                  <option value="Fulltime">Fulltime</option>
                  <option value="Freelance">Freelance</option>
                  <option value="Contract">Contract</option>
                  <option value="Remote">Remote</option>
                  <option value="Part-time">Part-time</option>
                </select>
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-900 mb-2">Application Deadline</label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-900 mb-2">Number of Workers Needed</label>
                <input
                  type="number"
                  min={1}
                  value={formData.positionsNeeded}
                  onChange={(e) => setFormData({ ...formData, positionsNeeded: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="1"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="flex-1 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold py-3 rounded-xl transition"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-60"
                  disabled={submitting}
                >
                  {submitting ? (isEditing ? "Updating..." : "Posting...") : (isEditing ? "Update Job" : "Post Job")}
                </button>
              </div>
            </form>
        </div>
      </div>
    </div>
  );
};

export default PostJob;
