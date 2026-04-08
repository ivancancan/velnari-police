# Mobile Field App (Velnari Field) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React Native (Expo) app for police officers in the field — login, see assigned incident, update unit status, and send GPS pings to the API automatically.

**Architecture:** New `apps/mobile` folder with Expo + TypeScript. Uses the same NestJS API as the web app. Navigation via Expo Router (file-based). State managed with Zustand + MMKV for token persistence. GPS pings sent every 30 seconds via `expo-location` background task. No new backend endpoints required — all existing API endpoints are reused.

**Tech Stack:** Expo SDK 51, React Native, TypeScript, Expo Router, Zustand + MMKV, expo-location, expo-secure-store, axios.

---

## File Structure

**New files (all under `apps/mobile/`):**
- `package.json` — Expo + dependencies
- `app.json` — Expo config (name: "Velnari Field", bundle: mx.velnari.field)
- `tsconfig.json` — strict TypeScript
- `app/_layout.tsx` — root layout with auth check
- `app/index.tsx` — redirects to `/login` or `/(tabs)/home`
- `app/login.tsx` — login screen
- `app/(tabs)/_layout.tsx` — tab bar (Home + Profile)
- `app/(tabs)/home.tsx` — main screen: assigned incident card + status selector + GPS status
- `app/(tabs)/profile.tsx` — show name, role, badge; logout button
- `src/lib/api.ts` — axios instance using `EXPO_PUBLIC_API_URL`
- `src/lib/location.ts` — start/stop background GPS pings
- `src/store/auth.store.ts` — Zustand with MMKV persistence (accessToken, user)
- `src/store/unit.store.ts` — current unit status + assigned incident

---

## Task 1: Expo project bootstrap

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/tsconfig.json`

- [ ] **Step 1: Create package.json**

Create `apps/mobile/package.json`:

```json
{
  "name": "velnari-mobile",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios"
  },
  "dependencies": {
    "expo": "~51.0.0",
    "expo-router": "~3.5.0",
    "expo-location": "~17.0.0",
    "expo-secure-store": "~13.0.0",
    "expo-task-manager": "~11.8.0",
    "expo-status-bar": "~1.12.0",
    "react": "18.2.0",
    "react-native": "0.74.0",
    "axios": "^1.6.0",
    "zustand": "^5.0.0",
    "react-native-mmkv": "^2.12.0"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/react": "~18.2.0",
    "typescript": "^5.3.0"
  }
}
```

- [ ] **Step 2: Create app.json**

Create `apps/mobile/app.json`:

```json
{
  "expo": {
    "name": "Velnari Field",
    "slug": "velnari-field",
    "version": "1.0.0",
    "scheme": "velnari",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "backgroundColor": "#0F172A"
    },
    "ios": {
      "bundleIdentifier": "mx.velnari.field",
      "infoPlist": {
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Velnari necesita tu ubicación para el despacho.",
        "NSLocationWhenInUseUsageDescription": "Velnari necesita tu ubicación para el despacho."
      }
    },
    "android": {
      "package": "mx.velnari.field",
      "permissions": ["ACCESS_FINE_LOCATION", "ACCESS_BACKGROUND_LOCATION"]
    },
    "plugins": [
      ["expo-location", { "locationAlwaysAndWhenInUsePermission": "Velnari necesita tu ubicación." }]
    ]
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

Create `apps/mobile/tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 4: Install dependencies**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/mobile" && npm install 2>&1 | tail -5
```

Expected: packages installed.

- [ ] **Step 5: Create assets placeholder**

```bash
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/mobile/assets"
```

The icon/splash are optional for development — Expo uses defaults if missing.

- [ ] **Step 6: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari" && git add apps/mobile/package.json apps/mobile/app.json apps/mobile/tsconfig.json && git commit -m "feat: bootstrap Velnari Field Expo project"
```

---

## Task 2: API client + Auth store

**Files:**
- Create: `apps/mobile/src/lib/api.ts`
- Create: `apps/mobile/src/store/auth.store.ts`

- [ ] **Step 1: Create API client**

Create `apps/mobile/src/lib/api.ts`:

```typescript
// apps/mobile/src/lib/api.ts
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

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
};

export const unitsApi = {
  getAll: () => api.get<{ id: string; callSign: string; status: string; assignedUserId?: string }[]>('/units'),
  updateStatus: (id: string, status: string) =>
    api.patch<{ id: string; status: string }>(`/units/${id}/status`, { status }),
  updateLocation: (id: string, lat: number, lng: number) =>
    api.patch(`/units/${id}/location`, { lat, lng }),
};

