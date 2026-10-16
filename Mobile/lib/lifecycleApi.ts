import AsyncStorage from './storage';
import { apiRequest, asObject } from './api';
import { API_URL } from '../config';
export async function walletRequest(path: string, body?: any, method = body ? 'POST' : 'GET') {
  const token = await AsyncStorage.getItem('auth_token');
  const response = await apiRequest(`${API_URL}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(response.message);
  return asObject<any>(response.data) || asObject<any>(response.raw) || {};
}
