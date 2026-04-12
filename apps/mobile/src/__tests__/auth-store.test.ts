import * as SecureStore from 'expo-secure-store';

// Clear queue mock so auth store tests are isolated
jest.mock('../lib/offline-queue', () => ({
  clearQueue: jest.fn().mockResolvedValue(undefined),
}));

import { useAuthStore } from '../store/auth.store';
import { clearQueue } from '../lib/offline-queue';

const TEST_USER = {
  id: 'user-1',
  email: 'operador@velnari.mx',
  name: 'Operador Test',
  role: 'operator',
  badgeNumber: 'B-001',
};

describe('auth store', () => {
  beforeEach(async () => {
    // Reset store state between tests
    await useAuthStore.getState().clearAuth();
    jest.clearAllMocks();
  });

  it('setAuth stores tokens and marks authenticated', async () => {
    await useAuthStore.getState().setAuth('access-abc', 'refresh-xyz', TEST_USER);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe('access-abc');
    expect(state.refreshToken).toBe('refresh-xyz');
    expect(state.user?.email).toBe(TEST_USER.email);
  });

  it('setAuth persists tokens to SecureStore', async () => {
    await useAuthStore.getState().setAuth('access-abc', 'refresh-xyz', TEST_USER);

    expect(await SecureStore.getItemAsync('accessToken')).toBe('access-abc');
    expect(await SecureStore.getItemAsync('refreshToken')).toBe('refresh-xyz');
  });

  it('clearAuth removes tokens and sets unauthenticated', async () => {
    await useAuthStore.getState().setAuth('access-abc', 'refresh-xyz', TEST_USER);
    await useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it('clearAuth deletes tokens from SecureStore', async () => {
    await useAuthStore.getState().setAuth('access-abc', 'refresh-xyz', TEST_USER);
    await useAuthStore.getState().clearAuth();

    expect(await SecureStore.getItemAsync('accessToken')).toBeNull();
    expect(await SecureStore.getItemAsync('refreshToken')).toBeNull();
  });

  it('clearAuth calls clearQueue to discard pending offline actions', async () => {
    await useAuthStore.getState().clearAuth();
    expect(clearQueue).toHaveBeenCalledTimes(1);
  });

  it('loadStoredAuth restores session from SecureStore', async () => {
    // Pre-populate SecureStore as if a previous session existed
    await SecureStore.setItemAsync('accessToken', 'stored-token');
    await SecureStore.setItemAsync('refreshToken', 'stored-refresh');
    await SecureStore.setItemAsync('authUser', JSON.stringify(TEST_USER));

    await useAuthStore.getState().loadStoredAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe('stored-token');
    expect(state.user?.email).toBe(TEST_USER.email);
  });

  it('loadStoredAuth does not authenticate if no stored token', async () => {
    await useAuthStore.getState().loadStoredAuth();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('setAccessToken updates access token without touching refresh token', async () => {
    await useAuthStore.getState().setAuth('old-access', 'refresh-xyz', TEST_USER);
    await useAuthStore.getState().setAccessToken('new-access');

    expect(useAuthStore.getState().accessToken).toBe('new-access');
    expect(useAuthStore.getState().refreshToken).toBe('refresh-xyz');
  });
});
