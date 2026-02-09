import { markActivity } from "../utils/activityTracker";

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export type AuthUser = { id: string; username?: string; firstName?: string; lastName?: string; email: string; role?: string };
export type AuthResponse = { token: string; user: AuthUser; message?: string };
export type UserProfile = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  role?: string;
  city?: string;
  province?: string;
  address?: string;
  facebook?: string;
  profilePhotoName?: string;
  jobPosition?: string;
  companyName?: string;
  startDate?: string;
  endDate?: string;
  logoName?: string;
  resumeFileName?: string;
};

type RequestInitInput = Omit<RequestInit, 'body' | 'method'>;

// Helper function for API requests
async function request<T>(
  path: string,
  options: RequestInitInput & { body?: unknown; method?: string } = {}
): Promise<T> {
  const token = localStorage.getItem('auth_token');
  markActivity();
  
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    const message = data?.message || 'Request failed';
    throw new Error(message);
  }
  return data as T;
}

// Auth APIs
export function registerUser(payload: { username: string; email: string; password: string; role?: string }) {
  return request<AuthResponse>('/users/register', { method: 'POST', body: payload });
}

export function loginUser(payload: { emailOrUsername: string; password: string }) {
  return request<AuthResponse>('/users/login', { method: 'POST', body: payload });
}

export function sendOtp(payload: { email: string }) {
  return request<{ message: string; code?: string }>('/users/otp/send', { method: 'POST', body: payload });
}

export function verifyOtp(payload: { email: string; code: string }) {
  return request<AuthResponse>('/users/otp/verify', { method: 'POST', body: payload });
}

export function logoutUser() {
  return request('/users/logout', { method: 'POST' });
}

// Category APIs
export function getCategories() {
  return request<any[]>('/categories', { method: 'GET' });
}

export function createCategory(payload: { name: string; description: string }) {
  return request('/categories', { method: 'POST', body: payload });
}

export function updateCategory(id: string, payload: { name?: string; description?: string }) {
  return request(`/categories/${id}`, { method: 'PUT', body: payload });
}

export function deleteCategory(id: string) {
  return request(`/categories/${id}`, { method: 'DELETE' });
}

// Job APIs
export function getJobs() {
  return request<any[]>('/jobs', { method: 'GET' });
}

export function getAvailableJobs() {
  return request<any[]>('/jobs/available', { method: 'GET' });
}

export function getJobByCategory(categoryId: string) {
  return request<any[]>(`/jobs/category/${categoryId}`, { method: 'GET' });
}

export function getJobDetails(jobId: string) {
  return request(`/jobs/${jobId}`, { method: 'GET' });
}

export function createJob(payload: any) {
  return request('/jobs', { method: 'POST', body: payload });
}

export function applyForJob(jobId: string) {
  return request(`/jobs/${jobId}/apply`, { method: 'POST' });
}

export function getApplicantsList(jobId: string) {
  return request(`/jobs/${jobId}/applicants`, { method: 'GET' });
}

export function selectApplicant(jobId: string, applicantId: string) {
  return request(`/jobs/${jobId}/select/${applicantId}`, { method: 'PATCH' });
}

export function changeJobStatus(jobId: string, status: string) {
  return request(`/jobs/${jobId}/status`, { method: 'PATCH', body: { status } });
}

// User APIs
export function getUserList() {
  return request<any[]>('/users/userlist', { method: 'GET' });
}

export function getUserProfile() {
  return request<{ profile: UserProfile }>('/users/profile', { method: 'GET' });
}

export function updateUserProfile(payload: Partial<UserProfile>) {
  return request<{ profile: UserProfile }>('/users/profile', { method: 'PUT', body: payload });
}