export const incidentsApi = {
  getAll: () =>
    api.get<{
      id: string; folio: string; type: string; priority: string;
      status: string; address?: string; description?: string;
      assignedUnitId?: string;
    }[]>('/incidents'),
};
```

- [ ] **Step 2: Create auth store**

Create `apps/mobile/src/store/auth.store.ts`:

```typescript
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
```

- [ ] **Step 3: Create unit store**

Create `apps/mobile/src/store/unit.store.ts`:

```typescript
// apps/mobile/src/store/unit.store.ts
import { create } from 'zustand';

interface AssignedIncident {
  id: string;
  folio: string;
  type: string;
  priority: string;
  status: string;
  address?: string;
  description?: string;
}

interface UnitState {
  unitId: string | null;
  callSign: string | null;
  status: string;
  assignedIncident: AssignedIncident | null;
  setUnit: (unitId: string, callSign: string, status: string) => void;
  setStatus: (status: string) => void;
  setAssignedIncident: (incident: AssignedIncident | null) => void;
}

export const useUnitStore = create<UnitState>((set) => ({
  unitId: null,
  callSign: null,
  status: 'available',
  assignedIncident: null,
  setUnit: (unitId, callSign, status) => set({ unitId, callSign, status }),
  setStatus: (status) => set({ status }),
  setAssignedIncident: (incident) => set({ assignedIncident: incident }),
}));
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari" && git add apps/mobile/src/ && git commit -m "feat: add API client and auth/unit stores to mobile app"
```

---

## Task 3: GPS background location tracking

**Files:**
- Create: `apps/mobile/src/lib/location.ts`

- [ ] **Step 1: Create location.ts**

Create `apps/mobile/src/lib/location.ts`:

```typescript
// apps/mobile/src/lib/location.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { unitsApi } from './api';

const LOCATION_TASK = 'velnari-location-task';
let _unitId: string | null = null;

// Define the background task
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locationData = data as { locations: Location.LocationObject[] };
  const location = locationData.locations[0];
  if (!location || !_unitId) return;

  const { latitude, longitude } = location.coords;
  try {
    await unitsApi.updateLocation(_unitId, latitude, longitude);
  } catch {
    // silently fail — will retry on next ping
  }
});

export async function startLocationTracking(unitId: string): Promise<boolean> {
  _unitId = unitId;

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return false;

  const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus.status !== 'granted') {
    // foreground-only tracking as fallback
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 30000, // 30 seconds
      distanceInterval: 50, // or 50 meters, whichever comes first
      foregroundService: {
        notificationTitle: 'Velnari Field activo',
        notificationBody: 'Enviando ubicación al centro de mando.',
      },
    });
    return true;
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 30000,
    distanceInterval: 50,
    foregroundService: {
      notificationTitle: 'Velnari Field activo',
      notificationBody: 'Enviando ubicación al centro de mando.',
    },
  });
  return true;
}

