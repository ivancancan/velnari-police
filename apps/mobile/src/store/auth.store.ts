// apps/mobile/src/store/auth.store.ts
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
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: AuthUser) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,

  setAuth: async (token, user) => {
    await SecureStore.setItemAsync('accessToken', token);
    await SecureStore.setItemAsync('authUser', JSON.stringify(user));
    set({ accessToken: token, user, isAuthenticated: true });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('authUser');
    set({ accessToken: null, user: null, isAuthenticated: false });
  },

  loadStoredAuth: async () => {
    const token = await SecureStore.getItemAsync('accessToken');
    const userJson = await SecureStore.getItemAsync('authUser');
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson) as AuthUser;
        set({ accessToken: token, user, isAuthenticated: true });
      } catch {
        // corrupted data — ignore
      }
    }
  },
}));
