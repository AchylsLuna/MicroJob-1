import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { API_URL } from '../config';
import { apiRequest, asObject } from './api';
import storage from './storage';

const DEVICE_ID_KEY = 'push_device_registration_id';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerPushDevice(): Promise<string | null> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'MicroJobs updates',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 180, 250],
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.status === 'granted' ? existing : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  if (!projectId) return null;
  const expoToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const result = await apiRequest(`${API_URL}/notifications/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: expoToken, platform: 'expo', deviceName: `${Platform.OS} mobile` }),
  }, 'Unable to register this device for notifications.');
  if (!result.ok) return null;
  const payload = asObject<any>(result.data) || asObject<any>(result.raw) || {};
  const deviceId = String(payload?.device?._id || '');
  if (deviceId) await storage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId || null;
}

export async function unregisterPushDevice(): Promise<void> {
  const deviceId = await storage.getItem(DEVICE_ID_KEY);
  if (!deviceId) return;
  try {
    await apiRequest(`${API_URL}/notifications/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' }, '');
  } finally {
    await storage.removeItem(DEVICE_ID_KEY);
  }
}

export async function takeInitialNotificationData(): Promise<Record<string, unknown> | null> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return null;
  await Notifications.clearLastNotificationResponseAsync();
  return (response.notification.request.content.data || null) as Record<string, unknown> | null;
}

export function subscribeNotificationResponses(
  onResponse: (data: Record<string, unknown>) => void,
  onReceive?: () => void,
) {
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    onResponse((response.notification.request.content.data || {}) as Record<string, unknown>);
  });
  const receiveSubscription = Notifications.addNotificationReceivedListener(() => onReceive?.());
  return () => {
    responseSubscription.remove();
    receiveSubscription.remove();
  };
}