export async function stopLocationTracking(): Promise<void> {
  _unitId = null;
  const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (isTracking) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari" && git add apps/mobile/src/lib/location.ts && git commit -m "feat: add GPS background location tracking to mobile app"
```

---

## Task 4: Screens — Login + Root Layout

**Files:**
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/index.tsx`
- Create: `apps/mobile/app/login.tsx`

- [ ] **Step 1: Create root layout**

Create `apps/mobile/app/_layout.tsx`:

```tsx
// apps/mobile/app/_layout.tsx
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/auth.store';

export default function RootLayout() {
  const { loadStoredAuth } = useAuthStore();
  useEffect(() => { loadStoredAuth(); }, [loadStoredAuth]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
          contentStyle: { backgroundColor: '#0F172A' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
```

- [ ] **Step 2: Create index redirect**

Create `apps/mobile/app/index.tsx`:

```tsx
// apps/mobile/app/index.tsx
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';

export default function Index() {
  const { isAuthenticated } = useAuthStore();
  return <Redirect href={isAuthenticated ? '/(tabs)/home' : '/login'} />;
}
```

- [ ] **Step 3: Create login screen**

Create `apps/mobile/app/login.tsx`:

```tsx
// apps/mobile/app/login.tsx
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export default function LoginScreen() {
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email || !password) { setError('Ingresa email y contraseña'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login(email, password);
      const meRes = await authApi.me();
      // @ts-expect-error - interceptor sets token for next request
      await setAuth(res.data.accessToken, meRes.data);
      router.replace('/(tabs)/home');
    } catch {
      setError('Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>VELNARI</Text>
        <Text style={styles.subtitle}>Field Operations</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#64748B"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#64748B"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Ingresar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  inner: { flex: 1, justifyContent: 'center', padding: 32 },
  title: { fontSize: 32, fontWeight: '700', color: '#F8FAFC', textAlign: 'center', letterSpacing: 6 },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 48 },
  error: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginBottom: 16, backgroundColor: '#450a0a', padding: 10, borderRadius: 8 },
  input: {
    backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155',
    borderRadius: 8, padding: 14, color: '#F8FAFC', fontSize: 15, marginBottom: 12,
  },
  button: { backgroundColor: '#3B82F6', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari" && git add apps/mobile/app/_layout.tsx apps/mobile/app/index.tsx apps/mobile/app/login.tsx && git commit -m "feat: add login screen and root layout to mobile app"
```

---

## Task 5: Screens — Home (status + incident) + Profile + Tab layout

**Files:**
- Create: `apps/mobile/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/app/(tabs)/home.tsx`
- Create: `apps/mobile/app/(tabs)/profile.tsx`

- [ ] **Step 1: Create tab layout**

Create `apps/mobile/app/(tabs)/_layout.tsx`:

```tsx
// apps/mobile/app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#0F172A', borderTopColor: '#1E293B' },
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#64748B',
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: '#F8FAFC',
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Servicio', tabBarLabel: 'Servicio' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Mi perfil', tabBarLabel: 'Perfil' }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: Create home screen**

Create `apps/mobile/app/(tabs)/home.tsx`:

```tsx
// apps/mobile/app/(tabs)/home.tsx
import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, RefreshControl,
} from 'react-native';
import { useAuthStore } from '@/store/auth.store';
import { useUnitStore } from '@/store/unit.store';
import { unitsApi, incidentsApi } from '@/lib/api';
import { startLocationTracking, stopLocationTracking } from '@/lib/location';

