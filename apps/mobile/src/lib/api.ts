// apps/mobile/src/lib/api.ts
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ accessToken: string; refreshToken: string; expiresIn: number }>(
      '/auth/login',
      { email, password },
    ),
  me: () =>
    api.get<{ id: string; email: string; name: string; role: string; badgeNumber?: string }>(
      '/auth/me',
    ),
};

export const unitsApi = {
  getAll: () =>
    api.get<{ id: string; callSign: string; status: string; assignedUserId?: string }[]>('/units'),
  updateStatus: (id: string, status: string) =>
    api.patch<{ id: string; status: string }>(`/units/${id}/status`, { status }),
  updateLocation: (id: string, lat: number, lng: number) =>
    api.patch(`/units/${id}/location`, { lat, lng }),
};

export const incidentsApi = {
  getAll: () =>
    api.get<{
      id: string; folio: string; type: string; priority: string;
      status: string; address?: string; description?: string;
      assignedUnitId?: string;
    }[]>('/incidents'),
};
