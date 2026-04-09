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

import { enqueue } from './offline-queue';

// Queue failed write requests for offline retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error.response && error.config) {
      const method = error.config.method as string;
      if (['post', 'patch', 'delete'].includes(method)) {
        await enqueue(method as 'post' | 'patch' | 'delete', error.config.url, error.config.data ? JSON.parse(error.config.data) : undefined);
      }
    }
    return Promise.reject(error);
  },
);

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
    api.get<{
      id: string; callSign: string; status: string;
      assignedUserId?: string; lat?: number; lng?: number;
    }[]>('/units'),
  updateStatus: (id: string, status: string) =>
    api.patch<{ id: string; status: string }>(`/units/${id}/status`, { status }),
  updateLocation: (id: string, lat: number, lng: number, batteryLevel?: number) =>
    api.patch(`/units/${id}/location`, { lat, lng, ...(batteryLevel != null ? { batteryLevel } : {}) }),
};

export const patrolsApi = {
  getForUnit: (unitId: string) =>
    api.get<{
      id: string; unitId: string; sectorId: string; status: string;
      startAt: string; endAt: string; acceptedAt?: string;
      sector?: { id: string; name: string };
    }[]>(`/patrols/unit/${unitId}`),
  getActiveForUnit: (unitId: string) =>
    api.get<{
      id: string; unitId: string; sectorId: string; status: string;
      startAt: string; endAt: string; acceptedAt?: string;
      sector?: { id: string; name: string };
    } | null>(`/patrols/unit/${unitId}/active`),
  accept: (id: string) =>
    api.post<{ id: string; status: string; acceptedAt: string }>(`/patrols/${id}/accept`),
};

export const incidentsApi = {
  getAll: () =>
    api.get<{
      id: string; folio: string; type: string; priority: string;
      status: string; address?: string; description?: string;
      assignedUnitId?: string; lat: number; lng: number;
    }[]>('/incidents'),
  create: (data: {
    type: string; priority: string;
    lat: number; lng: number;
    address?: string; description?: string;
  }) =>
    api.post<{ id: string; folio: string }>('/incidents', data),
  addNote: (incidentId: string, text: string) =>
    api.post(`/incidents/${incidentId}/notes`, { text }),
  uploadPhoto: (incidentId: string, uri: string) => {
    const formData = new FormData();
    const filename = uri.split('/').pop() ?? 'photo.jpg';
    formData.append('file', { uri, name: filename, type: 'image/jpeg' } as unknown as Blob);
    return api.post(`/incidents/${incidentId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
