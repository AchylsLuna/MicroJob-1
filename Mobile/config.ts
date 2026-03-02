import Constants from 'expo-constants';

const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
const envSocketUrl = process.env.EXPO_PUBLIC_SOCKET_URL;
const debuggerHost =
  Constants.expoConfig?.hostUri ||
  (Constants.manifest as any)?.debuggerHost ||
  (Constants.manifest2 as any)?.extra?.expoClient?.debuggerHost ||
  '';
const host = debuggerHost ? debuggerHost.split(':')[0] : '';

// Uses EXPO_PUBLIC_API_URL if provided, otherwise auto-detects the Expo host IP.
// This keeps mobile working across different networks without editing this file.
const fallbackOrigin = host ? `http://${host}:5001` : 'http://localhost:5001';
const normalizedApiUrl = (envApiUrl || `${fallbackOrigin}/api`).replace(/\/$/, '');

export const API_URL = normalizedApiUrl.endsWith('/api')
  ? normalizedApiUrl
  : `${normalizedApiUrl}/api`;

export const SOCKET_URL = (envSocketUrl || API_URL.replace(/\/api$/, '')).replace(/\/$/, '');
