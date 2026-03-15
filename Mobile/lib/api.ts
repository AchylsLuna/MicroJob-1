export type APIResult<T = unknown> = {
  ok: boolean;
  status: number;
  message: string;
  data: T | null;
  raw: unknown;
};

const DEFAULT_REQUEST_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS || 8000);

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
  fallbackMessage = 'Request failed.'
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

  const requestInit: RequestInit = {
    ...init,
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

    return {
      ok: response.ok,
      status: response.status,
      message: getMessage(raw, fallbackMessage),
      data: inferData<T>(raw),
      raw,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: fallbackMessage,
      data: null,
      raw: { error: error instanceof Error ? error.message : String(error) },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

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
