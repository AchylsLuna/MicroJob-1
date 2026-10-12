import * as LocalAuthentication from 'expo-local-authentication';
import { API_URL } from '../config';
import storage, {
  getBiometricRefreshToken,
  removeBiometricRefreshToken,
  setBiometricRefreshToken,
} from './storage';

const BIOMETRIC_ENABLED_KEY = 'biometric_login_enabled';
const biometricUnlockListeners = new Set<() => void>();

export type BiometricResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'failed' | 'not-enrolled' | 'error'; message?: string };

export async function getBiometricAvailability() {
  if (!LocalAuthentication.hasHardwareAsync || !(await LocalAuthentication.hasHardwareAsync())) return false;
  return LocalAuthentication.isEnrolledAsync();
}

export async function isBiometricLoginEnabled() {
  return (await storage.getItem(BIOMETRIC_ENABLED_KEY)) === 'true';
}

export async function enableBiometricLogin(refreshToken: string): Promise<BiometricResult> {
  if (!(await getBiometricAvailability())) return { ok: false, reason: 'not-enrolled' };
  const authentication = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Confirm your fingerprint to enable biometric login',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  if (!authentication.success) {
    return { ok: false, reason: authentication.error === 'user_cancel' ? 'cancelled' : 'failed' };
  }
  try {
    await setBiometricRefreshToken(refreshToken);
    await storage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'error', message: error instanceof Error ? error.message : undefined };
  }
}

export async function disableBiometricLogin() {
  await removeBiometricRefreshToken();
  await storage.removeItem(BIOMETRIC_ENABLED_KEY);
}

export function subscribeBiometricUnlock(listener: () => void) {
  biometricUnlockListeners.add(listener);
  return () => biometricUnlockListeners.delete(listener);
}

export async function authenticateBiometric(): Promise<BiometricResult> {
  if (!(await isBiometricLoginEnabled()) || !(await getBiometricAvailability())) {
    return { ok: false, reason: 'unavailable' };
  }
  const authentication = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock MicroJobs with your fingerprint',
    cancelLabel: 'Use password',
    disableDeviceFallback: false,
  });
  if (authentication.success) return { ok: true };
  return { ok: false, reason: authentication.error === 'user_cancel' ? 'cancelled' : 'failed' };
}

export async function loginWithBiometrics(): Promise<BiometricResult> {
  if (!(await isBiometricLoginEnabled())) return { ok: false, reason: 'unavailable' };
  const authentication = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Sign in with your fingerprint',
    cancelLabel: 'Use password',
    disableDeviceFallback: false,
  });
  if (!authentication.success) {
    return { ok: false, reason: authentication.error === 'user_cancel' ? 'cancelled' : 'failed' };
  }

  try {
    const refreshToken = await getBiometricRefreshToken();
    if (!refreshToken) {
      await disableBiometricLogin();
      return { ok: false, reason: 'unavailable' };
    }
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-microjobs-client': 'native',
        'x-microjobs-auth-transport': 'bearer',
      },
      body: JSON.stringify({ refreshToken }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.token || !payload?.refreshToken) {
      if (response.status === 401 || response.status === 403) await disableBiometricLogin();
      return { ok: false, reason: 'failed', message: payload?.message };
    }
    await Promise.all([
      storage.setItem('auth_token', payload.token),
      storage.setItem('auth_refresh_token', payload.refreshToken),
      setBiometricRefreshToken(payload.refreshToken),
    ]);
    if (payload.user) await storage.setItem('auth_user', JSON.stringify(payload.user));
    await storage.setItem('has_onboarded', 'true');
    biometricUnlockListeners.forEach((listener) => listener());
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'error', message: error instanceof Error ? error.message : undefined };
  }
}
