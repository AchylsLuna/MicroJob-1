import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { handleInvalidSession, isInvalidTokenError } from '../utils/authSession';

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

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    const hasToken = Boolean(localStorage.getItem("auth_token") || localStorage.getItem("token"));
    if (isInvalidTokenError({ status, message, path: error.config?.url, hasToken })) {
      handleInvalidSession();
    }
    return Promise.reject(error);
  }
);

// Jobs API
export const jobsAPI = {
  // Get all jobs with optional filters
  getJobs: async (params?: { category?: string; jobType?: string; search?: string; excludeOwn?: boolean }) => {
    const response = await api.get('/jobs', { params });
    // Extract data from wrapped response: { data: { success, message, data: [...] } }
    return {
      data: Array.isArray(response.data) ? response.data : response.data?.data || []
    };
  },

  // Get job by ID
  getJobById: (jobId: string) => api.get(`/jobs/${jobId}`),

  // Create new job
  createJob: (jobData: any) => api.post('/jobs', jobData),

  // Update job
  updateJob: (jobId: string, jobData: any) => api.put(`/jobs/${jobId}`, jobData),

  // Change job status (reopen/close etc.)
  changeJobStatus: (jobId: string, status: string) => api.patch(`/jobs/${jobId}/status`, { status }),

  // Get jobs posted by logged-in employer
  getMyJobs: async () => {
    const response = await api.get('/jobs/mine');
    return {
      data: Array.isArray(response.data) ? response.data : response.data?.data || []
    };
  },

  // Delete job
  deleteJob: (jobId: string) => api.delete(`/jobs/${jobId}`),

  // Apply for a job
  applyForJob: (jobId: string, applicationData: { resume?: string; coverLetter?: string }) =>
    api.post(`/jobs/${jobId}/apply`, applicationData),

  // Get user applications
  getUserApplications: async (status?: string) => {
    const response = await api.get('/applications', { params: { status } });
    return {
      data: Array.isArray(response.data) ? response.data : response.data?.data || []
    };
  },

  // Get applications for employer jobs
  getEmployerApplications: async (params?: { status?: string; jobId?: string; search?: string }) => {
    const response = await api.get('/applications/employer', { params });
    return {
      data: Array.isArray(response.data) ? response.data : response.data?.data || []
    };
  },

  // Withdraw application
  withdrawApplication: (applicationId: string) =>
    api.delete(`/applications/${applicationId}`),

  // Employer: delete an application permanently
  deleteEmployerApplication: (applicationId: string) =>
    api.delete(`/applications/${applicationId}/employer`),

  // Update application status
  updateApplicationStatus: (applicationId: string, status: string) =>
    api.put(`/applications/${applicationId}/status`, { status }),
  // Mark employer notification as read
  markEmployerRead: (applicationId: string) =>
    api.patch(`/applications/${applicationId}/employer/read`),
  // Mark applicant notification as read
  markApplicantRead: (applicationId: string) =>
    api.patch(`/applications/${applicationId}/applicant/read`),
};

// Categories API
export const categoriesAPI = {
  // Get all categories
  getCategories: async () => {
    const response = await api.get('/categories');
    return {
      data: Array.isArray(response.data) ? response.data : response.data?.data || []
    };
  },

  // Create category
  createCategory: (name: string) => api.post('/categories', { name }),
};

export default api;
