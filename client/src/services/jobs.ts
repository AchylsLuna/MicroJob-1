import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Jobs API
export const jobsAPI = {
  // Get all jobs with optional filters
  getJobs: (params?: { category?: string; jobType?: string; search?: string; excludeOwn?: boolean }) =>
    api.get('/jobs', { params }),

  // Get job by ID
  getJobById: (jobId: string) => api.get(`/jobs/${jobId}`),

  // Create new job
  createJob: (jobData: any) => api.post('/jobs', jobData),

  // Update job
  updateJob: (jobId: string, jobData: any) => api.put(`/jobs/${jobId}`, jobData),

  // Get jobs posted by logged-in employer
  getMyJobs: () => api.get('/jobs/mine'),

  // Apply for a job
  applyForJob: (jobId: string, applicationData: { resume?: string; coverLetter?: string }) =>
    api.post(`/jobs/${jobId}/apply`, applicationData),

  // Get user applications
  getUserApplications: (status?: string) =>
    api.get('/applications', { params: { status } }),

  // Get applications for employer jobs
  getEmployerApplications: (params?: { status?: string; jobId?: string; search?: string }) =>
    api.get('/applications/employer', { params }),

  // Withdraw application
  withdrawApplication: (applicationId: string) =>
    api.delete(`/applications/${applicationId}`),

  // Update application status
  updateApplicationStatus: (applicationId: string, status: string) =>
    api.put(`/applications/${applicationId}/status`, { status }),
};

// Categories API
export const categoriesAPI = {
  // Get all categories
  getCategories: () => api.get('/categories'),

  // Create category
  createCategory: (name: string) => api.post('/categories', { name }),
};

export default api;
