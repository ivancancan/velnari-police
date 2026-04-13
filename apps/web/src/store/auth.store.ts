import { create } from 'zustand';
import { UserRole } from '@velnari/shared-types';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  badgeNumber?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  setAuth: (user, accessToken, refreshToken) => {
    if (typeof window !== 'undefined') {
      // Both tokens live in sessionStorage so they die on tab close.
      // Eliminates the localStorage-survives-XSS persistence vector.
      // Trade-off: operator re-logs in when tab closes — acceptable for a
      // command center used one-shift-at-a-time.
      sessionStorage.setItem('accessToken', accessToken);
      sessionStorage.setItem('refreshToken', refreshToken);
      // Clean any legacy tokens from previous localStorage-based session.
      localStorage.removeItem('refreshToken');
    }
    set({ user, accessToken, isAuthenticated: true });
  },

  clearAuth: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      localStorage.removeItem('refreshToken');
    }
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
}));
