import axios from 'axios';
import type { UserRole, UnitStatus } from '@velnari/shared-types';
import type { CreateIncidentDto } from '@velnari/shared-types';
import type { Unit, Incident, IncidentAssignment, Sector, SectorWithBoundary, IncidentEvent, LocationHistoryPoint, IncidentStats, UnitStats, UnitWithDistance, UnitReport, User, Attachment, HeatmapPoint, Patrol, PatrolCoverage, SuggestedUnit, UnitScore, DailySummary, AnalyticsResult } from './types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
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

// ─── 401 Auto-refresh interceptor ───────────────────────────────────────────

let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return api(originalRequest);
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        // Both tokens now in sessionStorage; fall back to legacy localStorage for users
        // mid-session during the rollout (next login will move it).
        const refreshToken =
          sessionStorage.getItem('refreshToken') ??
          localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const newToken = res.data.accessToken;
        sessionStorage.setItem('accessToken', newToken);
        if (res.data.refreshToken) sessionStorage.setItem('refreshToken', res.data.refreshToken);
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        failedQueue.forEach((p) => p.resolve(newToken));
        failedQueue = [];
        return api(originalRequest);
      } catch {
        failedQueue.forEach((p) => p.reject(error));
        failedQueue = [];
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        localStorage.removeItem('refreshToken');
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

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

  create: (dto: { callSign: string; sectorId?: string; shift?: string; assignedUserId?: string }) =>
    api.post<Unit>('/units', dto),

  update: (id: string, dto: { callSign?: string; sectorId?: string; shift?: string; assignedUserId?: string; isActive?: boolean }) =>
    api.patch<Unit>(`/units/${id}`, dto),

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

  getScoreboard: () => api.get<UnitScore[]>('/units/scoreboard'),
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

  getDailySummary: (date?: string) =>
    api.get<DailySummary>('/incidents/daily-summary', {
      params: date ? { date } : {},
    }),

  getAssignments: (id: string) =>
    api.get<IncidentAssignment[]>(`/incidents/${id}/assignments`),

  getShiftHandoff: () =>
    api.get('/incidents/shift-handoff'),

  getAnalytics: (params: { from: string; to: string; unitId?: string; sectorId?: string; patrolId?: string; userId?: string }) =>
    api.get<AnalyticsResult>('/incidents/analytics', { params }),

  getSlaCompliance: (from?: string, to?: string) =>
    api.get<{
      byPriority: { priority: string; targetMinutes: number; totalIncidents: number; withinSla: number; complianceRate: number; avgResponseMinutes: number | null }[];
      overall: { total: number; withinSla: number; complianceRate: number };
    }>('/incidents/sla-compliance', { params: { from, to } }),

  classify: (description: string, address?: string) =>
    api.post<{
      type: string;
      priority: string;
      confidence: 'high' | 'medium' | 'low';
      reasoning: string;
      tacticalHints?: string[];
    }>('/incidents/classify', { description, ...(address ? { address } : {}) }),
};

// ─── Dispatch ────────────────────────────────────────────────────────────────

export const dispatchApi = {
  assignUnit: (incidentId: string, unitId: string) =>
    api.post<Incident>(`/incidents/${incidentId}/assign`, { unitId }),

  getSuggestions: (incidentId: string) =>
    api.get<SuggestedUnit[]>(`/incidents/${incidentId}/suggestions`),
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

  resetPassword: (id: string, password: string) =>
    api.patch(`/users/${id}/password`, { password }),
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

  getReport: (id: string) => api.get(`/patrols/${id}/report`),
};

// ─── Tenants (Municipios) ─────────────────────────────────────────────────────

export const tenantsApi = {
  getAll: () => api.get<{ id: string; name: string; state?: string; slug?: string; contactEmail?: string; isActive: boolean; createdAt: string }[]>('/tenants'),

  create: (dto: { name: string; state?: string; contactEmail?: string }) =>
    api.post<{ id: string; name: string; slug?: string; isActive: boolean }>('/tenants', dto),

  update: (id: string, dto: { name?: string; state?: string; contactEmail?: string; isActive?: boolean }) =>
    api.patch<{ id: string; name: string; isActive: boolean }>(`/tenants/${id}`, dto),
};

// ─── Reports ─────────────────────────────────────────────────────────────────

export const reportsApi = {
  getTemplates: () => api.get('/reports/templates'),
  getTemplate: (id: string) => api.get(`/reports/templates/${id}`),
  createTemplate: (data: { name: string; description?: string; fields: unknown[] }) =>
    api.post('/reports/templates', data),
  updateTemplate: (id: string, data: { name?: string; description?: string; fields?: unknown[] }) =>
    api.patch(`/reports/templates/${id}`, data),
  deleteTemplate: (id: string) => api.delete(`/reports/templates/${id}`),
  getSubmissions: (params?: { templateId?: string; incidentId?: string }) =>
    api.get('/reports/submissions', { params }),
  createSubmission: (data: { templateId: string; incidentId?: string; data: Record<string, unknown> }) =>
    api.post('/reports/submissions', data),
};
