import axios from 'axios';
import { UserRole } from '@velnari/shared-types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Inject access token on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

// Auth API calls
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
