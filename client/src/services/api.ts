const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export type AuthUser = {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role?: string;
  phoneNumber?: string;
  city?: string;
  country?: string;
  linkedin?: string;
  avatarUrl?: string;
};
export type AuthResponse = { token: string; user: AuthUser; message?: string };

type RequestInitInput = Omit<RequestInit, 'body' | 'method'>;

type QueryParams = Record<string, string | number | boolean | null | undefined>;

function buildQuery(params?: QueryParams) {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.append(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

// Helper function for API requests
async function request<T>(
  path: string,
  options: RequestInitInput & { body?: unknown; method?: string } = {}
): Promise<T> {
  const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
  
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
export function registerUser(payload: { username?: string; firstName?: string; lastName?: string; phoneNumber?: string; email: string; password: string; role?: string }) {
  return request<AuthResponse>('/auth/register', { method: 'POST', body: payload });
}

export function loginUser(payload: { emailOrUsername: string; password: string }) {
  return request<AuthResponse>('/auth/login', { method: 'POST', body: payload });
}

export function sendOtp(payload: { email: string }) {
  return request<{ message: string; code?: string }>('/auth/otp/send', { method: 'POST', body: payload });
}

export function verifyOtp(payload: { email: string; code: string }) {
  return request<AuthResponse>('/auth/otp/verify', { method: 'POST', body: payload });
}

export function logoutUser() {
  return request('/auth/logout', { method: 'POST' });
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
export function getJobs(params?: QueryParams) {
  return request<any[]>(`/jobs${buildQuery(params)}`, { method: 'GET' });
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

export function applyForJob(jobId: string, payload?: { resume?: string; coverLetter?: string }) {
  return request(`/jobs/${jobId}/apply`, { method: 'POST', body: payload });
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

export function getMyJobs() {
  return request<any[]>('/jobs/mine', { method: 'GET' });
}

// Application APIs
export function getUserApplications(status?: string) {
  return request<any[]>(`/applications${buildQuery(status ? { status } : undefined)}`, { method: 'GET' });
}

export function getEmployerApplications(params?: QueryParams) {
  return request<any[]>(`/applications/employer${buildQuery(params)}`, { method: 'GET' });
}

export function withdrawApplication(applicationId: string) {
  return request(`/applications/${applicationId}`, { method: 'DELETE' });
}

export function updateApplicationStatus(applicationId: string, status: 'Pending' | 'Reviewed' | 'Accepted' | 'Rejected') {
  return request(`/applications/${applicationId}/status`, { method: 'PUT', body: { status } });
}

// User APIs
export function getUserList() {
  return request<any[]>('/users/userlist', { method: 'GET' });
}

export function getAdminUsers() {
  return request<any[]>('/users/admins', { method: 'GET' });
}

export function updateUserStatus(userId: string, status: 'active' | 'pending' | 'disabled') {
  return request(`/users/${userId}/status`, { method: 'PATCH', body: { status } });
}

export function deleteUser(userId: string) {
  return request(`/users/${userId}`, { method: 'DELETE' });
}

// Profile APIs
export function getProfile() {
  return request<any>('/auth/me', { method: 'GET' });
}

export function updateProfile(payload: {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  city?: string;
  country?: string;
  linkedin?: string;
  avatarUrl?: string;
}) {
  return request<any>('/auth/me', { method: 'PATCH', body: payload });
}

// Notifications APIs
export function getNotifications(params?: QueryParams) {
  return request<any[]>(`/notifications${buildQuery(params)}`, { method: 'GET' });
}

export function markNotificationRead(notificationId: string) {
  return request(`/notifications/${notificationId}/read`, { method: 'PATCH' });
}

export function markAllNotificationsRead() {
  return request(`/notifications/read-all`, { method: 'PATCH' });
}

export function deleteNotification(notificationId: string) {
  return request(`/notifications/${notificationId}`, { method: 'DELETE' });
}

export function deleteReadNotifications() {
  return request(`/notifications/read`, { method: 'DELETE' });
}

// Alerts APIs
export function getAlerts(params?: QueryParams) {
  return request<any[]>(`/alerts${buildQuery(params)}`, { method: 'GET' });
}

export function updateAlertStatus(alertId: string, status: 'open' | 'snoozed' | 'resolved') {
  return request(`/alerts/${alertId}/status`, { method: 'PATCH', body: { status } });
}

export function deleteAlert(alertId: string) {
  return request(`/alerts/${alertId}`, { method: 'DELETE' });
}
