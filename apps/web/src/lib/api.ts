import axios from 'axios';
import type { UserRole, UnitStatus } from '@velnari/shared-types';
import type { CreateIncidentDto } from '@velnari/shared-types';
import type { Unit, Incident, Sector, SectorWithBoundary, IncidentEvent, LocationHistoryPoint, IncidentStats, UnitStats, UnitWithDistance, UnitReport, User, Attachment, HeatmapPoint, Patrol, PatrolCoverage } from './types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ accessToken: string; refreshToken: string; expiresIn: number }>(
      '/auth/login',
      { email, password },
    ),

  me: () =>
    api.get<{
      id: string;
      email: string;
      name: string;
      role: UserRole;
      badgeNumber?: string;
    }>('/auth/me'),

  refresh: (refreshToken: string) =>
    api.post<{ accessToken: string; expiresIn: number }>('/auth/refresh', {
      refreshToken,
    }),
};

// ─── Units ───────────────────────────────────────────────────────────────────

export const unitsApi = {
  getAll: (params?: { status?: string; sectorId?: string }) =>
    api.get<Unit[]>('/units', { params }),

  getById: (id: string) => api.get<Unit>(`/units/${id}`),

  updateStatus: (id: string, status: UnitStatus) =>
    api.patch<Unit>(`/units/${id}/status`, { status }),

  getHistory: (id: string, from: string, to: string) =>
    api.get<LocationHistoryPoint[]>(`/units/${id}/history`, { params: { from, to } }),

  getIncidentsByUnit: (id: string, from: string, to: string) =>
    api.get<Incident[]>(`/units/${id}/incidents`, { params: { from, to } }),

  getStats: () => api.get<UnitStats>('/units/stats'),

  getNearby: (lat: number, lng: number, radiusKm?: number) =>
    api.get<UnitWithDistance[]>('/units/nearby', {
      params: { lat, lng, ...(radiusKm ? { radiusKm } : {}) },
    }),

  getReport: (id: string, from: string, to: string) =>
    api.get<UnitReport>(`/units/${id}/report`, { params: { from, to } }),
};

// ─── Incidents ────────────────────────────────────────────────────────────────

export const incidentsApi = {
  getAll: (params?: { status?: string; sectorId?: string; priority?: string }) =>
    api.get<Incident[]>('/incidents', { params }),

  getById: (id: string) => api.get<Incident>(`/incidents/${id}`),

  create: (dto: CreateIncidentDto) => api.post<Incident>('/incidents', dto),

  close: (id: string, resolution: string, notes?: string) =>
    api.post<Incident>(`/incidents/${id}/close`, { resolution, notes }),

  addNote: (id: string, text: string) =>
    api.post<IncidentEvent>(`/incidents/${id}/notes`, { text }),

  getEvents: (id: string) =>
    api.get<IncidentEvent[]>(`/incidents/${id}/events`),

  getStats: (date?: string) =>
    api.get<IncidentStats>('/incidents/stats', { params: date ? { date } : {} }),

  getHeatmap: (from?: string, to?: string) =>
    api.get<HeatmapPoint[]>('/incidents/heatmap', {
      params: { ...(from ? { from } : {}), ...(to ? { to } : {}) },
    }),
};

// ─── Dispatch ────────────────────────────────────────────────────────────────

export const dispatchApi = {
  assignUnit: (incidentId: string, unitId: string) =>
    api.post<Incident>(`/incidents/${incidentId}/assign`, { unitId }),
};

// ─── Sectors ─────────────────────────────────────────────────────────────────

export const sectorsApi = {
  getAll: () => api.get<Sector[]>('/sectors').then(r => r.data),

  getWithBoundary: () => api.get<SectorWithBoundary[]>('/sectors/with-boundary').then(r => r.data),

  create: (data: { name: string; color?: string }) =>
    api.post<Sector>('/sectors', data).then(r => r.data),

  update: (id: string, data: { name?: string; color?: string; isActive?: boolean }) =>
    api.patch<Sector>(`/sectors/${id}`, data).then(r => r.data),

  setBoundary: (id: string, coordinates: [number, number][]) =>
    api.patch<Sector>(`/sectors/${id}/boundary`, { coordinates }).then(r => r.data),

  delete: (id: string) => api.delete(`/sectors/${id}`),
};

// ─── Users ───────────────────────────────────────────────────────────────────

export const usersApi = {
  getAll: () => api.get<User[]>('/users'),

  create: (dto: {
    name: string;
    email: string;
    password: string;
    role: string;
    badgeNumber?: string;
    sectorId?: string;
  }) => api.post<User>('/users', dto),

  update: (
    id: string,
    dto: {
      name?: string;
      role?: string;
      badgeNumber?: string;
      sectorId?: string;
      shift?: string;
      isActive?: boolean;
      password?: string;
      customPermissions?: string[];
    },
  ) => api.patch<User>(`/users/${id}`, dto),
};

// ─── Attachments ─────────────────────────────────────────────────────────────

export const attachmentsApi = {
  getByIncident: (incidentId: string) =>
    api.get<Attachment[]>(`/incidents/${incidentId}/attachments`),

  upload: (incidentId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<Attachment>(`/incidents/${incidentId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  delete: (incidentId: string, id: string) =>
    api.delete(`/incidents/${incidentId}/attachments/${id}`),
};

// ─── Patrols ──────────────────────────────────────────────────────────────────

export const patrolsApi = {
  getActive: () => api.get<Patrol[]>('/patrols'),

  create: (dto: { unitId: string; sectorId: string; startAt: string; endAt: string }) =>
    api.post<Patrol>('/patrols', dto),

  cancel: (id: string) => api.delete(`/patrols/${id}`),

  getCoverage: (id: string) => api.get<PatrolCoverage>(`/patrols/${id}/coverage`),
};
