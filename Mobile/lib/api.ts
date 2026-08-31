import storage from './storage';
import { inferMutationDomains, publishDataRefresh } from './dataRefresh';
import { API_REQUEST_TIMEOUT_MS, API_URL } from '../config';
import { Platform } from 'react-native';

export type APIResult<T = unknown> = {
  ok: boolean;
  status: number;
  message: string;
  data: T | null;
  raw: unknown;
};

const AUTH_TOKEN_KEY = 'auth_token';
export const REFRESH_TOKEN_KEY = 'auth_refresh_token';
let invalidSessionHandler: ((result: APIResult) => void) | null = null;
let refreshPromise: Promise<boolean> | null = null;
const isWeb = Platform.OS === 'web';
const isMicroJobsApiUrl = (url: string) => {
  try { return new URL(url).origin === new URL(API_URL).origin && new URL(url).pathname.startsWith(new URL(API_URL).pathname); }
  catch { return false; }
};

const getBrowserCsrfToken = () => {
  if (!isWeb || typeof document === 'undefined') return '';
  const match = String(document.cookie || '').match(/(?:^|; )csrfToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

const isMutationMethod = (method: string) => !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());

export const setInvalidSessionHandler = (handler: ((result: APIResult) => void) | null) => {
  invalidSessionHandler = handler;
};

const refreshNativeSession = async (): Promise<boolean> => {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = await storage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-microjobs-client': 'native' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) return false;
      const payload = await response.json().catch(() => ({}));
      if (!payload?.token || !payload?.refreshToken) return false;
      await Promise.all([
        storage.setItem(AUTH_TOKEN_KEY, payload.token),
        storage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken),
      ]);
      return true;
    } catch {
      return false;
    }
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
};

const refreshBrowserSession = async (): Promise<boolean> => {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const csrfToken = getBrowserCsrfToken();
    if (!csrfToken) return false;
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      });
      if (!response.ok) return false;
      const payload = await response.json().catch(() => ({}));
      if (!payload?.token) return false;
      await storage.setItem(AUTH_TOKEN_KEY, payload.token);
      return true;
    } catch {
      return false;
    }
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
};

const refreshSession = () => isWeb ? refreshBrowserSession() : refreshNativeSession();

const LIST_KEYS = [
  'items',
  'jobs',
  'applications',
  'conversations',
  'messages',
  'categories',
  'sessions',
  'archived',
  'blocked',
];

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const getMessage = (raw: unknown, fallback: string) => {
  const record = toRecord(raw);
  if (!record) return fallback;
  const message = record.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
};

const inferData = <T>(raw: unknown): T | null => {
  const record = toRecord(raw);
  if (!record) return (raw as T) ?? null;

  if ('data' in record) {
    return (record.data as T) ?? null;
  }

  return raw as T;
};

export async function apiRequest<T = unknown>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
  fallbackMessage = 'Request failed.',
  allowRefresh = true,
): Promise<APIResult<T>> {
  const controller = new AbortController();
  const timeoutMs = Number.isFinite(init?.timeoutMs) && (init?.timeoutMs as number) > 0
    ? (init?.timeoutMs as number)
    : API_REQUEST_TIMEOUT_MS;
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  if (init?.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  const headers = new Headers(init?.headers || {});
  const method = String(init?.method || 'GET').toUpperCase();
  if (!isWeb && isMicroJobsApiUrl(url) && !headers.has('x-microjobs-client')) headers.set('x-microjobs-client', 'native');
  if (isWeb && isMicroJobsApiUrl(url) && isMutationMethod(method) && !headers.has('x-csrf-token')) {
    const csrfToken = getBrowserCsrfToken();
    if (csrfToken) headers.set('x-csrf-token', csrfToken);
  }
  const isAuthEntryUrl = /\/auth\/(?:login|register|otp|password-reset)(?:\/|$)/i.test(url);
  if (isMicroJobsApiUrl(url) && !isAuthEntryUrl && !headers.has('Authorization')) {
    const token = await storage.getItem(AUTH_TOKEN_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const requestInit: RequestInit = {
    ...init,
    headers,
    credentials: isWeb && isMicroJobsApiUrl(url) ? 'include' : init?.credentials,
    signal: controller.signal,
  };

  try {
    const response = await fetch(url, requestInit);
    const contentType = response.headers.get('content-type') || '';

    let raw: unknown = null;
    if (contentType.includes('application/json')) {
      raw = await response.json().catch(() => null);
    } else {
      const text = await response.text().catch(() => '');
      raw = text || null;
    }

    const rawMessage = getMessage(raw, fallbackMessage);
    const isCsrfError = response.status === 403 && /csrf/i.test(String(rawMessage || ''));
    const cleanMessage = isCsrfError
      ? 'Your security session has expired. Please refresh or sign in again.'
      : rawMessage;

    const result: APIResult<T> = {
      ok: response.ok,
      status: response.status,
      message: cleanMessage,
      data: inferData<T>(raw),
      raw,
    };
    const isRefreshEndpoint = /\/auth\/(?:login|refresh)(?:\/|$)/.test(new URL(url).pathname);
    // Auto-retry on 401 Unauthorized or 403 CSRF session token expiration
    if ((response.status === 401 || isCsrfError) && isMicroJobsApiUrl(url) && allowRefresh && !isRefreshEndpoint) {
      if (await refreshSession()) {
        const retryHeaders = new Headers(init?.headers || {});
        retryHeaders.delete('Authorization');
        if (isWeb) retryHeaders.delete('x-csrf-token');
        return apiRequest<T>(url, { ...init, headers: retryHeaders }, fallbackMessage, false);
      }
      invalidSessionHandler?.(result);
    }
    if (result.ok && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const domains = inferMutationDomains(url);
      if (domains.length) publishDataRefresh({ domains, method, url, at: Date.now() });
    }
    return result;
  } catch (error) {
    const isTimeout = timedOut && error instanceof Error && error.name === 'AbortError';
    if (__DEV__) console.warn(`API request failed: ${url}`, error);
    return {
      ok: false,
      status: 0,
      message: isTimeout
        ? 'The request took too long to respond. Please check your connection and try again.'
        : 'Unable to connect. Check your connection and try again.',
      data: null,
      raw: { error: error instanceof Error ? error.message : String(error) },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export type ApiFailureKind = 'none' | 'unreachable' | 'unauthorized' | 'forbidden' | 'server' | 'request';

export const classifyApiFailure = (result: APIResult): ApiFailureKind => {
  if (result.ok) return 'none';
  if (result.status === 0) return 'unreachable';
  if (result.status === 401) return 'unauthorized';
  if (result.status === 403) return 'forbidden';
  if (result.status >= 500) return 'server';
  return 'request';
};

export function asList<T = unknown>(raw: unknown, keys: string[] = []): T[] {
  if (Array.isArray(raw)) return raw as T[];

  const record = toRecord(raw);
  if (!record) return [];

  const candidates = [...keys, ...LIST_KEYS];
  for (const key of candidates) {
    const value = record[key];
    if (Array.isArray(value)) return value as T[];
  }

  if (Array.isArray(record.data)) return record.data as T[];
  return [];
}

export function asObject<T = Record<string, unknown>>(raw: unknown, keys: string[] = []): T | null {
  const record = toRecord(raw);
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as T;
    }
  }

  return record as unknown as T;
}
