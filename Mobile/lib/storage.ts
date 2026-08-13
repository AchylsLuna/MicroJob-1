import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

const usesSecureStorage = Platform.OS === 'android' || Platform.OS === 'ios';

export async function getToken(): Promise<string | null> {
  if (!usesSecureStorage) return AsyncStorage.getItem(AUTH_TOKEN_KEY);

  const securedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  if (securedToken) return securedToken;

  const legacyToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (!legacyToken) return null;

  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, legacyToken);
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  return legacyToken;
}

export async function setToken(token: string): Promise<void> {
  if (usesSecureStorage) {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    return;
  }
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  if (usesSecureStorage) await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  if (!usesSecureStorage) return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  if (usesSecureStorage) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export async function removeRefreshToken(): Promise<void> {
  if (usesSecureStorage) await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
}

const storage = {
  async getItem(key: string) {
    if (key === AUTH_TOKEN_KEY) return getToken();
    if (key === REFRESH_TOKEN_KEY) return getRefreshToken();
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    if (key === AUTH_TOKEN_KEY) return setToken(value);
    if (key === REFRESH_TOKEN_KEY) return setRefreshToken(value);
    return AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    if (key === AUTH_TOKEN_KEY) return removeToken();
    if (key === REFRESH_TOKEN_KEY) return removeRefreshToken();
    return AsyncStorage.removeItem(key);
  },
  async multiRemove(keys: readonly string[]) {
    await Promise.all(keys.map((key) => key === AUTH_TOKEN_KEY ? removeToken() : key === REFRESH_TOKEN_KEY ? removeRefreshToken() : AsyncStorage.removeItem(key)));
  },
};

export default storage;
