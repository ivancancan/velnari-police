import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { clearQueue } from '../lib/offline-queue';
import { clearPhotoQueue } from '../lib/photo-queue';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  badgeNumber?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAuth: (accessToken: string, refreshToken: string, user: AuthUser) => Promise<void>;
  /** Full logout: wipes tokens AND offline queue. Use only for explicit user logout. */
  clearAuth: () => Promise<void>;
  /** Soft clear: wipes tokens but keeps offline queue (for token-refresh failures). */
  clearSession: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  setAccessToken: (token: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,

  setAuth: async (accessToken, refreshToken, user) => {
    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
    await SecureStore.setItemAsync('authUser', JSON.stringify(user));
    set({ accessToken, refreshToken, user, isAuthenticated: true });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('authUser');
    // Full logout → wipe BOTH queues + associated files so the next user
    // on this device doesn't inherit previous operator's photos/actions.
    await clearQueue();
    await clearPhotoQueue();
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
  },

  clearSession: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('authUser');
    // Keep offline queue intact — pending writes (photos, incidents) survive until next login.
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
  },

  loadStoredAuth: async () => {
    const token = await SecureStore.getItemAsync('accessToken');
    const refresh = await SecureStore.getItemAsync('refreshToken');
    const userJson = await SecureStore.getItemAsync('authUser');
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson) as AuthUser;
        set({ accessToken: token, refreshToken: refresh, user, isAuthenticated: true });
      } catch {
        // corrupted data — ignore
      }
    }
  },

  setAccessToken: async (token) => {
    await SecureStore.setItemAsync('accessToken', token);
    set({ accessToken: token });
  },
}));
