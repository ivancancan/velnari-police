import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

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
  clearAuth: () => Promise<void>;
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
