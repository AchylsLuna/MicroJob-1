import storage from './storage';
import { inferMutationDomains, publishDataRefresh } from './dataRefresh';
import { API_URL } from '../config';

export type APIResult<T = unknown> = {
  ok: boolean;
  status: number;
  message: string;
  data: T | null;
  raw: unknown;
};

const DEFAULT_REQUEST_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS || 8000);
const AUTH_TOKEN_KEY = 'auth_token';
export const REFRESH_TOKEN_KEY = 'auth_refresh_token';
let invalidSessionHandler: ((result: APIResult) => void) | null = null;
let refreshPromise: Promise<boolean> | null = null;
const isMicroJobsApiUrl = (url: string) => {
  try { return new URL(url).origin === new URL(API_URL).origin && new URL(url).pathname.startsWith(new URL(API_URL).pathname); }
  catch { return false; }
};

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
  init?: RequestInit,
  fallbackMessage = 'Request failed.',
  allowRefresh = true,
): Promise<APIResult<T>> {
  const controller = new AbortController();
  const timeoutMs = Number.isFinite(DEFAULT_REQUEST_TIMEOUT_MS) && DEFAULT_REQUEST_TIMEOUT_MS > 0
    ? DEFAULT_REQUEST_TIMEOUT_MS
    : 8000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (init?.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  const headers = new Headers(init?.headers || {});
  if (isMicroJobsApiUrl(url) && !headers.has('x-microjobs-client')) headers.set('x-microjobs-client', 'native');
  if (isMicroJobsApiUrl(url) && !headers.has('Authorization')) {
    const token = await storage.getItem(AUTH_TOKEN_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const requestInit: RequestInit = {
    ...init,
    headers,
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

    const result: APIResult<T> = {
      ok: response.ok,
      status: response.status,
      message: getMessage(raw, fallbackMessage),
      data: inferData<T>(raw),
      raw,
    };
    const isRefreshEndpoint = /\/auth\/(?:login|refresh)(?:\/|$)/.test(new URL(url).pathname);
    if (response.status === 401 && isMicroJobsApiUrl(url) && allowRefresh && !isRefreshEndpoint) {
      if (await refreshNativeSession()) {
        const retryHeaders = new Headers(init?.headers || {});
        retryHeaders.delete('Authorization');
        return apiRequest<T>(url, { ...init, headers: retryHeaders }, fallbackMessage, false);
      }
      invalidSessionHandler?.(result);
    }
    const method = String(requestInit.method || 'GET').toUpperCase();
    if (result.ok && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const domains = inferMutationDomains(url);
      if (domains.length) publishDataRefresh({ domains, method, url, at: Date.now() });
    }
    return result;
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    if (__DEV__) console.warn(`API request failed: ${url}`, error);
    return {
      ok: false,
      status: 0,
      message: isTimeout
        ? 'The request timed out. Check your connection and try again.'
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
