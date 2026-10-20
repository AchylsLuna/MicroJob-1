import { formatMinimumPay } from '../../lib/jobCompensation';
import { formatNotificationTime } from '../../lib/notifications';

// The various screens (dashboard, Jobs, SavedJobs, AppliedJobs, employer job posts)
// each declare their own slightly-different local `Job` type. Rather than unify
// those types, JobCard accepts this one normalized shape and each screen maps
// its own job objects into it at the call site.
export type JobCardData = {
  id: string;
  title: string;
  posterName: string;
  location: string;
  jobType: string;
  categoryId?: string;
  categoryName?: string;
  salaryLabel: string;
  dailyRate?: number;
  workStartTime?: string | null;
  workEndTime?: string | null;
  skills: string[];
  urgent: boolean;
  highlighted: boolean;
  /** Relative posting age, e.g. "2d ago". Empty when the job has no createdAt. */
  postedLabel: string;
  matchPercentage?: number;
  matchLevel?: string;
  applicationStatus?: string | null;
};

type RawJob = {
  _id: string;
  title: string;
  location?: string;
  salary?: unknown;
  paymentMode?: string;
  workStartTime?: string | null;
  workEndTime?: string | null;
  jobType?: string;
  urgent?: boolean;
  highlighted?: boolean;
  skills?: string[];
  deadline?: string;
  createdAt?: string;
  category?: { _id: string; name: string } | string;
  jobPoster?: { firstName?: string; lastName?: string; email?: string };
  match?: { percentage?: number; level?: string };
  applicationStatus?: string | null;
};

export function toJobCardData(job: RawJob): JobCardData {
  const category = job.category;
  const categoryId = typeof category === 'string' ? category : category?._id;
  const categoryName = typeof category === 'string' ? undefined : category?.name;

  return {
    id: job._id,
    title: job.title,
    posterName: job.jobPoster?.firstName
      ? `${job.jobPoster.firstName} ${job.jobPoster.lastName || ''}`.trim()
      : 'Job Poster',
    location: job.location || '',
    jobType: job.jobType || '',
    categoryId,
    categoryName,
    salaryLabel: formatMinimumPay(job.salary, undefined, job.paymentMode),
    dailyRate: job.paymentMode === 'daily' ? Number(job.salary) : undefined,
    workStartTime: job.workStartTime,
    workEndTime: job.workEndTime,
    skills: job.skills || [],
    urgent: Boolean(job.urgent),
    highlighted: Boolean(job.highlighted),
    postedLabel: job.createdAt ? formatNotificationTime(job.createdAt) : '',
    matchPercentage: job.match?.percentage,
    matchLevel: job.match?.level,
    applicationStatus: job.applicationStatus || null,
  };
}
