import { handleInvalidSession, isInvalidTokenError } from "../utils/authSession";

const trimTrailingSlash = (value: string) => value.replace(/\/$/, '');

const normalizeOriginLikeValue = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    return `http://localhost:${raw}`;
  }
  if (/^https?:\/\//i.test(raw)) {
    return trimTrailingSlash(raw);
  }
  if (/^[a-z0-9.-]+:\d+$/i.test(raw)) {
    return `http://${raw}`;
  }
  return null;
};

const normalizeApiBase = (value: unknown, fallbackOrigin: string): string => {
  const raw = String(value || '').trim();
  if (!raw) return '/api';
  if (raw.startsWith('/')) {
    return trimTrailingSlash(raw) || '/api';
  }

  const normalizedOrigin = normalizeOriginLikeValue(raw);
  if (normalizedOrigin) {
    return raw.toLowerCase().includes('/api')
      ? trimTrailingSlash(raw)
      : `${normalizedOrigin}/api`;
  }

  return `${fallbackOrigin}/api`;
};

const API_PROXY_TARGET = normalizeOriginLikeValue(import.meta.env.VITE_API_PROXY_TARGET) || 'http://localhost:5000';
const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE, API_PROXY_TARGET);
const DIRECT_API_BASE = `${API_PROXY_TARGET}/api`;

function buildApiCandidates(path: string) {
  const primary = `${API_BASE}${path}`;
  // If API_BASE is relative (proxy mode), keep a direct localhost fallback for dev.
  if (!String(API_BASE).startsWith('/')) {
    return [primary];
  }
  const direct = `${DIRECT_API_BASE}${path}`;
  if (direct === primary) {
    return [primary];
  }
  return [primary, direct];
}

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
export type PaymentTarget = 'EMPLOYER' | 'WORKER' | 'BOTH';
export type PaymentTransaction = {
  _id: string;
  sender?: { _id?: string; firstName?: string; lastName?: string; email?: string } | null;
  receiver?: { _id?: string; firstName?: string; lastName?: string; email?: string } | null;
  amount: number;
  type: 'TOP_UP' | 'ESCROW' | 'PAYOUT' | 'REFUND';
  status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  balanceTarget?: 'EMPLOYER' | 'WORKER' | 'ESCROW' | 'SYSTEM';
  reference?: string | null;
  provider?: string | null;
  providerReference?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  label?: string | null;
  meta?: Record<string, unknown>;
  payoutRequest?: PayoutRequest | null;
  linkedTransaction?: Partial<PaymentTransaction> | null;
  createdAt?: string;
};
export type ApplicationStatus =
  | 'Applied'
  | 'Shortlisted'
  | 'Interview Scheduled'
  | 'Interviewed'
  | 'Offer Sent'
  | 'Hired'
  | 'Rejected'
  | 'Withdrawn';
export type SavedJobRecord = {
  _id: string;
  job: any;
  savedAt?: string;
  createdAt?: string;
};
export type SupportTicket = {
  _id: string;
  requester?: any;
  subject: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
  messages?: Array<{
    _id: string;
    author?: any;
    actorRole: 'user' | 'admin';
    body: string;
    createdAt: string;
  }>;
  updatedAt?: string;
  createdAt?: string;
  messageCount?: number;
};
export type PayoutRequest = {
  _id: string;
  amount: number;
  status: 'requested' | 'approved' | 'rejected' | 'paid' | 'cancelled';
  destinationSnapshot: {
    methodType: string;
    institutionName: string;
    accountName: string;
    accountNumber?: string;
    accountNumberMasked?: string | null;
  };
  reviewNotes?: string | null;
  reviewedAt?: string | null;
  paidAt?: string | null;
  cancelledAt?: string | null;
  user?: any;
  reviewer?: any;
  transaction?: PaymentTransaction | null;
  createdAt?: string;
  updatedAt?: string;
};

type RequestInitInput = Omit<RequestInit, 'body' | 'method'>;

type QueryParams = Record<string, string | number | boolean | null | undefined>;