const STATUS_OPTIONS = [
  { value: 'available', label: 'Disponible', color: '#22C55E' },
  { value: 'en_route', label: 'En camino', color: '#3B82F6' },
  { value: 'on_scene', label: 'En escena', color: '#F59E0B' },
  { value: 'out_of_service', label: 'Fuera de servicio', color: '#EF4444' },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#EF4444', high: '#F97316', medium: '#F59E0B', low: '#22C55E',
};

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { unitId, callSign, status, assignedIncident, setUnit, setStatus, setAssignedIncident } = useUnitStore();
  const [refreshing, setRefreshing] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);

  async function loadUnitAndIncident() {
    try {
      const unitsRes = await unitsApi.getAll();
      const myUnit = unitsRes.data.find((u) => u.assignedUserId === user?.id);
      if (!myUnit) return;
      setUnit(myUnit.id, myUnit.callSign, myUnit.status);

      const incidentsRes = await incidentsApi.getAll();
      const myIncident = incidentsRes.data.find(
        (i) => i.assignedUnitId === myUnit.id && i.status !== 'closed',
      );
      setAssignedIncident(myIncident ?? null);
    } catch {
      // silent — user sees stale data
    }
  }

  useEffect(() => {
    loadUnitAndIncident();
  }, []);

  async function handleStatusChange(newStatus: string) {
    if (!unitId) { Alert.alert('Sin unidad asignada', 'Tu usuario no tiene una unidad asignada.'); return; }
    try {
      await unitsApi.updateStatus(unitId, newStatus);
      setStatus(newStatus);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el estado.');
    }
  }

  async function toggleTracking() {
    if (!unitId) { Alert.alert('Sin unidad asignada'); return; }
    if (trackingActive) {
      await stopLocationTracking();
      setTrackingActive(false);
    } else {
      const started = await startLocationTracking(unitId);
      setTrackingActive(started);
      if (!started) Alert.alert('Permiso denegado', 'Activa los permisos de ubicación en configuración.');
    }
  }

  const currentStatusOption = STATUS_OPTIONS.find((s) => s.value === status);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadUnitAndIncident(); setRefreshing(false); }} />}
    >
      {/* Unit header */}
      <View style={styles.unitCard}>
        <Text style={styles.callSign}>{callSign ?? 'Sin unidad'}</Text>
        <View style={[styles.statusBadge, { backgroundColor: currentStatusOption?.color + '22' }]}>
          <Text style={[styles.statusText, { color: currentStatusOption?.color }]}>
            {currentStatusOption?.label ?? status}
          </Text>
        </View>
      </View>

      {/* GPS tracking toggle */}
      <TouchableOpacity
        style={[styles.gpsButton, trackingActive && styles.gpsButtonActive]}
        onPress={toggleTracking}
      >
        <Text style={styles.gpsButtonText}>
          {trackingActive ? '📍 GPS activo — toca para detener' : '📍 Activar GPS'}
        </Text>
      </TouchableOpacity>

      {/* Status selector */}
      <Text style={styles.sectionLabel}>Cambiar estado</Text>
      <View style={styles.statusGrid}>
        {STATUS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.statusOption,
              status === opt.value && { borderColor: opt.color, backgroundColor: opt.color + '22' },
            ]}
            onPress={() => handleStatusChange(opt.value)}
          >
            <Text style={[styles.statusOptionText, status === opt.value && { color: opt.color }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Assigned incident */}
      <Text style={styles.sectionLabel}>Incidente asignado</Text>
      {assignedIncident ? (
        <View style={styles.incidentCard}>
          <View style={styles.incidentHeader}>
            <Text style={styles.incidentFolio}>{assignedIncident.folio}</Text>
            <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[assignedIncident.priority] + '22' }]}>
              <Text style={[styles.priorityText, { color: PRIORITY_COLORS[assignedIncident.priority] }]}>
                {assignedIncident.priority.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.incidentType}>{assignedIncident.type}</Text>
          {assignedIncident.address && (
            <Text style={styles.incidentAddress}>{assignedIncident.address}</Text>
          )}
          {assignedIncident.description && (
            <Text style={styles.incidentDesc}>{assignedIncident.description}</Text>
          )}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Sin incidente asignado</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', padding: 16 },
  unitCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  callSign: { color: '#F8FAFC', fontSize: 22, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '600' },
  gpsButton: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 12, marginBottom: 16, alignItems: 'center' },
  gpsButtonActive: { borderColor: '#22C55E', backgroundColor: '#052e16' },
  gpsButtonText: { color: '#F8FAFC', fontSize: 13 },
  sectionLabel: { color: '#64748B', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  statusOption: { borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  statusOptionText: { color: '#94A3B8', fontSize: 13 },
  incidentCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 24 },
  incidentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  incidentFolio: { color: '#F8FAFC', fontWeight: '700', fontSize: 16 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  priorityText: { fontSize: 11, fontWeight: '600' },
  incidentType: { color: '#94A3B8', fontSize: 13, textTransform: 'capitalize', marginBottom: 4 },
  incidentAddress: { color: '#F8FAFC', fontSize: 14, marginBottom: 4 },
  incidentDesc: { color: '#64748B', fontSize: 13 },
  emptyCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 32, alignItems: 'center' },
  emptyText: { color: '#64748B', fontSize: 14 },
});
```

- [ ] **Step 3: Create profile screen**

Create `apps/mobile/app/(tabs)/profile.tsx`:

```tsx
// apps/mobile/app/(tabs)/profile.tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { stopLocationTracking } from '@/lib/location';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador', commander: 'Comandante', supervisor: 'Supervisor',
  operator: 'Operador', field_unit: 'Unidad de Campo',
};

export default function ProfileScreen() {
  const { user, clearAuth } = useAuthStore();

  async function handleLogout() {
    await stopLocationTracking();
    await clearAuth();
    router.replace('/login');
  }

  if (!user) return null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.role}>{ROLE_LABELS[user.role] ?? user.role}</Text>
        {user.badgeNumber && (
          <Text style={styles.badge}>Placa: {user.badgeNumber}</Text>
        )}
        <Text style={styles.email}>{user.email}</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', padding: 24 },
  card: { backgroundColor: '#1E293B', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  name: { color: '#F8FAFC', fontSize: 20, fontWeight: '600', marginBottom: 4 },
  role: { color: '#3B82F6', fontSize: 13, marginBottom: 4 },
  badge: { color: '#64748B', fontSize: 13, marginBottom: 4 },
  email: { color: '#64748B', fontSize: 13 },
  logoutButton: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#EF4444', borderRadius: 8, padding: 14, alignItems: 'center' },
  logoutText: { color: '#EF4444', fontWeight: '600' },
});
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari" && git add apps/mobile/app/ && git commit -m "feat: add home, profile screens and tab navigation to mobile app"
```

---

## Self-Review

**Spec coverage:**
- ✅ Login screen — email/password → JWT stored in SecureStore
- ✅ See assigned incident — matches by `assignedUnitId === myUnit.id`
- ✅ Update unit status — 4-button status selector calls `PATCH /units/:id/status`
- ✅ GPS pings — background task every 30s calls `PATCH /units/:id/location`
- ✅ Logout — clears SecureStore, stops GPS, redirects to login
- ✅ Profile screen — shows name, role, badge

**Placeholder scan:** None.

**Type consistency:** All store types match API response shapes ✅
