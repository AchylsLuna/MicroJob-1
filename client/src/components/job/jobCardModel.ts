// Normalizes the differently-shaped job objects used across web screens
// (worker/FindJobs.tsx's own `Job` interface, worker/Dashboard.tsx's inline
// API-shaped objects, etc.) into one shape JobCard can render. Each screen's
// existing data-fetching/filtering logic is left untouched — this only runs
// at render time, right before a job is handed to <JobCard />.
export type JobCardData = {
  id: string;
  title: string;
  posterName: string;
  location: string;
  jobType: string;
  categoryId?: string;
  categoryName?: string;
  salaryLabel: string;
  skills: string[];
  urgent: boolean;
  matchPercentage?: number;
  matchLevel?: string;
};

type JobCardInput = {
  id: string;
  title: string;
  posterName?: string;
  company?: string; // FindJobs.tsx's Job.company
  location?: string;
  jobType?: string;
  type?: string; // FindJobs.tsx's Job.type (already a display label)
  category?: string | { _id?: string; name?: string };
  categoryId?: string;
  categoryName?: string;
  salaryLabel?: string;
  salary?: string; // pre-formatted display string
  skills?: string[];
  urgent?: boolean;
  matchPercentage?: number;
  matchLevel?: string;
};

export function toJobCardData(job: JobCardInput): JobCardData {
  const category = job.category;
  const categoryId = job.categoryId || (typeof category === "object" ? category?._id : undefined);
  const categoryName = job.categoryName || (typeof category === "string" ? category : category?.name);

  return {
    id: job.id,
    title: job.title,
    posterName: job.posterName || job.company || "Job Poster",
    location: job.location || "",
    jobType: job.jobType || job.type || "",
    categoryId,
    categoryName,
    salaryLabel: job.salaryLabel || job.salary || "Pay not specified",
    skills: job.skills || [],
    urgent: Boolean(job.urgent),
    matchPercentage: job.matchPercentage,
    matchLevel: job.matchLevel,
  };
}
