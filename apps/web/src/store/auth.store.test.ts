import { useAuthStore } from './auth.store';

beforeEach(() => {
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false });
  sessionStorage.clear();
  localStorage.clear();
});

describe('useAuthStore', () => {
  const mockUser = {
    id: 'user-1',
    email: 'operator@test.com',
    name: 'Test Operator',
    role: 'operator',
  };

  it('setAuth guarda usuario y tokens', () => {
    useAuthStore.getState().setAuth(mockUser, 'access-token-123', 'refresh-token-456');

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.accessToken).toBe('access-token-123');
    expect(state.isAuthenticated).toBe(true);
    expect(sessionStorage.getItem('accessToken')).toBe('access-token-123');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-token-456');
  });

  it('clearAuth limpia usuario y tokens', () => {
    useAuthStore.getState().setAuth(mockUser, 'access-token-123', 'refresh-token-456');
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(sessionStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});
