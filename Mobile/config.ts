import Constants from 'expo-constants';
import { Platform } from 'react-native';

const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
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

const detectedHosts = hostCandidates.map(extractHost).filter(Boolean);
const detectedExpoOrigin = hostCandidates.map(normalizeExpoOrigin).find(Boolean) || '';
const isLoopbackHost = (value: string) => /^(?:localhost|127(?:\.\d{1,3}){3}|::1)$/i.test(value);
const isWildcardHost = (value: string) => /^(?:0\.0\.0\.0|::)$/i.test(value);
const host = detectedHosts.find((value) => !isLoopbackHost(value)) || detectedHosts[0] || '';
// Keep this aligned with scripts/dev.cjs. Port 5000 is commonly occupied by
// macOS Control Center/AirPlay and can surface misleading HTTP 0/CORS errors.
const defaultApiPort = process.env.EXPO_PUBLIC_API_PORT || '5050';

// Uses EXPO_PUBLIC_API_URL if provided, otherwise auto-detects the Expo host IP.
// This keeps mobile working across different networks without editing this file.
const fallbackHost = host && !(Platform.OS === 'android' && isLoopbackHost(host))
  ? host
  : Platform.OS === 'android'
    ? '10.0.2.2'
    : 'localhost';
const fallbackOrigin = `http://${fallbackHost}:${defaultApiPort}`;
const resolveConfiguredApiUrl = (value: string | undefined) => {
  if (!value) return `${fallbackOrigin}/api`;
  try {
    const configured = new URL(value);
    if (isWildcardHost(configured.hostname)) configured.hostname = fallbackHost;
    return configured.toString();
  } catch {
    return value;
  }
};
const usesMetroProxy = envApiSource === 'development-metro-proxy' && Boolean(detectedExpoOrigin);
const normalizedApiUrl = (usesMetroProxy
  ? `${detectedExpoOrigin}/microjobs-api/api`
  : resolveConfiguredApiUrl(envApiUrl)).replace(/\/$/, '');

export const API_URL = normalizedApiUrl.endsWith('/api')
  ? normalizedApiUrl
  : `${normalizedApiUrl}/api`;

export const SOCKET_URL = (usesMetroProxy ? detectedExpoOrigin : envSocketUrl || API_URL.replace(/\/api$/, '')).replace(/\/$/, '');
export const SOCKET_PATH = envSocketPath || '/socket.io';

export const API_DIAGNOSTICS = Object.freeze({
  apiUrl: API_URL,
  socketUrl: SOCKET_URL,
  source: envApiSource || (envApiUrl ? 'environment' : host && !isLoopbackHost(host) ? 'expo-host' : 'platform-fallback'),
  transport: usesMetroProxy ? 'metro-proxy' : API_URL.startsWith('https:') ? 'https' : 'direct-http',
  expoOrigin: detectedExpoOrigin || undefined,
  host: extractHost(API_URL),
  port: (() => {
    try { return new URL(API_URL).port || (API_URL.startsWith('https:') ? '443' : '80'); }
    catch { return defaultApiPort; }
  })(),
});
