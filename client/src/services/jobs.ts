import {
  applyForJob,
  changeJobStatus,
  createCategory,
  createJob,
  deleteEmployerApplication,
  deleteJob,
  getCategories,
  getEmployerApplications,
  getJobDetails,
  getJobs,
  getMyJobs,
  getRecommendedJobs,
  getUserApplications,
  markApplicantApplicationRead,
  markEmployerApplicationRead,
  updateApplicationStatus,
  updateJob,
  withdrawApplication,
} from './api';
import type { ApplicationStatus } from './api';

type JobQuery = {
  category?: string;
  jobType?: string;
  search?: string;
  excludeOwn?: boolean;
};

type EmployerApplicationQuery = {
  status?: string;
  jobId?: string;
  search?: string;
};

const asData = <T>(data: T) => ({ data });

// Compatibility facade for existing screens. Transport, session refresh, CSRF,
// and error handling all live in services/api.ts.
export const jobsAPI = {
  getJobs: async (params?: JobQuery) => asData(await getJobs(params)),
  getRecommendedJobs: async (limit = 12) => asData(await getRecommendedJobs(limit)),
  getJobById: async (jobId: string) => asData(await getJobDetails(jobId)),
  createJob: async (jobData: any) => asData(await createJob(jobData)),
  updateJob: async (jobId: string, jobData: any) => asData(await updateJob(jobId, jobData)),
  changeJobStatus: async (jobId: string, status: string) => asData(await changeJobStatus(jobId, status)),
  getMyJobs: async () => asData(await getMyJobs()),
  deleteJob: async (jobId: string) => asData(await deleteJob(jobId)),
  applyForJob: async (
    jobId: string,
    applicationData: { resume?: string; coverLetter?: string }
  ) => asData(await applyForJob(jobId, applicationData)),
  getUserApplications: async (status?: string) => asData(await getUserApplications(status)),
  getEmployerApplications: async (params?: EmployerApplicationQuery) => (
    asData(await getEmployerApplications(params))
  ),
  withdrawApplication: async (applicationId: string) => (
    asData(await withdrawApplication(applicationId))
  ),
  deleteEmployerApplication: async (applicationId: string) => (
    asData(await deleteEmployerApplication(applicationId))
  ),
  updateApplicationStatus: async (
    applicationId: string,
    status: ApplicationStatus | 'Terms' | 'Pending' | 'Reviewed' | 'Accepted'
  ) => (
    asData(await updateApplicationStatus(applicationId, status))
  ),
  markEmployerRead: async (applicationId: string) => (
    asData(await markEmployerApplicationRead(applicationId))
  ),
  markApplicantRead: async (applicationId: string) => (
    asData(await markApplicantApplicationRead(applicationId))
  ),
};

export const categoriesAPI = {
  getCategories: async () => asData(await getCategories()),
  createCategory: async (name: string) => asData(await createCategory({ name })),
};

export default jobsAPI;