const AUTH_PATHS_WITHOUT_REFRESH = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/otp/send',
  '/auth/otp/verify',
  '/auth/refresh',
]);

const normalizeApiPath = (value: string) => {
  const withoutHost = String(value || '').replace(/^https?:\/\/[^/]+/i, '');
  const withoutApiPrefix = withoutHost.replace(/^\/api/, '');
  return withoutApiPrefix.split('?')[0];
};

const getCsrfToken = () => {
  if (typeof document === 'undefined') return '';
  const cookie = document.cookie || '';
  const match = cookie.match(/(?:^|; )csrfToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

const shouldAttachCsrfHeader = (method: string) => {
  const normalizedMethod = method.toUpperCase();
  return normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD' && normalizedMethod !== 'OPTIONS';
};

async function performRequest(
  path: string,
  method: string,
  headers: Headers,
  body: unknown,
  isFormData: boolean
) {
  let res: Response | null = null;
  const candidates = buildApiCandidates(path);

  for (const url of candidates) {
    try {
      res = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
      });
      break;
    } catch {
      // Try next candidate URL when network fails.
    }
  }

  if (!res) {
    throw new Error('Unable to reach the server at /api or http://localhost:5000/api. Make sure backend is running on port 5000.');
  }

  const data = (await res.json().catch(() => ({}))) as any;
  return { res, data };
}

