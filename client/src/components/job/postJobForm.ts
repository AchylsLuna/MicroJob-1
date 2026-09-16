// Shared types and pure helpers for the post-a-job form, split out of
// PostJobWizard.tsx because Fast Refresh requires a component file to only
// export components — everything else (types, constants, pure functions)
// lives here so both PostJob.tsx and PostJobWizard.tsx can import it.

// Converts between the "YYYY-MM-DD" strings this form stores (matching native
// <input type="date"> value format) and the Date objects DateField works with.
export function parseDateInputValue(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}
export function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type JobEdit = {
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

export type TFn = (key: string, options?: Record<string, unknown>) => string;

export const getJobTypeOptions = (t: TFn) =>
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

export const LEGACY_JOB_TYPES = ["Fulltime", "Part-time", "Freelance", "Contract", "Remote"] as const;

export type FormState = {
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

export type RequiredFieldKey =
  | "title"
  | "description"
  | "location"
  | "salary"
  | "jobType"
  | "deadline"
  | "category";

export const getRequiredFieldLabels = (t: TFn): Record<RequiredFieldKey, string> => ({
  title: t("postJob.requiredFields.title"),
  description: t("postJob.requiredFields.description"),
  location: t("postJob.requiredFields.location"),
  salary: t("postJob.requiredFields.salary"),
  jobType: t("postJob.requiredFields.jobType"),
  deadline: t("postJob.requiredFields.deadline"),
  category: t("postJob.requiredFields.category"),
});

export const createEmptyForm = (): FormState => ({
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

export interface ProvinceOption {
  code: string;
  name: string;
}

export interface CityOption {
  code: string;
  name: string;
  provinceCode?: string;
}

export interface BarangayOption {
  code: string;
  name: string;
}

export const PSGC_BASE_URL = "https://psgc.gitlab.io/api";

export const parseLocationToParts = (locationText?: string) => {
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

export const composeLocation = (form: FormState) => {
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

export const extractSalaryValue = (value: unknown): string => {
  const raw = String(value ?? "").replace(/[^0-9]/g, "");
  return raw ? String(Number(raw)) : "";
};

export const buildFormFromJob = (job: JobEdit): FormState => {
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

/** Pure, per-step field check — the same required-field rules `handleSubmit`
 * enforces as a final safety net, scoped to just the step being left so
 * "Next" can gate progress without duplicating the whole-form validation. */
export const validateStep = (step: 0 | 1 | 2, form: FormState): RequiredFieldKey[] => {
  const missing: RequiredFieldKey[] = [];
  if (step === 0) {
    if (!form.title.trim()) missing.push("title");
    if (!form.category) missing.push("category");
    if (!form.description.trim()) missing.push("description");
  } else if (step === 1) {
    if (!form.province || !form.city || !form.barangay) missing.push("location");
    if (!form.jobType) missing.push("jobType");
    if (!form.deadline) missing.push("deadline");
  } else {
    const salaryAmount = Number(form.minimumSalary.replace(/[^0-9]/g, "") || 0);
    if (!salaryAmount) missing.push("salary");
  }
  return missing;
};
