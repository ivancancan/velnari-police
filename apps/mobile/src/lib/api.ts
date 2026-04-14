import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { enqueue } from './offline-queue';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// Attach access token to every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// Token refresh queue — prevents concurrent refresh calls
let isRefreshing = false;
let failedQueue: {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}[] = [];

function processQueue(error: unknown, token: string | null): void {
  for (const p of failedQueue) {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token!);
    }
  }
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401 and not already retried — attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Another refresh is in progress — queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post<{ accessToken: string; expiresIn: number }>(
          `${API_URL}/auth/refresh`,
          { refreshToken },
        );

        await SecureStore.setItemAsync('accessToken', data.accessToken);

        // Update Zustand store (lazy import to avoid circular dep)
        const { useAuthStore } = require('../store/auth.store');
        useAuthStore.getState().setAccessToken(data.accessToken);

        processQueue(null, data.accessToken);

        originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Refresh failed — soft logout: clears tokens but preserves offline queue so
        // pending writes (incidents, photos) survive until next login.
        const { useAuthStore } = require('../store/auth.store');
        await useAuthStore.getState().clearSession();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Offline write queueing (non-401 network errors)
    if (!error.response && error.config) {
      const method = error.config.method as string;
      if (['post', 'patch', 'delete'].includes(method)) {
        await enqueue(
          method as 'post' | 'patch' | 'delete',
          error.config.url!,
          error.config.data ? JSON.parse(error.config.data) : undefined,
        );
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
  refresh: (refreshToken: string) =>
    api.post<{ accessToken: string; expiresIn: number }>(
      '/auth/refresh',
      { refreshToken },
    ),
  updatePushToken: (token: string) =>
    api.patch('/auth/push-token', { token }),
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
  getHistory: (id: string, from: string, to: string) =>
    api.get<{ lat: number; lng: number; recordedAt: string }[]>(
      `/units/${id}/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
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

export interface IncidentDetail {
  id: string; folio: string; type: string; priority: string;
  status: string; address?: string; description?: string;
  assignedUnitId?: string; lat: number; lng: number;
  createdAt: string; updatedAt?: string; closedAt?: string;
  resolution?: string;
}

export interface IncidentEvent {
  id: string;
  incidentId: string;
  type: string;
  payload?: Record<string, unknown> | null;
  actorUserId?: string | null;
  createdAt: string;
}

export interface IncidentAttachment {
  id: string;
  incidentId: string;
  url?: string;
  mimeType?: string;
  size?: number;
  createdAt: string;
  gpsLat?: number | null;
  gpsLng?: number | null;
}

export const incidentsApi = {
  getAll: () =>
    api.get<{
      id: string; folio: string; type: string; priority: string;
      status: string; address?: string; description?: string;
      assignedUnitId?: string; createdBy?: string; lat: number; lng: number;
    }[]>('/incidents'),
  getById: (id: string) => api.get<IncidentDetail>(`/incidents/${id}`),
  getEvents: (id: string) => api.get<IncidentEvent[]>(`/incidents/${id}/events`),
  getAttachments: (id: string) => api.get<IncidentAttachment[]>(`/incidents/${id}/attachments`),
  create: (data: {
    type: string; priority: string;
    lat: number; lng: number;
    address?: string; description?: string;
  }) =>
    api.post<{ id: string; folio: string }>('/incidents', data),
  addNote: (incidentId: string, text: string) =>
    api.post(`/incidents/${incidentId}/notes`, { text }),
  close: (incidentId: string, resolution: string, notes?: string) =>
    api.post(`/incidents/${incidentId}/close`, { resolution, ...(notes ? { notes } : {}) }),
  presignAttachment: (incidentId: string, filename: string, mimeType: string) =>
    api.post<{ presignedUrl: string | null; s3Key?: string }>(
      `/incidents/${incidentId}/attachments/presign`,
      { filename, mimeType },
    ),
  confirmAttachment: (incidentId: string, s3Key: string, mimeType: string, size: number) =>
    api.post<{ id: string; url: string }>(
      `/incidents/${incidentId}/attachments/confirm`,
      { s3Key, mimeType, size },
    ),
  uploadPhotoPresigned: async (incidentId: string, uri: string): Promise<void> => {
    const filename = uri.split('/').pop() ?? 'photo.jpg';
    const mimeType = 'image/jpeg';

    const presignRes = await incidentsApi.presignAttachment(incidentId, filename, mimeType);
    const { presignedUrl, s3Key } = presignRes.data;

    if (!presignedUrl || !s3Key) {
      await incidentsApi.uploadPhoto(incidentId, uri);
      return;
    }

    const fileContent = await fetch(uri).then((r) => r.blob());
    const putRes = await fetch(presignedUrl, {
      method: 'PUT',
      body: fileContent,
      headers: { 'Content-Type': mimeType },
    });
    if (!putRes.ok) throw new Error(`S3 PUT failed: ${putRes.status}`);

    await incidentsApi.confirmAttachment(incidentId, s3Key, mimeType, fileContent.size);
  },
  uploadVoiceNote: async (incidentId: string, uri: string): Promise<void> => {
    // Uses the multipart attachments endpoint. S3 presigned PUT is not
    // wired for audio yet — multipart is fine for the demo.
    const formData = new FormData();
    const ext = uri.split('.').pop()?.toLowerCase() ?? 'm4a';
    const mime = ext === 'wav' ? 'audio/wav' : ext === 'mp3' ? 'audio/mpeg' : 'audio/m4a';
    formData.append('file', {
      uri,
      name: `voice-note.${ext}`,
      type: mime,
    } as unknown as Blob);
    formData.append('capturedAt', new Date().toISOString());
    await api.post(`/incidents/${incidentId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  uploadPhoto: async (incidentId: string, uri: string) => {
    const formData = new FormData();
    const filename = uri.split('/').pop() ?? 'photo.jpg';
    formData.append('file', { uri, name: filename, type: 'image/jpeg' } as unknown as Blob);

    // Capture current GPS position for chain of custody
    try {
      const Location = require('expo-location');
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      formData.append('gpsLat', String(loc.coords.latitude));
      formData.append('gpsLng', String(loc.coords.longitude));
      formData.append('capturedAt', new Date().toISOString());
    } catch {
      // GPS unavailable — upload without metadata
      formData.append('capturedAt', new Date().toISOString());
    }

    return api.post(`/incidents/${incidentId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const chatApi = {
  getMessages: (roomId: string, limit = 50) =>
    api.get<{
      id: string; roomId: string; senderId: string;
      senderName: string; senderRole: string;
      content: string; createdAt: string;
    }[]>(`/chat/${roomId}`, { params: { limit } }),
  sendMessage: (roomId: string, content: string) =>
    api.post<{
      id: string; roomId: string; senderId: string;
      senderName: string; senderRole: string;
      content: string; createdAt: string;
    }>(`/chat/${roomId}`, { content }),
};
