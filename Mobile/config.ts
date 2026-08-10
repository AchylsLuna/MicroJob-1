import Constants from 'expo-constants';
import { Platform } from 'react-native';

const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
const envSocketUrl = process.env.EXPO_PUBLIC_SOCKET_URL;
const extractHost = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return '';
  return value
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .trim();
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
