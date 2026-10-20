import Constants from 'expo-constants';

export const PRODUCTION_API_URL = 'https://microjobs-api-test.azurewebsites.net/api';
export const PRODUCTION_SOCKET_URL = 'https://microjobs-api-test.azurewebsites.net';
const envApiUrl = process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL;
const envSocketUrl = process.env.EXPO_PUBLIC_SOCKET_URL;
const envSocketPath = process.env.EXPO_PUBLIC_SOCKET_PATH;
const envApiSource = process.env.EXPO_PUBLIC_API_SOURCE;
const configuredRequestTimeoutMs = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS || 12000);

// Keep API timeouts consistent across every screen. Individual long-running
// requests can still supply a larger timeout through apiRequest.
export const API_REQUEST_TIMEOUT_MS = Number.isFinite(configuredRequestTimeoutMs) && configuredRequestTimeoutMs > 0
  ? configuredRequestTimeoutMs
  : 12000;
const normalizeExpoOrigin = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return '';
  const raw = value.trim();
  try {
    const normalized = raw
      .replace(/^exps:\/\//i, 'https://')
      .replace(/^exp:\/\//i, 'http://');
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)
      ? normalized
      : `${/\.exp\.direct(?::|\/|$)/i.test(normalized) ? 'https' : 'http'}://${normalized}`;
    const parsed = new URL(withProtocol);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '';
  }
};
const extractHost = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return '';
  const raw = value.trim();
  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
    return new URL(withProtocol).hostname.trim();
  } catch {
    return raw
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
      .split('/')[0]
      .replace(/^\[|\]$/g, '')
      .split(':')[0]
      .trim();
  }
};

const hostCandidates = [
  Constants.expoConfig?.hostUri,
  (Constants.expoConfig as any)?.debuggerHost,
  (Constants.expoConfig as any)?.extra?.expoClient?.debuggerHost,
  (Constants as any).expoGoConfig?.packagerOpts?.host,
  (Constants as any).expoGoConfig?.debuggerHost,
  (Constants.manifest as any)?.debuggerHost,
  (Constants.manifest2 as any)?.extra?.expoClient?.debuggerHost,
  (Constants as any).linkingUri,
];

const detectedExpoOrigin = hostCandidates.map(normalizeExpoOrigin).find(Boolean) || '';
const resolveConfiguredApiUrl = (value: string | undefined) => {
  if (!value) return PRODUCTION_API_URL;
  try {
    const configured = new URL(value);
    if (/^(?:localhost|127(?:\.\d{1,3}){3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|0\.0\.0\.0|::1)$/i.test(configured.hostname)) {
      return PRODUCTION_API_URL;
    }
    return configured.toString();
  } catch {
    return PRODUCTION_API_URL;
  }
};
const normalizedApiUrl = resolveConfiguredApiUrl(envApiUrl).replace(/\/$/, '');

export const API_URL = normalizedApiUrl.endsWith('/api')
  ? normalizedApiUrl
  : `${normalizedApiUrl}/api`;

export const SOCKET_URL = (envSocketUrl || PRODUCTION_SOCKET_URL).replace(/\/$/, '');
export const SOCKET_PATH = envSocketPath || '/socket.io';

export const API_DIAGNOSTICS = Object.freeze({
  apiUrl: API_URL,
  socketUrl: SOCKET_URL,
  source: envApiSource || (process.env.EXPO_PUBLIC_API_URL ? 'environment' : 'production-default'),
  transport: API_URL.startsWith('https:') ? 'https' : 'direct-http',
  expoOrigin: detectedExpoOrigin || undefined,
  host: extractHost(API_URL),
  port: (() => {
    try { return new URL(API_URL).port || (API_URL.startsWith('https:') ? '443' : '80'); }
    catch { return '443'; }
  })(),
});