async function tryRefreshSession() {
  const csrfToken = getCsrfToken();
  if (!csrfToken) return false;

  const refreshCandidates = buildApiCandidates('/auth/refresh');
  for (const url of refreshCandidates) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
      });
      if (response.ok) return true;
    } catch {
      // Try the next refresh candidate on network failure.
    }
  }

  return false;
}

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
  const method = options.method || 'GET';
  const normalizedPath = normalizeApiPath(path);
  const hasLocalSession = Boolean(
    localStorage.getItem('auth_user') || localStorage.getItem('current_user')
  );
  const body = options.body;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = new Headers(options.headers || undefined);
  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (shouldAttachCsrfHeader(method) && !headers.has('x-csrf-token')) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set('x-csrf-token', csrfToken);
    }
  }

  let { res, data } = await performRequest(path, method, headers, body, isFormData);

  if (!res.ok) {
    const message = data?.message || 'Request failed';
    const canAttemptRefresh =
      res.status === 401 &&
      hasLocalSession &&
      !AUTH_PATHS_WITHOUT_REFRESH.has(normalizedPath);

    if (canAttemptRefresh) {
      const refreshed = await tryRefreshSession();
      if (refreshed) {
        const retryResult = await performRequest(path, method, headers, body, isFormData);
        res = retryResult.res;
        data = retryResult.data;
      }
    }
  }

  if (!res.ok) {
    const message = data?.message || 'Request failed';
    if (isInvalidTokenError({ status: res.status, message, path, hasToken: hasLocalSession })) {
      handleInvalidSession();
    }
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

export function requestPasswordResetOtp(payload: { email: string }) {
  return request<{ message: string }>('/auth/password-reset/request', { method: 'POST', body: payload });
}

export function resetPasswordWithOtp(payload: { email: string; code: string; newPassword: string }) {
  return request<{ message: string }>('/auth/password-reset/confirm', { method: 'POST', body: payload });
}

export function requestPasswordChangeOtp(payload: { currentPassword: string }) {
  return request<{ message: string; code?: string }>('/auth/password-change/request', { method: 'POST', body: payload });
}

export function confirmPasswordChangeWithOtp(payload: { currentPassword: string; code: string; newPassword: string }) {
  return request<{ message: string }>('/auth/password-change/confirm', { method: 'POST', body: payload });
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

export function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus | 'Terms' | 'Pending' | 'Reviewed' | 'Accepted'
) {
  return request(`/applications/${applicationId}/status`, { method: 'PUT', body: { status } });
}

export function hideEmployerApplication(applicationId: string) {
  return request(`/applications/${applicationId}/employer/remove`, { method: 'PATCH' });
}

export function scheduleInterview(
  applicationId: string,
  payload: { scheduledAt: string; location?: string; mode?: string; notes?: string }
) {
  return request(`/applications/${applicationId}/interviews`, { method: 'POST', body: payload });
}

export function updateInterview(
  applicationId: string,
  interviewId: string,
  payload: { scheduledAt?: string; location?: string; mode?: string; notes?: string }
) {
  return request(`/applications/${applicationId}/interviews/${interviewId}`, { method: 'PATCH', body: payload });
}

// User APIs
export function getUserList() {
  return request<any[]>('/users/userlist', { method: 'GET' });
}

export function updateUserStatus(userId: string, status: 'active' | 'pending' | 'disabled') {
  return request(`/users/${userId}/status`, { method: 'PATCH', body: { status } });
}

export function deleteUser(userId: string) {
  return request(`/users/${userId}`, { method: 'DELETE' });
}

export function requestAccountDeletion(payload: { currentPassword: string; confirm: string }) {
  return request<{ message: string; blockers?: Array<{ code: string; message: string; count: number }> }>(
    '/auth/me/delete',
    { method: 'POST', body: payload }
  );
}

// Profile APIs
export function getProfile() {
  return request<any>('/auth/me', { method: 'GET' }).then((response: any) => {
    return response?.data ?? response?.profile ?? response?.user ?? response;
  });
}

export function updateProfile(payload: {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  city?: string;
  province?: string;
  address?: string;
  companyName?: string;
  country?: string;
  linkedin?: string;
  about?: string;
  avatarUrl?: string;
  totalExperience?: string;
  // Note: projectsCompleted, jobsApplied, and successRate are auto-calculated by backend
}) {
  return request<any>('/auth/me', { method: 'PATCH', body: payload }).then((response: any) => {
    return response?.data ?? response?.profile ?? response?.user ?? response;
  });
}

export function getPublicProfile(userId: string, viewAs: 'worker' | 'employer' = 'worker') {
  return request<any>(`/auth/profiles/${userId}${buildQuery({ viewAs })}`, { method: 'GET' });
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

export function registerPushDevice(payload: { token: string; deviceName?: string; platform?: 'expo' }) {
  return request<{ message: string; device: any }>('/notifications/devices', { method: 'POST', body: payload });
}

export function removePushDevice(deviceId: string) {
  return request<{ message: string }>(`/notifications/devices/${deviceId}`, { method: 'DELETE' });
}

// Social sign-in
export function googleSignIn(idToken: string) {
  return request<{ token?: string; user?: any; message?: string }>(`/auth/google`, { method: 'POST', body: { idToken } });
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

// Sessions APIs
export function getSessions() {
  return request<{ sessions: any[] }>('/auth/sessions', { method: 'GET' });
}

export function revokeSession(sessionId: string) {
  return request('/auth/sessions/' + sessionId, { method: 'DELETE' });
}

export function revokeAllSessions() {
  return request('/auth/sessions', { method: 'DELETE' });
}

export function cleanupInactiveSessions() {
  return request<{ message: string; deletedCount: number }>('/auth/sessions/cleanup', { method: 'POST' });
}

// Verification APIs
export function getVerificationStatus() {
  return request<{
    steps: Array<{
      id: string;
      title: string;
      description: string;
      status: 'complete' | 'in-review' | 'pending';
    }>;
    completedSteps: number;
    completionPercent: number;
  }>('/auth/verification/status', { method: 'GET' });
}

export function requestPhoneVerificationOtp() {
  return request<{
    message: string;
    provider?: string;
    phoneMasked?: string;
    expiresInSec?: number;
    devCode?: string;
  }>('/auth/verification/phone', { method: 'POST' });
}

export function confirmPhoneVerificationOtp(payload: { code: string }) {
  return request<{ message: string; verified: boolean }>('/auth/verification/phone/confirm', {
    method: 'POST',
    body: payload,
  });
}

export function uploadIdentityDocument(file: File) {
  const formData = new FormData();
  formData.append('document', file);
  return request<{ message: string; documentUrl: string; status: string }>(
    '/auth/verification/documents/identity',
    { method: 'POST', body: formData }
  );
}

export function uploadAddressDocument(file: File) {
  const formData = new FormData();
  formData.append('document', file);
  return request<{ message: string; documentUrl: string; status: string }>(
    '/auth/verification/documents/address',
    { method: 'POST', body: formData }
  );
}

// Payments APIs
export function createTopUpSession(payload: { amount: number; target?: PaymentTarget }) {
  return request<{ checkoutUrl: string; referenceNumber: string; checkoutId: string }>(
    '/payment/topup',
    { method: 'POST', body: payload },
  );
}

export function confirmTopUp(payload: { referenceNumber?: string; checkoutId?: string }) {
  return request<{
    message: string;
    transaction?: PaymentTransaction;
    transactions?: PaymentTransaction[];
  }>('/payment/topup/confirm', { method: 'POST', body: payload });
}

export function getPaymentTransactions() {
  return request<{ transactions: PaymentTransaction[] }>('/payment/transactions', { method: 'GET' });
}

export function getPaymentAudit() {
  return request<{ transactions: PaymentTransaction[] }>('/payment/audit', { method: 'GET' });
}

export function getPayoutRequests() {
  return request<{ payoutRequests: PayoutRequest[] }>('/payment/payout-requests', { method: 'GET' });
}

export function createPayoutRequest(payload: {
  amount: number;
  destinationSnapshot: {
    methodType: string;
    institutionName: string;
    accountName: string;
    accountNumber: string;
  };
}) {
  return request<{ message: string; payoutRequest: PayoutRequest }>('/payment/payout-requests', {
    method: 'POST',
    body: payload,
  });
}

export function cancelPayoutRequest(payoutRequestId: string) {
  return request<{ message: string; payoutRequest: PayoutRequest }>(
    `/payment/payout-requests/${payoutRequestId}/cancel`,
    { method: 'POST' }
  );
}

export function getSupportTickets() {
  return request<{ tickets: SupportTicket[] }>('/support/tickets', { method: 'GET' });
}

export function getSupportTicket(ticketId: string) {
  return request<{ ticket: SupportTicket }>(`/support/tickets/${ticketId}`, { method: 'GET' });
}

export function createSupportTicket(payload: {
  subject: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  message: string;
}) {
  return request<{ message: string; ticket: SupportTicket }>('/support/tickets', { method: 'POST', body: payload });
}

export function replyToSupportTicket(ticketId: string, payload: { message: string }) {
  return request<{ message: string; ticket: SupportTicket }>(`/support/tickets/${ticketId}/replies`, {
    method: 'POST',
    body: payload,
  });
}

export function getSavedJobs() {
  return request<{ savedJobs: SavedJobRecord[] }>('/saved-jobs', { method: 'GET' });
}

export function saveJobForLater(jobId: string) {
  return request<{ savedJob: SavedJobRecord }>('/saved-jobs', { method: 'POST', body: { jobId } });
}

export function removeSavedJob(jobId: string) {
  return request<{ jobId: string }>(`/saved-jobs/${jobId}`, { method: 'DELETE' });
}

// Message APIs
export function sendMessage(payload: { receiverId: string; content: string; jobId?: string }) {
  return request<any>('/messages/send', { method: 'POST', body: payload });
}

export function getConversations() {
  return request<any[]>('/messages/conversations', { method: 'GET' });
}

export function getConversationWithUser(otherUserId: string, jobId?: string) {
  return request<any[]>(`/messages/conversation/${otherUserId}${buildQuery(jobId ? { jobId } : undefined)}`, { method: 'GET' });
}

export function blockUser(otherUserId: string) {
  return request<any>('/messages/block', { method: 'POST', body: { otherUserId } });
}

export function unblockUser(otherUserId: string) {
  return request<any>('/messages/unblock', { method: 'POST', body: { otherUserId } });
}

export function archiveConversation(otherUserId: string, jobId?: string, archive: boolean = true) {
  return request<any>('/messages/archive', { method: 'POST', body: { otherUserId, jobId: jobId || null, archive } });
}

export function deleteConversation(otherUserId: string, jobId?: string) {
  return request<any>('/messages/conversation', { method: 'DELETE', body: { otherUserId, jobId: jobId || null } });
}

export function getBlockedUsers() {
  return request<any[]>('/messages/blocked', { method: 'GET' });
}

export function getArchivedConversations() {
  return request<any[]>('/messages/archived', { method: 'GET' });
}

export function markMessagesAsRead(otherUserId: string, jobId?: string) {
  return request<any>('/messages/read', { method: 'PATCH', body: { otherUserId, jobId: jobId || null, read: true } });
}

export function editMessage(messageId: string, content: string) {
  return request<any>(`/messages/edit/${messageId}`, { method: 'PATCH', body: { content } });
}
// Resume APIs
export async function uploadResume(file: File) {
  const formData = new FormData();
  formData.append('resume', file);

  const res = await fetch(`${API_BASE}/auth/profile/resume`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    const message = data?.message || 'Failed to upload resume';
    throw new Error(message);
  }
  return data;
}

export function deleteResume() {
  return request<any>('/auth/profile/resume', { method: 'DELETE' });
}

// Avatar APIs
export async function uploadAvatar(file: File) {
  const formData = new FormData();
  formData.append('avatar', file);

  const res = await fetch(`${API_BASE}/auth/profile/avatar`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    const message = data?.message || 'Failed to upload avatar';
    throw new Error(message);
  }
  return data;
}

export function deleteAvatar() {
  return request<any>('/auth/profile/avatar', { method: 'DELETE' });
}

/**
 * ADMIN APIS - Data for admin dashboard
 */
export function getAdminStats() {
  return request<any>('/admin/stats', { method: 'GET' });
}

export function getAdminUsers() {
  return request<any[]>('/admin/users', { method: 'GET' });
}

export function getAdminJobs() {
  return request<any[]>('/admin/jobs', { method: 'GET' });
}

export function getAdminCategories() {
  return request<any[]>('/admin/categories', { method: 'GET' });
}

export function getAdminWalletStats() {
  return request<any>('/admin/wallets', { method: 'GET' });
}

export function getAdminRecentPayouts() {
  return request<any[]>('/admin/recent-payouts', { method: 'GET' });
}

export function getAdminTransactions() {
  return request<any[]>('/admin/transactions', { method: 'GET' });
}

export function getAdminPayoutRequests(params?: QueryParams) {
  return request<{ payoutRequests: PayoutRequest[] }>(`/admin/payout-requests${buildQuery(params)}`, { method: 'GET' });
}

export function updateAdminPayoutRequest(
  payoutRequestId: string,
  payload: { status: 'approved' | 'rejected' | 'paid'; reviewNotes?: string }
) {
  return request<{ payoutRequest: PayoutRequest }>(`/admin/payout-requests/${payoutRequestId}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function getAdminSupportTickets(params?: QueryParams) {
  return request<{ tickets: SupportTicket[] }>(`/admin/support/tickets${buildQuery(params)}`, { method: 'GET' });
}

export function getAdminSupportTicket(ticketId: string) {
  return request<{ ticket: SupportTicket }>(`/admin/support/tickets/${ticketId}`, { method: 'GET' });
}

export function updateAdminSupportTicket(
  ticketId: string,
  payload: { status?: SupportTicket['status']; priority?: SupportTicket['priority']; reviewNotes?: string }
) {
  return request<{ ticket: SupportTicket }>(`/admin/support/tickets/${ticketId}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function replyToAdminSupportTicket(ticketId: string, payload: { message: string }) {
  return request<{ ticket: SupportTicket }>(`/admin/support/tickets/${ticketId}/replies`, {
    method: 'POST',
    body: payload,
  });
}
