import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const AUTH_TOKEN_KEY = 'auth_token';

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

const storage = {
  async getItem(key: string) {
    return key === AUTH_TOKEN_KEY ? getToken() : AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    return key === AUTH_TOKEN_KEY ? setToken(value) : AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    return key === AUTH_TOKEN_KEY ? removeToken() : AsyncStorage.removeItem(key);
  },
  async multiRemove(keys: readonly string[]) {
    await Promise.all(keys.map((key) => (key === AUTH_TOKEN_KEY ? removeToken() : AsyncStorage.removeItem(key))));
  },
};

export default storage;
