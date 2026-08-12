import Constants from 'expo-constants';
import { Platform } from 'react-native';

const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
const envSocketUrl = process.env.EXPO_PUBLIC_SOCKET_URL;
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

const host = hostCandidates.map(extractHost).find(Boolean) || '';
// Keep this aligned with scripts/dev.cjs. Port 5000 is commonly occupied by
// macOS Control Center/AirPlay and can surface misleading HTTP 0/CORS errors.
const defaultApiPort = process.env.EXPO_PUBLIC_API_PORT || '5050';

// Uses EXPO_PUBLIC_API_URL if provided, otherwise auto-detects the Expo host IP.
// This keeps mobile working across different networks without editing this file.
const fallbackHost = host || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
const fallbackOrigin = `http://${fallbackHost}:${defaultApiPort}`;
const normalizedApiUrl = (envApiUrl || `${fallbackOrigin}/api`).replace(/\/$/, '');

export const API_URL = normalizedApiUrl.endsWith('/api')
  ? normalizedApiUrl
  : `${normalizedApiUrl}/api`;

export const SOCKET_URL = (envSocketUrl || API_URL.replace(/\/api$/, '')).replace(/\/$/, '');

export const API_DIAGNOSTICS = Object.freeze({
  apiUrl: API_URL,
  socketUrl: SOCKET_URL,
  source: envApiUrl ? 'environment' : host ? 'expo-host' : 'platform-fallback',
  host: extractHost(API_URL),
  port: (() => {
    try { return new URL(API_URL).port || (API_URL.startsWith('https:') ? '443' : '80'); }
    catch { return defaultApiPort; }
  })(),
});
