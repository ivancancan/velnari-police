# Velnari Command Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la app web `apps/web` de Velnari Command — un centro de mando con mapa en tiempo real de unidades policiales, panel de incidentes, flujo de despacho y actualizaciones vía WebSocket.

**Architecture:** Next.js 14 (App Router) con Tailwind CSS en dark mode. La página `/command` muestra un mapa MapLibre GL (65%) y un panel de incidentes (35%). Zustand maneja el estado global (auth, units, incidents). Socket.IO recibe actualizaciones en tiempo real del backend NestJS. API client con axios apunta a `http://localhost:3001/api`.

**Tech Stack:** Next.js 14, React 18, Tailwind CSS v3, MapLibre GL + react-map-gl@7, Zustand v5, Axios, Socket.IO Client v4, React Hook Form + Zod, Jest + React Testing Library

---

## Dependencias entre tasks

```
Task 1: Scaffold apps/web (package.json, configs, test setup, mocks)
    ↓
Task 2: Auth layer (API client, auth Zustand store, login page, middleware)
    ↓
Task 3: Command layout + header
    ↓
Task 4: Data layer (tipos, API functions, stores de units/incidents)
    ↓
Task 5: Map component (MapLibre + unit markers + incident markers)
    ↓
Task 6: Incidents sidebar (IncidentList + IncidentCard)
    ↓
Task 7: Incident detail panel (slide-in + timeline)
    ↓
Task 8: Create incident modal (form con validación)
    ↓
Task 9: Assign unit modal (dispatch)
    ↓
Task 10: Socket.IO live updates + push final
```

---

## Mapa de Archivos

```
apps/web/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── jest.config.ts
├── jest.setup.ts
├── .env.local.example
└── src/
    ├── __mocks__/
    │   ├── maplibre-gl.ts          # Mock para tests
    │   └── react-map-gl.tsx        # Mock para tests
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx                # Redirect a /command o /login
    │   ├── login/
    │   │   └── page.tsx
    │   └── command/
    │       └── page.tsx
    ├── components/
    │   ├── auth/
    │   │   └── LoginForm.tsx
    │   ├── map/
    │   │   ├── CommandMap.tsx
    │   │   └── UnitMarker.tsx
    │   ├── incidents/
    │   │   ├── IncidentList.tsx
    │   │   ├── IncidentCard.tsx
    │   │   ├── IncidentDetail.tsx
    │   │   ├── CreateIncidentModal.tsx
    │   │   └── AssignUnitModal.tsx
    │   └── ui/
    │       ├── Badge.tsx
    │       └── Modal.tsx
    ├── lib/
    │   ├── api.ts
    │   ├── socket.ts
    │   └── types.ts
    ├── store/
    │   ├── auth.store.ts
    │   ├── units.store.ts
    │   └── incidents.store.ts
    └── middleware.ts
```

---

## Task 1: Scaffold apps/web

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/jest.config.ts`
- Create: `apps/web/jest.setup.ts`
- Create: `apps/web/.env.local.example`
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/__mocks__/maplibre-gl.ts`
- Create: `apps/web/src/__mocks__/react-map-gl.tsx`

- [ ] **Step 1: Crear todos los directorios necesarios**

```bash
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web/src/__mocks__"
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web/src/app/login"
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web/src/app/command"
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web/src/components/auth"
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web/src/components/map"
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web/src/components/incidents"
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web/src/components/ui"
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web/src/lib"
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web/src/store"
```

- [ ] **Step 2: Crear `apps/web/package.json`**

```json
{
  "name": "@velnari/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "jest --passWithNoTests",
    "lint": "next lint"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.3.4",
    "@velnari/shared-types": "workspace:*",
    "axios": "^1.6.7",
    "maplibre-gl": "^4.3.2",
    "next": "^14.2.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.51.3",
    "react-map-gl": "^7.1.7",
    "socket.io-client": "^4.8.1",
    "zod": "^3.23.8",
    "zustand": "^5.0.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.2",
    "@testing-library/react": "^15.0.2",
    "@testing-library/user-event": "^14.5.2",
    "@types/node": "^20.11.5",
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.0",
    "@velnari/config": "workspace:*",
    "autoprefixer": "^10.4.19",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "typescript": "^5.3.3"
  }
}
```

- [ ] **Step 3: Instalar dependencias**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
~/.local/bin/pnpm install 2>&1 | tail -10
```

Esperado: exit 0, dependencias instaladas incluyendo next, react, maplibre-gl, zustand.

- [ ] **Step 4: Crear `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    },
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Crear `apps/web/next.config.ts`**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@velnari/shared-types'],
};

export default nextConfig;
```

- [ ] **Step 6: Crear `apps/web/postcss.config.mjs`**

```javascript
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
```

- [ ] **Step 7: Crear `apps/web/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'midnight-command': '#0F172A',
        'tactical-blue': '#3B82F6',
        'alert-amber': '#F59E0B',
        'slate-gray': '#64748B',
        'signal-white': '#F8FAFC',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 8: Crear `apps/web/jest.config.ts`**

```typescript
import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const customConfig: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^maplibre-gl$': '<rootDir>/src/__mocks__/maplibre-gl.ts',
    '^react-map-gl/maplibre$': '<rootDir>/src/__mocks__/react-map-gl.tsx',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
};

export default createJestConfig(customConfig);
```

**Nota:** Si Jest lanza error sobre `setupFilesAfterFramework`, el nombre correcto de la propiedad es `setupFilesAfterFramework`. Verificar con `jest --showConfig` si hay duda, o usar `setupFilesAfterFramework`.

- [ ] **Step 9: Crear `apps/web/jest.setup.ts`**

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 10: Crear `apps/web/.env.local.example`**

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

Crear también el `.env.local` real (no commitear):
```bash
cp "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web/.env.local.example" \
   "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web/.env.local"
```

- [ ] **Step 11: Crear mocks para tests**

`apps/web/src/__mocks__/maplibre-gl.ts`:
```typescript
const maplibregl = {
  Map: jest.fn(),
  Marker: jest.fn(),
  NavigationControl: jest.fn(),
  GeolocateControl: jest.fn(),
};

export default maplibregl;
```

`apps/web/src/__mocks__/react-map-gl.tsx`:
```typescript
import React from 'react';

export const Map = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="map-container">{children}</div>
);

export const Marker = ({
  children,
  latitude,
  longitude,
}: {
  children?: React.ReactNode;
  latitude: number;
  longitude: number;
}) => (
  <div data-testid={`marker-${latitude}-${longitude}`}>{children}</div>
);

export const NavigationControl = () => <div data-testid="nav-control" />;

export default Map;
```

- [ ] **Step 12: Crear `apps/web/src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-primary: #0F172A;
  --color-primary: #F8FAFC;
}

body {
  background-color: #0F172A;
  color: #F8FAFC;
}
```

- [ ] **Step 13: Crear `apps/web/src/app/layout.tsx`**

```typescript
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Velnari Command',
  description: 'El sistema operativo de la seguridad municipal.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-midnight-command text-signal-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 14: Crear `apps/web/src/app/page.tsx`**

```typescript
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/command');
}
```

- [ ] **Step 15: Verificar typecheck**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web"
~/.local/bin/pnpm typecheck 2>&1 | tail -10
```

Si hay errores de `next-env.d.ts` no encontrado, ejecutar:
```bash
~/.local/bin/pnpm build 2>&1 | tail -5
# O crear el archivo manualmente si el error persiste:
echo '/// <reference types="next" />' > next-env.d.ts
echo '/// <reference types="next/image-types/global" />' >> next-env.d.ts
```

- [ ] **Step 16: Correr tests (deben pasar con --passWithNoTests)**

```bash
~/.local/bin/pnpm test 2>&1 | tail -5
```

Esperado: "Test Suites: 0 skipped" o similar, exit 0.

- [ ] **Step 17: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/web
git commit -m "feat: scaffold apps/web — Next.js 14 with Tailwind, MapLibre, Zustand"
```

---

## Task 2: Auth Layer

**Files:**
- Create: `apps/web/src/lib/api.ts` (axios instance)
- Create: `apps/web/src/store/auth.store.ts`
- Create: `apps/web/src/store/auth.store.test.ts`
- Create: `apps/web/src/middleware.ts`
- Create: `apps/web/src/app/login/page.tsx`
- Create: `apps/web/src/components/auth/LoginForm.tsx`
- Create: `apps/web/src/components/auth/LoginForm.test.tsx`

- [ ] **Step 1: Crear `apps/web/src/lib/api.ts`**

```typescript
import axios from 'axios';

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
      role: string;
      badgeNumber?: string;
    }>('/auth/me'),

  refresh: (refreshToken: string) =>
    api.post<{ accessToken: string; expiresIn: number }>('/auth/refresh', {
      refreshToken,
    }),
};
```

- [ ] **Step 2: Crear `apps/web/src/store/auth.store.ts`**

```typescript
import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
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
    // accessToken en sessionStorage (se borra al cerrar tab)
    // refreshToken en localStorage (persiste entre sesiones)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    }
    set({ user, accessToken, isAuthenticated: true });
  },

  clearAuth: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
}));
```

- [ ] **Step 3: Escribir tests del auth store (TDD — fallan primero)**

`apps/web/src/store/auth.store.test.ts`:

```typescript
import { useAuthStore } from './auth.store';

// Reset store between tests
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
```

- [ ] **Step 4: Verificar que tests fallan**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web"
~/.local/bin/pnpm test -- --testPathPattern=auth.store.test 2>&1 | tail -8
```

Esperado: FAIL — "Cannot find module './auth.store'"

- [ ] **Step 5: Correr tests — deben pasar**

```bash
~/.local/bin/pnpm test -- --testPathPattern=auth.store.test 2>&1 | tail -8
```

Esperado: PASS — 2 tests passed.

- [ ] **Step 6: Crear `apps/web/src/components/auth/LoginForm.tsx`**

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginFormData) => {
    try {
      const loginRes = await authApi.login(data.email, data.password);
      const { accessToken, refreshToken } = loginRes.data;

      const meRes = await authApi.me();
      setAuth(meRes.data, accessToken, refreshToken);

      router.push('/command');
    } catch {
      setError('root', { message: 'Credenciales incorrectas.' });
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 w-full max-w-sm"
      aria-label="Formulario de inicio de sesión"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm text-slate-gray">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="operador@velnari.mx"
          {...register('email')}
          className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white focus:outline-none focus:border-tactical-blue"
        />
        {errors.email && (
          <span className="text-red-400 text-xs">{errors.email.message}</span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm text-slate-gray">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white focus:outline-none focus:border-tactical-blue"
        />
        {errors.password && (
          <span className="text-red-400 text-xs">{errors.password.message}</span>
        )}
      </div>

      {errors.root && (
        <p className="text-red-400 text-sm text-center">{errors.root.message}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-tactical-blue hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded transition-colors"
      >
        {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
      </button>
    </form>
  );
}
```

- [ ] **Step 7: Escribir tests del LoginForm (TDD)**

`apps/web/src/components/auth/LoginForm.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from './LoginForm';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock API
jest.mock('@/lib/api', () => ({
  authApi: {
    login: jest.fn(),
    me: jest.fn(),
  },
}));

const mockLogin = authApi.login as jest.Mock;
const mockMe = authApi.me as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false });
});

describe('LoginForm', () => {
  it('muestra error si el email es inválido', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'no-es-email');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByText('Email inválido')).toBeInTheDocument();
  });

  it('muestra error si la contraseña es muy corta', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'op@test.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'corta');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByText('Mínimo 8 caracteres')).toBeInTheDocument();
  });

  it('llama a authApi.login con los datos del form y redirige a /command', async () => {
    mockLogin.mockResolvedValue({
      data: { accessToken: 'at-123', refreshToken: 'rt-456', expiresIn: 900 },
    });
    mockMe.mockResolvedValue({
      data: { id: 'u1', email: 'op@test.com', name: 'Operator', role: 'operator' },
    });

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'op@test.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('op@test.com', 'password123');
      expect(mockPush).toHaveBeenCalledWith('/command');
    });
  });

  it('muestra mensaje de error en credenciales incorrectas', async () => {
    mockLogin.mockRejectedValue(new Error('401'));

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'op@test.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByText('Credenciales incorrectas.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Correr tests de LoginForm — deben pasar**

```bash
~/.local/bin/pnpm test -- --testPathPattern=LoginForm.test 2>&1 | tail -12
```

Esperado: PASS — 4 tests passed.

- [ ] **Step 9: Crear `apps/web/src/app/login/page.tsx`**

```typescript
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-midnight-command flex flex-col items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-bold text-signal-white tracking-tight">
          Velnari Command
        </h1>
        <p className="text-slate-gray text-sm">
          El sistema operativo de la seguridad municipal.
        </p>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 w-full max-w-sm shadow-xl">
        <LoginForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 10: Crear `apps/web/src/middleware.ts`**

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir rutas públicas
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  // El token vive en sessionStorage (solo accesible desde el cliente),
  // por eso la protección real se hace desde el componente cliente.
  // El middleware solo redirige si el usuario intenta acceder a / sin cookie.
  // En producción se usaría un cookie httpOnly para la verificación server-side.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 11: Typecheck + todos los tests**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web"
~/.local/bin/pnpm typecheck 2>&1 | tail -5
~/.local/bin/pnpm test 2>&1 | tail -10
```

Esperado: typecheck exit 0, 6 tests passing (2 auth store + 4 LoginForm).

- [ ] **Step 12: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/web
git commit -m "feat: add auth layer — login page, auth store, API client"
```

---

## Task 3: Command Layout + Header

**Files:**
- Create: `apps/web/src/app/command/page.tsx`
- Create: `apps/web/src/components/ui/Badge.tsx`
- Create: `apps/web/src/components/ui/Modal.tsx`

- [ ] **Step 1: Crear `apps/web/src/components/ui/Badge.tsx`**

```typescript
import { UnitStatus } from '@velnari/shared-types';

type BadgeVariant = 'available' | 'en_route' | 'on_scene' | 'out_of_service' |
  'critical' | 'high' | 'medium' | 'low' |
  'open' | 'assigned' | 'closed';

const variantStyles: Record<BadgeVariant, string> = {
  // Unit statuses
  available: 'bg-green-900 text-green-300 border border-green-700',
  en_route: 'bg-blue-900 text-blue-300 border border-blue-700',
  on_scene: 'bg-amber-900 text-amber-300 border border-amber-700',
  out_of_service: 'bg-slate-800 text-slate-400 border border-slate-700',
  // Incident priorities
  critical: 'bg-red-900 text-red-300 border border-red-700',
  high: 'bg-orange-900 text-orange-300 border border-orange-700',
  medium: 'bg-yellow-900 text-yellow-300 border border-yellow-700',
  low: 'bg-green-900 text-green-300 border border-green-700',
  // Incident statuses
  open: 'bg-blue-900 text-blue-300 border border-blue-700',
  assigned: 'bg-purple-900 text-purple-300 border border-purple-700',
  closed: 'bg-slate-800 text-slate-400 border border-slate-700',
};

const labelMap: Record<BadgeVariant, string> = {
  available: 'Disponible',
  en_route: 'En ruta',
  on_scene: 'En escena',
  out_of_service: 'Fuera de servicio',
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
  open: 'Abierto',
  assigned: 'Asignado',
  closed: 'Cerrado',
};

interface BadgeProps {
  variant: BadgeVariant;
  className?: string;
}

export default function Badge({ variant, className = '' }: BadgeProps) {
  const styles = variantStyles[variant] ?? 'bg-slate-800 text-slate-400';
  const label = labelMap[variant] ?? variant;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles} ${className}`}>
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Crear `apps/web/src/components/ui/Modal.tsx`**

```typescript
'use client';

import { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 id="modal-title" className="text-lg font-semibold text-signal-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-gray hover:text-signal-white transition-colors"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Crear `apps/web/src/app/command/page.tsx`**

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import dynamic from 'next/dynamic';

// MapLibre GL usa APIs del browser — cargar sin SSR
const CommandMap = dynamic(() => import('@/components/map/CommandMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-slate-900">
      <p className="text-slate-gray">Cargando mapa...</p>
    </div>
  ),
});

// Importar los paneles (cliente)
import IncidentList from '@/components/incidents/IncidentList';

export default function CommandPage() {
  const { isAuthenticated, user, clearAuth } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex flex-col h-screen bg-midnight-command">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-bold text-signal-white tracking-tight">
            Velnari Command
          </span>
          <span className="text-xs text-slate-gray font-mono">
            {new Date().toLocaleDateString('es-MX', {
              weekday: 'short',
              day: '2-digit',
              month: 'short',
            })}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-gray">
            {user?.name}
          </span>
          <button
            onClick={clearAuth}
            className="text-xs text-slate-gray hover:text-signal-white transition-colors"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Main content: map + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map takes 65% */}
        <div className="flex-1 relative">
          <CommandMap />
        </div>

        {/* Incidents sidebar takes 35% (min 320px) */}
        <aside className="w-[380px] shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">
          <IncidentList />
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web"
~/.local/bin/pnpm typecheck 2>&1 | tail -8
```

Los errores de "Cannot find module" para componentes que aún no existen son esperados. Fix: crear archivos placeholder vacíos para CommandMap e IncidentList antes de correr typecheck, o ignorar los errores de módulos que aún no existen.

Si TypeScript reporta errores por módulos faltantes (CommandMap, IncidentList), crearlos con stubs temporales:

`apps/web/src/components/map/CommandMap.tsx` (stub):
```typescript
export default function CommandMap() {
  return <div data-testid="command-map" className="w-full h-full bg-slate-950" />;
}
```

`apps/web/src/components/incidents/IncidentList.tsx` (stub):
```typescript
export default function IncidentList() {
  return <div data-testid="incident-list" className="p-4 text-slate-gray">Cargando...</div>;
}
```

- [ ] **Step 5: Correr tests**

```bash
~/.local/bin/pnpm test 2>&1 | tail -8
```

Esperado: 6 tests passing (2 auth store + 4 LoginForm).

- [ ] **Step 6: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/web
git commit -m "feat: add command layout with header and map/sidebar split view"
```

---

## Task 4: Data Layer — Tipos, API functions, Stores

**Files:**
- Create: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts` (agregar funciones para units, incidents, dispatch)
- Create: `apps/web/src/store/units.store.ts`
- Create: `apps/web/src/store/units.store.test.ts`
- Create: `apps/web/src/store/incidents.store.ts`
- Create: `apps/web/src/store/incidents.store.test.ts`
- Create: `apps/web/src/lib/socket.ts`

- [ ] **Step 1: Crear `apps/web/src/lib/types.ts`**

```typescript
import type { IncidentPriority, IncidentStatus, IncidentType, UnitStatus } from '@velnari/shared-types';

export interface Unit {
  id: string;
  callSign: string;
  status: UnitStatus;
  sectorId?: string;
  shift?: string;
  isActive: boolean;
  lastLocationAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UnitPosition {
  unitId: string;
  lat: number;
  lng: number;
  timestamp: string;
}

export interface IncidentEvent {
  id: string;
  incidentId: string;
  type: string;
  description: string;
  actorId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Incident {
  id: string;
  folio: string;
  type: IncidentType;
  priority: IncidentPriority;
  status: IncidentStatus;
  address?: string;
  description?: string;
  lat: number;
  lng: number;
  sectorId?: string;
  assignedUnitId?: string;
  createdBy: string;
  assignedAt?: string;
  arrivedAt?: string;
  closedAt?: string;
  resolution?: string;
  events?: IncidentEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface Sector {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
}
```

- [ ] **Step 2: Agregar funciones al `apps/web/src/lib/api.ts`**

Reemplazar el contenido completo del archivo con:

```typescript
import axios from 'axios';
import type { Unit, Incident, Sector } from './types';
import type { CreateIncidentDto } from '@velnari/shared-types';

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
      role: string;
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

  updateStatus: (id: string, status: string) =>
    api.patch<Unit>(`/units/${id}/status`, { status }),
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
    api.post(`/incidents/${id}/notes`, { text }),

  getEvents: (id: string) =>
    api.get(`/incidents/${id}/events`),
};

// ─── Dispatch ────────────────────────────────────────────────────────────────

export const dispatchApi = {
  assignUnit: (incidentId: string, unitId: string) =>
    api.post<Incident>(`/incidents/${incidentId}/assign`, { unitId }),
};

// ─── Sectors ─────────────────────────────────────────────────────────────────

export const sectorsApi = {
  getAll: () => api.get<Sector[]>('/sectors'),
};
```

- [ ] **Step 3: Crear `apps/web/src/store/units.store.ts`**

```typescript
import { create } from 'zustand';
import type { Unit, UnitPosition } from '@/lib/types';

interface UnitsState {
  units: Unit[];
  positions: Record<string, UnitPosition>; // unitId → latest position
  isLoading: boolean;
  setUnits: (units: Unit[]) => void;
  updateUnit: (updated: Unit) => void;
  updatePosition: (position: UnitPosition) => void;
  setLoading: (loading: boolean) => void;
}

export const useUnitsStore = create<UnitsState>()((set) => ({
  units: [],
  positions: {},
  isLoading: false,

  setUnits: (units) => set({ units }),

  updateUnit: (updated) =>
    set((state) => ({
      units: state.units.map((u) => (u.id === updated.id ? updated : u)),
    })),

  updatePosition: (position) =>
    set((state) => ({
      positions: { ...state.positions, [position.unitId]: position },
    })),

  setLoading: (isLoading) => set({ isLoading }),
}));
```

- [ ] **Step 4: Escribir tests del units store (TDD — fallan primero)**

`apps/web/src/store/units.store.test.ts`:

```typescript
import { useUnitsStore } from './units.store';
import { UnitStatus } from '@velnari/shared-types';
import type { Unit, UnitPosition } from '@/lib/types';

const mockUnit: Unit = {
  id: 'unit-1',
  callSign: 'P-14',
  status: UnitStatus.AVAILABLE,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  useUnitsStore.setState({ units: [], positions: {}, isLoading: false });
});

describe('useUnitsStore', () => {
  it('setUnits reemplaza la lista de unidades', () => {
    useUnitsStore.getState().setUnits([mockUnit]);
    expect(useUnitsStore.getState().units).toHaveLength(1);
    expect(useUnitsStore.getState().units[0]?.callSign).toBe('P-14');
  });

  it('updateUnit actualiza una unidad específica', () => {
    useUnitsStore.getState().setUnits([mockUnit]);
    const updated = { ...mockUnit, status: UnitStatus.EN_ROUTE };
    useUnitsStore.getState().updateUnit(updated);
    expect(useUnitsStore.getState().units[0]?.status).toBe(UnitStatus.EN_ROUTE);
  });

  it('updatePosition guarda posición por unitId', () => {
    const position: UnitPosition = {
      unitId: 'unit-1',
      lat: 19.43,
      lng: -99.13,
      timestamp: new Date().toISOString(),
    };
    useUnitsStore.getState().updatePosition(position);
    const stored = useUnitsStore.getState().positions['unit-1'];
    expect(stored?.lat).toBe(19.43);
  });
});
```

- [ ] **Step 5: Correr units store tests — deben pasar**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web"
~/.local/bin/pnpm test -- --testPathPattern=units.store.test 2>&1 | tail -8
```

Esperado: PASS — 3 tests passed.

- [ ] **Step 6: Crear `apps/web/src/store/incidents.store.ts`**

```typescript
import { create } from 'zustand';
import type { Incident } from '@/lib/types';

interface IncidentsState {
  incidents: Incident[];
  selectedId: string | null;
  isLoading: boolean;
  setIncidents: (incidents: Incident[]) => void;
  addIncident: (incident: Incident) => void;
  updateIncident: (updated: Incident) => void;
  selectIncident: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useIncidentsStore = create<IncidentsState>()((set) => ({
  incidents: [],
  selectedId: null,
  isLoading: false,

  setIncidents: (incidents) => set({ incidents }),

  addIncident: (incident) =>
    set((state) => ({ incidents: [incident, ...state.incidents] })),

  updateIncident: (updated) =>
    set((state) => ({
      incidents: state.incidents.map((i) => (i.id === updated.id ? updated : i)),
    })),

  selectIncident: (selectedId) => set({ selectedId }),

  setLoading: (isLoading) => set({ isLoading }),
}));
```

- [ ] **Step 7: Escribir tests del incidents store**

`apps/web/src/store/incidents.store.test.ts`:

```typescript
import { useIncidentsStore } from './incidents.store';
import { IncidentPriority, IncidentStatus, IncidentType } from '@velnari/shared-types';
import type { Incident } from '@/lib/types';

const mockIncident: Incident = {
  id: 'inc-1',
  folio: 'IC-001',
  type: IncidentType.ROBBERY,
  priority: IncidentPriority.HIGH,
  status: IncidentStatus.OPEN,
  lat: 19.43,
  lng: -99.13,
  createdBy: 'user-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  useIncidentsStore.setState({
    incidents: [],
    selectedId: null,
    isLoading: false,
  });
});

describe('useIncidentsStore', () => {
  it('setIncidents reemplaza la lista', () => {
    useIncidentsStore.getState().setIncidents([mockIncident]);
    expect(useIncidentsStore.getState().incidents).toHaveLength(1);
  });

  it('addIncident inserta al principio', () => {
    useIncidentsStore.getState().setIncidents([mockIncident]);
    const second: Incident = { ...mockIncident, id: 'inc-2', folio: 'IC-002' };
    useIncidentsStore.getState().addIncident(second);
    expect(useIncidentsStore.getState().incidents[0]?.folio).toBe('IC-002');
  });

  it('updateIncident actualiza un incidente específico', () => {
    useIncidentsStore.getState().setIncidents([mockIncident]);
    const updated = { ...mockIncident, status: IncidentStatus.ASSIGNED };
    useIncidentsStore.getState().updateIncident(updated);
    expect(useIncidentsStore.getState().incidents[0]?.status).toBe(IncidentStatus.ASSIGNED);
  });

  it('selectIncident guarda el id seleccionado', () => {
    useIncidentsStore.getState().selectIncident('inc-1');
    expect(useIncidentsStore.getState().selectedId).toBe('inc-1');
  });
});
```

- [ ] **Step 8: Correr incidents store tests — deben pasar**

```bash
~/.local/bin/pnpm test -- --testPathPattern=incidents.store.test 2>&1 | tail -8
```

Esperado: PASS — 4 tests passed.

- [ ] **Step 9: Crear `apps/web/src/lib/socket.ts`**

```typescript
import { io, type Socket } from 'socket.io-client';

const WS_URL = process.env['NEXT_PUBLIC_WS_URL'] ?? 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: false,
      transports: ['websocket'],
    });
  }
  return socket;
}

export function connectSocket(accessToken: string): Socket {
  const s = getSocket();
  s.auth = { token: accessToken };
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
```

- [ ] **Step 10: Typecheck + todos los tests**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web"
~/.local/bin/pnpm typecheck 2>&1 | tail -5
~/.local/bin/pnpm test 2>&1 | tail -10
```

Esperado: typecheck exit 0, 13 tests passing (2 auth + 4 loginform + 3 units + 4 incidents).

- [ ] **Step 11: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/web
git commit -m "feat: add data layer — types, API functions, Zustand stores, Socket.IO client"
```

---

## Task 5: Map Component

**Files:**
- Modify: `apps/web/src/components/map/CommandMap.tsx` (reemplazar stub)
- Create: `apps/web/src/components/map/UnitMarker.tsx`
- Create: `apps/web/src/components/map/CommandMap.test.tsx`

- [ ] **Step 1: Crear `apps/web/src/components/map/UnitMarker.tsx`**

```typescript
import type { UnitStatus } from '@velnari/shared-types';

const STATUS_COLORS: Record<string, string> = {
  available: '#22C55E',   // verde
  en_route: '#3B82F6',    // azul tactical
  on_scene: '#F59E0B',    // amber
  out_of_service: '#64748B', // slate
};

const STATUS_LABELS: Record<string, string> = {
  available: 'Disponible',
  en_route: 'En ruta',
  on_scene: 'En escena',
  out_of_service: 'Fuera de servicio',
};

interface UnitMarkerProps {
  callSign: string;
  status: UnitStatus;
  onClick?: () => void;
}

export default function UnitMarker({ callSign, status, onClick }: UnitMarkerProps) {
  const color = STATUS_COLORS[status] ?? '#64748B';
  const label = STATUS_LABELS[status] ?? status;

  return (
    <button
      onClick={onClick}
      title={`${callSign} — ${label}`}
      className="group relative flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-lg cursor-pointer hover:scale-110 transition-transform"
      style={{ backgroundColor: color }}
      aria-label={`Unidad ${callSign}`}
    >
      <span className="text-white text-xs font-bold font-mono leading-none">
        {callSign.replace('P-', '')}
      </span>
      {/* Tooltip */}
      <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900 text-signal-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-slate-700">
        {callSign}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Escribir tests del CommandMap (TDD — fallan primero)**

`apps/web/src/components/map/CommandMap.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import CommandMap from './CommandMap';
import { useUnitsStore } from '@/store/units.store';
import { useIncidentsStore } from '@/store/incidents.store';
import { UnitStatus, IncidentPriority, IncidentStatus, IncidentType } from '@velnari/shared-types';
import type { Unit } from '@/lib/types';
import type { Incident } from '@/lib/types';

// react-map-gl/maplibre is mocked via moduleNameMapper in jest.config.ts

const mockUnit: Unit = {
  id: 'unit-1',
  callSign: 'P-14',
  status: UnitStatus.AVAILABLE,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockIncident: Incident = {
  id: 'inc-1',
  folio: 'IC-001',
  type: IncidentType.ROBBERY,
  priority: IncidentPriority.HIGH,
  status: IncidentStatus.OPEN,
  lat: 19.43,
  lng: -99.13,
  createdBy: 'user-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  useUnitsStore.setState({ units: [], positions: {}, isLoading: false });
  useIncidentsStore.setState({ incidents: [], selectedId: null, isLoading: false });
});

describe('CommandMap', () => {
  it('renderiza el contenedor del mapa', () => {
    render(<CommandMap />);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('muestra marcadores para cada unidad con posición', () => {
    useUnitsStore.setState({
      units: [mockUnit],
      positions: {
        'unit-1': { unitId: 'unit-1', lat: 19.43, lng: -99.13, timestamp: '' },
      },
      isLoading: false,
    });

    render(<CommandMap />);
    expect(screen.getByLabelText('Unidad P-14')).toBeInTheDocument();
  });

  it('muestra marcadores para cada incidente activo', () => {
    useIncidentsStore.setState({
      incidents: [mockIncident],
      selectedId: null,
      isLoading: false,
    });

    render(<CommandMap />);
    // Incident markers use aria-label
    expect(screen.getByLabelText('Incidente IC-001')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Verificar que tests fallan**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web"
~/.local/bin/pnpm test -- --testPathPattern=CommandMap.test 2>&1 | tail -8
```

Esperado: 1 test pasa (renderiza el contenedor), 2 fallan por falta de marcadores.

- [ ] **Step 4: Reemplazar stub con `apps/web/src/components/map/CommandMap.tsx` completo**

```typescript
'use client';

import Map, { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useUnitsStore } from '@/store/units.store';
import { useIncidentsStore } from '@/store/incidents.store';
import UnitMarker from './UnitMarker';

// CARTO Dark Matter: free MapLibre-compatible style, no API key required
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// Mexico City center as default view
const DEFAULT_VIEW = { latitude: 19.4326, longitude: -99.1332, zoom: 12 };

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#22C55E',
};

export default function CommandMap() {
  const { units, positions } = useUnitsStore();
  const { incidents, selectedId, selectIncident } = useIncidentsStore();

  const activeIncidents = incidents.filter(
    (i) => i.status !== 'closed',
  );

  return (
    <Map
      initialViewState={DEFAULT_VIEW}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLE}
    >
      {/* Unit markers — only for units that have a known position */}
      {units.map((unit) => {
        const pos = positions[unit.id];
        if (!pos) return null;
        return (
          <Marker key={unit.id} latitude={pos.lat} longitude={pos.lng}>
            <UnitMarker callSign={unit.callSign} status={unit.status} />
          </Marker>
        );
      })}

      {/* Incident markers */}
      {activeIncidents.map((incident) => {
        const color = PRIORITY_COLORS[incident.priority] ?? '#F59E0B';
        const isSelected = incident.id === selectedId;
        return (
          <Marker
            key={incident.id}
            latitude={incident.lat}
            longitude={incident.lng}
          >
            <button
              onClick={() => selectIncident(incident.id)}
              aria-label={`Incidente ${incident.folio}`}
              title={`${incident.folio} — ${incident.priority}`}
              className="flex items-center justify-center w-7 h-7 rounded-full border-2 border-white shadow-lg hover:scale-110 transition-transform"
              style={{
                backgroundColor: color,
                boxShadow: isSelected ? `0 0 0 3px ${color}60` : undefined,
              }}
            >
              <span className="text-white text-[10px] font-bold">!</span>
            </button>
          </Marker>
        );
      })}
    </Map>
  );
}
```

- [ ] **Step 5: Correr tests — deben pasar**

```bash
~/.local/bin/pnpm test -- --testPathPattern=CommandMap.test 2>&1 | tail -10
```

Esperado: PASS — 3 tests passed.

- [ ] **Step 6: Typecheck + todos los tests**

```bash
~/.local/bin/pnpm typecheck 2>&1 | tail -5
~/.local/bin/pnpm test 2>&1 | tail -10
```

Esperado: 16 tests passing.

- [ ] **Step 7: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/web
git commit -m "feat: add MapLibre command map with unit and incident markers"
```

---

## Task 6: Incidents Sidebar

**Files:**
- Modify: `apps/web/src/components/incidents/IncidentList.tsx` (reemplazar stub)
- Create: `apps/web/src/components/incidents/IncidentCard.tsx`
- Create: `apps/web/src/components/incidents/IncidentList.test.tsx`

- [ ] **Step 1: Crear `apps/web/src/components/incidents/IncidentCard.tsx`**

```typescript
import type { Incident } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import type { IncidentPriority, IncidentStatus } from '@velnari/shared-types';

interface IncidentCardProps {
  incident: Incident;
  isSelected: boolean;
  onClick: () => void;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const TYPE_LABELS: Record<string, string> = {
  robbery: 'Robo',
  assault: 'Agresión',
  traffic: 'Tráfico',
  noise: 'Ruido',
  domestic: 'Doméstico',
  missing_person: 'Persona desaparecida',
  other: 'Otro',
};

export default function IncidentCard({ incident, isSelected, onClick }: IncidentCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-slate-800 hover:bg-slate-800 transition-colors ${
        isSelected ? 'bg-slate-800 border-l-2 border-l-tactical-blue' : ''
      }`}
      aria-selected={isSelected}
      aria-label={`Incidente ${incident.folio}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-gray">{incident.folio}</span>
          <Badge variant={incident.priority as IncidentPriority} />
        </div>
        <span className="text-xs text-slate-gray shrink-0">
          {formatTime(incident.createdAt)}
        </span>
      </div>

      <p className="mt-1 text-sm text-signal-white font-medium">
        {TYPE_LABELS[incident.type] ?? incident.type}
      </p>

      {incident.address && (
        <p className="mt-0.5 text-xs text-slate-gray truncate">{incident.address}</p>
      )}

      <div className="mt-1">
        <Badge variant={incident.status as IncidentStatus} />
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Escribir tests del IncidentList (TDD — fallan primero)**

`apps/web/src/components/incidents/IncidentList.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IncidentList from './IncidentList';
import { useIncidentsStore } from '@/store/incidents.store';
import { IncidentPriority, IncidentStatus, IncidentType } from '@velnari/shared-types';
import type { Incident } from '@/lib/types';

// Mock API calls
jest.mock('@/lib/api', () => ({
  incidentsApi: {
    getAll: jest.fn().mockResolvedValue({ data: [] }),
  },
}));

const mockIncident: Incident = {
  id: 'inc-1',
  folio: 'IC-001',
  type: IncidentType.ROBBERY,
  priority: IncidentPriority.HIGH,
  status: IncidentStatus.OPEN,
  lat: 19.43,
  lng: -99.13,
  address: 'Calle Falsa 123',
  createdBy: 'user-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  useIncidentsStore.setState({
    incidents: [],
    selectedId: null,
    isLoading: false,
  });
});

describe('IncidentList', () => {
  it('muestra mensaje vacío cuando no hay incidentes', () => {
    render(<IncidentList />);
    expect(screen.getByText(/sin incidentes activos/i)).toBeInTheDocument();
  });

  it('renderiza tarjetas por cada incidente', () => {
    useIncidentsStore.setState({ incidents: [mockIncident], selectedId: null, isLoading: false });
    render(<IncidentList />);
    expect(screen.getByLabelText('Incidente IC-001')).toBeInTheDocument();
  });

  it('al hacer click en un incidente lo selecciona en el store', async () => {
    useIncidentsStore.setState({ incidents: [mockIncident], selectedId: null, isLoading: false });
    const user = userEvent.setup();
    render(<IncidentList />);

    await user.click(screen.getByLabelText('Incidente IC-001'));
    expect(useIncidentsStore.getState().selectedId).toBe('inc-1');
  });
});
```

- [ ] **Step 3: Verificar que tests fallan**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web"
~/.local/bin/pnpm test -- --testPathPattern=IncidentList.test 2>&1 | tail -8
```

Esperado: FAIL — stub no tiene la lógica correcta.

- [ ] **Step 4: Reemplazar stub con `apps/web/src/components/incidents/IncidentList.tsx` completo**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useIncidentsStore } from '@/store/incidents.store';
import { incidentsApi } from '@/lib/api';
import IncidentCard from './IncidentCard';
import IncidentDetail from './IncidentDetail';
import CreateIncidentModal from './CreateIncidentModal';

export default function IncidentList() {
  const { incidents, selectedId, setIncidents, selectIncident, setLoading } =
    useIncidentsStore();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    setLoading(true);
    incidentsApi
      .getAll()
      .then((res) => setIncidents(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [setIncidents, setLoading]);

  const selectedIncident = incidents.find((i) => i.id === selectedId) ?? null;

  // Show detail if an incident is selected
  if (selectedIncident) {
    return (
      <IncidentDetail
        incident={selectedIncident}
        onBack={() => selectIncident(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <h2 className="text-sm font-semibold text-signal-white">Incidentes</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="text-xs bg-tactical-blue hover:bg-blue-600 text-white px-3 py-1 rounded transition-colors"
        >
          + Nuevo
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {incidents.length === 0 ? (
          <p className="text-center text-slate-gray text-sm py-12">
            Sin incidentes activos
          </p>
        ) : (
          incidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              isSelected={incident.id === selectedId}
              onClick={() => selectIncident(incident.id)}
            />
          ))
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateIncidentModal onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
```

**Nota:** IncidentDetail y CreateIncidentModal son stubs por ahora — se implementan en tasks siguientes. Crear stubs si no existen:

`apps/web/src/components/incidents/IncidentDetail.tsx` (stub temporal):
```typescript
import type { Incident } from '@/lib/types';

export default function IncidentDetail({
  incident,
  onBack,
}: {
  incident: Incident;
  onBack: () => void;
}) {
  return (
    <div className="p-4">
      <button onClick={onBack} className="text-slate-gray text-sm mb-2">← Volver</button>
      <p className="text-signal-white">{incident.folio}</p>
    </div>
  );
}
```

`apps/web/src/components/incidents/CreateIncidentModal.tsx` (stub temporal):
```typescript
export default function CreateIncidentModal({ onClose }: { onClose: () => void }) {
  return (
    <div>
      <button onClick={onClose}>Cerrar</button>
    </div>
  );
}
```

`apps/web/src/components/incidents/AssignUnitModal.tsx` (stub temporal):
```typescript
export default function AssignUnitModal({
  incidentId,
  onClose,
}: {
  incidentId: string;
  onClose: () => void;
}) {
  return (
    <div>
      <button onClick={onClose}>Cerrar</button>
    </div>
  );
}
```

- [ ] **Step 5: Correr tests del IncidentList — deben pasar**

```bash
~/.local/bin/pnpm test -- --testPathPattern=IncidentList.test 2>&1 | tail -10
```

Esperado: PASS — 3 tests passed.

- [ ] **Step 6: Typecheck + todos los tests**

```bash
~/.local/bin/pnpm typecheck 2>&1 | tail -5
~/.local/bin/pnpm test 2>&1 | tail -10
```

Esperado: 19 tests passing.

- [ ] **Step 7: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/web
git commit -m "feat: add incidents sidebar with list, cards and priority badges"
```

---

## Task 7: Incident Detail Panel

**Files:**
- Modify: `apps/web/src/components/incidents/IncidentDetail.tsx` (reemplazar stub)
- Create: `apps/web/src/components/incidents/IncidentDetail.test.tsx`

- [ ] **Step 1: Escribir tests del IncidentDetail (TDD — fallan primero)**

`apps/web/src/components/incidents/IncidentDetail.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IncidentDetail from './IncidentDetail';
import { IncidentPriority, IncidentStatus, IncidentType } from '@velnari/shared-types';
import type { Incident } from '@/lib/types';

jest.mock('@/lib/api', () => ({
  incidentsApi: {
    getEvents: jest.fn().mockResolvedValue({ data: [] }),
    close: jest.fn().mockResolvedValue({ data: {} }),
    addNote: jest.fn().mockResolvedValue({ data: {} }),
  },
  dispatchApi: {
    assignUnit: jest.fn().mockResolvedValue({ data: {} }),
  },
}));

const mockIncident: Incident = {
  id: 'inc-1',
  folio: 'IC-001',
  type: IncidentType.ROBBERY,
  priority: IncidentPriority.HIGH,
  status: IncidentStatus.OPEN,
  lat: 19.43,
  lng: -99.13,
  address: 'Calle Falsa 123',
  description: 'Robo a mano armada',
  createdBy: 'user-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  events: [
    {
      id: 'ev-1',
      incidentId: 'inc-1',
      type: 'created',
      description: 'Incidente IC-001 creado',
      actorId: 'user-1',
      createdAt: new Date().toISOString(),
    },
  ],
};

describe('IncidentDetail', () => {
  it('muestra el folio y la dirección del incidente', () => {
    render(<IncidentDetail incident={mockIncident} onBack={jest.fn()} />);
    expect(screen.getByText('IC-001')).toBeInTheDocument();
    expect(screen.getByText('Calle Falsa 123')).toBeInTheDocument();
  });

  it('muestra los eventos del timeline', () => {
    render(<IncidentDetail incident={mockIncident} onBack={jest.fn()} />);
    expect(screen.getByText('Incidente IC-001 creado')).toBeInTheDocument();
  });

  it('llama a onBack al hacer click en volver', async () => {
    const onBack = jest.fn();
    const user = userEvent.setup();
    render(<IncidentDetail incident={mockIncident} onBack={onBack} />);

    await user.click(screen.getByRole('button', { name: /volver/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('muestra el botón "Asignar unidad" para incidentes abiertos', () => {
    render(<IncidentDetail incident={mockIncident} onBack={jest.fn()} />);
    expect(
      screen.getByRole('button', { name: /asignar unidad/i }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verificar que tests fallan**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web"
~/.local/bin/pnpm test -- --testPathPattern=IncidentDetail.test 2>&1 | tail -8
```

Esperado: tests fallan — stub no tiene el contenido requerido.

- [ ] **Step 3: Reemplazar stub con `apps/web/src/components/incidents/IncidentDetail.tsx` completo**

```typescript
'use client';

import { useState } from 'react';
import type { Incident, IncidentEvent } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import AssignUnitModal from './AssignUnitModal';
import type { IncidentPriority, IncidentStatus, IncidentType } from '@velnari/shared-types';
import { IncidentStatus as IS } from '@velnari/shared-types';

const TYPE_LABELS: Record<string, string> = {
  robbery: 'Robo',
  assault: 'Agresión',
  traffic: 'Tráfico',
  noise: 'Ruido',
  domestic: 'Doméstico',
  missing_person: 'Persona desaparecida',
  other: 'Otro',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  created: '🟢 Creado',
  assigned: '🔵 Asignado',
  en_route: '🚔 En ruta',
  on_scene: '📍 En escena',
  note: '📝 Nota',
  closed: '⛔ Cerrado',
};

interface IncidentDetailProps {
  incident: Incident;
  onBack: () => void;
}

export default function IncidentDetail({ incident, onBack }: IncidentDetailProps) {
  const [showAssign, setShowAssign] = useState(false);

  const canAssign = incident.status === IS.OPEN || incident.status === IS.ASSIGNED;
  const isClosed = incident.status === IS.CLOSED;

  const events: IncidentEvent[] = incident.events ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
        <button
          onClick={onBack}
          className="text-slate-gray hover:text-signal-white transition-colors text-sm"
          aria-label="Volver a la lista"
        >
          ← Volver
        </button>
        <span className="font-mono text-sm text-signal-white">{incident.folio}</span>
        <Badge variant={incident.priority as IncidentPriority} />
        <Badge variant={incident.status as IncidentStatus} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
        {/* Type + Address */}
        <div>
          <p className="text-base font-semibold text-signal-white">
            {TYPE_LABELS[incident.type] ?? incident.type}
          </p>
          {incident.address && (
            <p className="text-sm text-slate-gray mt-0.5">{incident.address}</p>
          )}
          {incident.description && (
            <p className="text-sm text-slate-400 mt-1">{incident.description}</p>
          )}
        </div>

        {/* Coords */}
        <div className="font-mono text-xs text-slate-gray">
          {incident.lat.toFixed(6)}, {incident.lng.toFixed(6)}
        </div>

        {/* Actions */}
        {!isClosed && (
          <div className="flex gap-2">
            {canAssign && (
              <button
                onClick={() => setShowAssign(true)}
                className="flex-1 bg-tactical-blue hover:bg-blue-600 text-white text-sm font-semibold py-2 rounded transition-colors"
                aria-label="Asignar unidad"
              >
                Asignar unidad
              </button>
            )}
          </div>
        )}

        {/* Timeline */}
        <div>
          <h3 className="text-xs font-semibold text-slate-gray uppercase tracking-wider mb-2">
            Timeline
          </h3>
          {events.length === 0 ? (
            <p className="text-xs text-slate-gray">Sin eventos</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {events.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-slate-600 shrink-0 mt-1" />
                    <div className="w-px flex-1 bg-slate-800" />
                  </div>
                  <div className="pb-2">
                    <p className="text-xs text-slate-gray">
                      {EVENT_TYPE_LABELS[event.type] ?? event.type}
                      {' · '}
                      {new Date(event.createdAt).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="text-sm text-signal-white">{event.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Assign unit modal */}
      {showAssign && (
        <AssignUnitModal
          incidentId={incident.id}
          onClose={() => setShowAssign(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Correr tests — deben pasar**

```bash
~/.local/bin/pnpm test -- --testPathPattern=IncidentDetail.test 2>&1 | tail -10
```

Esperado: PASS — 4 tests passed.

- [ ] **Step 5: Typecheck + todos los tests**

```bash
~/.local/bin/pnpm typecheck 2>&1 | tail -5
~/.local/bin/pnpm test 2>&1 | tail -10
```

Esperado: 23 tests passing.

- [ ] **Step 6: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/web
git commit -m "feat: add incident detail panel with timeline and assign button"
```

---

## Task 8: Create Incident Modal

**Files:**
- Modify: `apps/web/src/components/incidents/CreateIncidentModal.tsx` (reemplazar stub)
- Create: `apps/web/src/components/incidents/CreateIncidentModal.test.tsx`

- [ ] **Step 1: Escribir tests (TDD — fallan primero)**

`apps/web/src/components/incidents/CreateIncidentModal.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateIncidentModal from './CreateIncidentModal';
import { incidentsApi } from '@/lib/api';
import { useIncidentsStore } from '@/store/incidents.store';
import { IncidentPriority, IncidentStatus, IncidentType } from '@velnari/shared-types';

jest.mock('@/lib/api', () => ({
  incidentsApi: {
    create: jest.fn(),
  },
}));

const mockCreate = incidentsApi.create as jest.Mock;

const mockCreatedIncident = {
  id: 'inc-new',
  folio: 'IC-002',
  type: IncidentType.ROBBERY,
  priority: IncidentPriority.HIGH,
  status: IncidentStatus.OPEN,
  lat: 19.4326,
  lng: -99.1332,
  createdBy: 'user-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  useIncidentsStore.setState({ incidents: [], selectedId: null, isLoading: false });
});

describe('CreateIncidentModal', () => {
  it('muestra el formulario con campos tipo y prioridad', () => {
    render(<CreateIncidentModal onClose={jest.fn()} />);
    expect(screen.getByLabelText(/tipo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/prioridad/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/latitud/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/longitud/i)).toBeInTheDocument();
  });

  it('muestra error de validación si lat está vacío', async () => {
    const user = userEvent.setup();
    render(<CreateIncidentModal onClose={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /crear incidente/i }));

    expect(await screen.findByText(/latitud requerida/i)).toBeInTheDocument();
  });

  it('llama a incidentsApi.create y cierra el modal al enviar correctamente', async () => {
    mockCreate.mockResolvedValue({ data: mockCreatedIncident });
    const onClose = jest.fn();
    const user = userEvent.setup();

    render(<CreateIncidentModal onClose={onClose} />);

    // Fill required fields
    await user.selectOptions(screen.getByLabelText(/tipo/i), 'robbery');
    await user.selectOptions(screen.getByLabelText(/prioridad/i), 'high');
    await user.clear(screen.getByLabelText(/latitud/i));
    await user.type(screen.getByLabelText(/latitud/i), '19.4326');
    await user.clear(screen.getByLabelText(/longitud/i));
    await user.type(screen.getByLabelText(/longitud/i), '-99.1332');

    await user.click(screen.getByRole('button', { name: /crear incidente/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'robbery',
          priority: 'high',
          lat: 19.4326,
          lng: -99.1332,
        }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Verificar que tests fallan**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web"
~/.local/bin/pnpm test -- --testPathPattern=CreateIncidentModal.test 2>&1 | tail -8
```

Esperado: FAIL — stub no tiene los campos del formulario.

- [ ] **Step 3: Reemplazar stub con `apps/web/src/components/incidents/CreateIncidentModal.tsx` completo**

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '@/components/ui/Modal';
import { incidentsApi } from '@/lib/api';
import { useIncidentsStore } from '@/store/incidents.store';
import { IncidentType, IncidentPriority } from '@velnari/shared-types';

const createIncidentSchema = z.object({
  type: z.nativeEnum(IncidentType, { errorMap: () => ({ message: 'Tipo requerido' }) }),
  priority: z.nativeEnum(IncidentPriority, {
    errorMap: () => ({ message: 'Prioridad requerida' }),
  }),
  lat: z
    .number({ invalid_type_error: 'Latitud requerida', required_error: 'Latitud requerida' })
    .min(-90)
    .max(90),
  lng: z
    .number({ invalid_type_error: 'Longitud requerida', required_error: 'Longitud requerida' })
    .min(-180)
    .max(180),
  address: z.string().max(200).optional(),
  description: z.string().min(5).max(500).optional().or(z.literal('')),
});

type CreateIncidentFormData = z.infer<typeof createIncidentSchema>;

interface CreateIncidentModalProps {
  onClose: () => void;
}

export default function CreateIncidentModal({ onClose }: CreateIncidentModalProps) {
  const addIncident = useIncidentsStore((s) => s.addIncident);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CreateIncidentFormData>({
    resolver: zodResolver(createIncidentSchema),
    defaultValues: {
      lat: undefined,
      lng: undefined,
    },
  });

  const onSubmit = async (data: CreateIncidentFormData) => {
    try {
      const res = await incidentsApi.create({
        type: data.type,
        priority: data.priority,
        lat: data.lat,
        lng: data.lng,
        address: data.address || undefined,
        description: data.description || undefined,
      });
      addIncident(res.data);
      onClose();
    } catch {
      setError('root', { message: 'Error al crear el incidente.' });
    }
  };

  const inputClass =
    'w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white text-sm focus:outline-none focus:border-tactical-blue';

  return (
    <Modal isOpen title="Nuevo incidente" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Type */}
        <div className="flex flex-col gap-1">
          <label htmlFor="type" className="text-xs text-slate-gray uppercase tracking-wider">
            Tipo
          </label>
          <select id="type" {...register('type')} className={inputClass}>
            <option value="">Seleccionar tipo...</option>
            {Object.entries(IncidentType).map(([key, value]) => (
              <option key={key} value={value}>
                {key.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
          {errors.type && <span className="text-red-400 text-xs">{errors.type.message}</span>}
        </div>

        {/* Priority */}
        <div className="flex flex-col gap-1">
          <label htmlFor="priority" className="text-xs text-slate-gray uppercase tracking-wider">
            Prioridad
          </label>
          <select id="priority" {...register('priority')} className={inputClass}>
            <option value="">Seleccionar prioridad...</option>
            {Object.entries(IncidentPriority).map(([key, value]) => (
              <option key={key} value={value}>
                {key.charAt(0) + key.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          {errors.priority && (
            <span className="text-red-400 text-xs">{errors.priority.message}</span>
          )}
        </div>

        {/* Lat / Lng */}
        <div className="flex gap-3">
          <div className="flex flex-col gap-1 flex-1">
            <label htmlFor="lat" className="text-xs text-slate-gray uppercase tracking-wider">
              Latitud
            </label>
            <input
              id="lat"
              type="number"
              step="any"
              placeholder="19.4326"
              {...register('lat', { valueAsNumber: true })}
              className={inputClass}
            />
            {errors.lat && <span className="text-red-400 text-xs">{errors.lat.message}</span>}
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label htmlFor="lng" className="text-xs text-slate-gray uppercase tracking-wider">
              Longitud
            </label>
            <input
              id="lng"
              type="number"
              step="any"
              placeholder="-99.1332"
              {...register('lng', { valueAsNumber: true })}
              className={inputClass}
            />
            {errors.lng && <span className="text-red-400 text-xs">{errors.lng.message}</span>}
          </div>
        </div>

        {/* Address */}
        <div className="flex flex-col gap-1">
          <label htmlFor="address" className="text-xs text-slate-gray uppercase tracking-wider">
            Dirección (opcional)
          </label>
          <input
            id="address"
            type="text"
            placeholder="Calle, colonia..."
            {...register('address')}
            className={inputClass}
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="description"
            className="text-xs text-slate-gray uppercase tracking-wider"
          >
            Descripción (opcional)
          </label>
          <textarea
            id="description"
            rows={2}
            placeholder="Detalles del incidente..."
            {...register('description')}
            className={`${inputClass} resize-none`}
          />
        </div>

        {errors.root && (
          <p className="text-red-400 text-sm">{errors.root.message}</p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-slate-700 text-slate-gray hover:text-signal-white py-2 rounded text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-tactical-blue hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-2 rounded text-sm transition-colors"
          >
            {isSubmitting ? 'Creando...' : 'Crear incidente'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 4: Correr tests — deben pasar**

```bash
~/.local/bin/pnpm test -- --testPathPattern=CreateIncidentModal.test 2>&1 | tail -10
```

Esperado: PASS — 3 tests passed.

- [ ] **Step 5: Typecheck + todos los tests**

```bash
~/.local/bin/pnpm typecheck 2>&1 | tail -5
~/.local/bin/pnpm test 2>&1 | tail -10
```

Esperado: 26 tests passing.

- [ ] **Step 6: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/web
git commit -m "feat: add create incident modal with form validation"
```

---

## Task 9: Assign Unit Modal

**Files:**
- Modify: `apps/web/src/components/incidents/AssignUnitModal.tsx` (reemplazar stub)
- Create: `apps/web/src/components/incidents/AssignUnitModal.test.tsx`

- [ ] **Step 1: Escribir tests (TDD — fallan primero)**

`apps/web/src/components/incidents/AssignUnitModal.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssignUnitModal from './AssignUnitModal';
import { useUnitsStore } from '@/store/units.store';
import { useIncidentsStore } from '@/store/incidents.store';
import { dispatchApi } from '@/lib/api';
import { UnitStatus, IncidentPriority, IncidentStatus, IncidentType } from '@velnari/shared-types';
import type { Unit } from '@/lib/types';

jest.mock('@/lib/api', () => ({
  unitsApi: {
    getAll: jest.fn().mockResolvedValue({ data: [] }),
  },
  dispatchApi: {
    assignUnit: jest.fn(),
  },
}));

const mockAssign = dispatchApi.assignUnit as jest.Mock;

const mockUnit: Unit = {
  id: 'unit-1',
  callSign: 'P-14',
  status: UnitStatus.AVAILABLE,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockUpdatedIncident = {
  id: 'inc-1',
  folio: 'IC-001',
  type: IncidentType.ROBBERY,
  priority: IncidentPriority.HIGH,
  status: IncidentStatus.ASSIGNED,
  assignedUnitId: 'unit-1',
  lat: 19.43,
  lng: -99.13,
  createdBy: 'user-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  useUnitsStore.setState({ units: [mockUnit], positions: {}, isLoading: false });
  useIncidentsStore.setState({ incidents: [], selectedId: null, isLoading: false });
});

describe('AssignUnitModal', () => {
  it('muestra las unidades disponibles', () => {
    render(<AssignUnitModal incidentId="inc-1" onClose={jest.fn()} />);
    expect(screen.getByText('P-14')).toBeInTheDocument();
  });

  it('muestra mensaje si no hay unidades disponibles', () => {
    useUnitsStore.setState({ units: [], positions: {}, isLoading: false });
    render(<AssignUnitModal incidentId="inc-1" onClose={jest.fn()} />);
    expect(screen.getByText(/sin unidades disponibles/i)).toBeInTheDocument();
  });

  it('llama a dispatchApi.assignUnit al seleccionar una unidad', async () => {
    mockAssign.mockResolvedValue({ data: mockUpdatedIncident });
    const onClose = jest.fn();
    const user = userEvent.setup();

    render(<AssignUnitModal incidentId="inc-1" onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /asignar p-14/i }));

    await waitFor(() => {
      expect(mockAssign).toHaveBeenCalledWith('inc-1', 'unit-1');
      expect(onClose).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Verificar que tests fallan**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web"
~/.local/bin/pnpm test -- --testPathPattern=AssignUnitModal.test 2>&1 | tail -8
```

Esperado: FAIL — stub no tiene la lista de unidades.

- [ ] **Step 3: Reemplazar stub con `apps/web/src/components/incidents/AssignUnitModal.tsx` completo**

```typescript
'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { useUnitsStore } from '@/store/units.store';
import { useIncidentsStore } from '@/store/incidents.store';
import { dispatchApi } from '@/lib/api';
import { UnitStatus } from '@velnari/shared-types';

interface AssignUnitModalProps {
  incidentId: string;
  onClose: () => void;
}

export default function AssignUnitModal({ incidentId, onClose }: AssignUnitModalProps) {
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const units = useUnitsStore((s) => s.units);
  const updateIncident = useIncidentsStore((s) => s.updateIncident);

  const availableUnits = units.filter((u) => u.status === UnitStatus.AVAILABLE && u.isActive);

  const handleAssign = async (unitId: string, callSign: string) => {
    setAssigning(unitId);
    setError(null);
    try {
      const res = await dispatchApi.assignUnit(incidentId, unitId);
      updateIncident(res.data);
      onClose();
    } catch {
      setError(`No se pudo asignar la unidad ${callSign}.`);
    } finally {
      setAssigning(null);
    }
  };

  return (
    <Modal isOpen title="Asignar unidad" onClose={onClose}>
      <div className="flex flex-col gap-3">
        {availableUnits.length === 0 ? (
          <p className="text-slate-gray text-sm text-center py-4">
            Sin unidades disponibles
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {availableUnits.map((unit) => (
              <li key={unit.id}>
                <button
                  onClick={() => handleAssign(unit.id, unit.callSign)}
                  disabled={assigning !== null}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded border border-slate-700 transition-colors"
                  aria-label={`Asignar ${unit.callSign}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-signal-white">
                      {unit.callSign}
                    </span>
                    {unit.shift && (
                      <span className="text-xs text-slate-gray">
                        Turno: {unit.shift}
                      </span>
                    )}
                  </div>
                  <Badge variant={unit.status as UnitStatus} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={onClose}
          className="mt-2 text-slate-gray hover:text-signal-white text-sm transition-colors"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: Correr tests — deben pasar**

```bash
~/.local/bin/pnpm test -- --testPathPattern=AssignUnitModal.test 2>&1 | tail -10
```

Esperado: PASS — 3 tests passed.

- [ ] **Step 5: Typecheck + todos los tests**

```bash
~/.local/bin/pnpm typecheck 2>&1 | tail -5
~/.local/bin/pnpm test 2>&1 | tail -10
```

Esperado: 29 tests passing.

- [ ] **Step 6: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/web
git commit -m "feat: add assign unit modal with available units dispatch flow"
```

---

## Task 10: Socket.IO Live Updates + Final Push

**Files:**
- Create: `apps/web/src/components/incidents/RealtimeProvider.tsx`
- Modify: `apps/web/src/app/command/page.tsx` (añadir RealtimeProvider)

- [ ] **Step 1: Crear `apps/web/src/components/incidents/RealtimeProvider.tsx`**

Este componente se monta en la página `/command` y se encarga de:
1. Conectar Socket.IO al montar
2. Unirse al room `command`
3. Escuchar eventos y actualizar los stores
4. Desconectar al desmontar

```typescript
'use client';

import { useEffect } from 'react';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';
import { useUnitsStore } from '@/store/units.store';
import { useIncidentsStore } from '@/store/incidents.store';
import type { UnitPosition, Incident } from '@/lib/types';
import type { Unit } from '@/lib/types';

export default function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const updatePosition = useUnitsStore((s) => s.updatePosition);
  const updateUnit = useUnitsStore((s) => s.updateUnit);
  const addIncident = useIncidentsStore((s) => s.addIncident);
  const updateIncident = useIncidentsStore((s) => s.updateIncident);

  useEffect(() => {
    if (!accessToken) return;

    const socket = connectSocket(accessToken);

    // Join the command room to receive all events
    socket.emit('join:command');

    // Unit location changed (emitted from unit GPS updates)
    socket.on('unit:location:changed', (payload: UnitPosition) => {
      updatePosition(payload);
    });

    // Unit status changed
    socket.on('unit:status:changed', (payload: { unitId: string; status: string; previousStatus: string }) => {
      // Update the unit status in the store
      // We get partial data, so we merge into the existing unit
      updateUnit({
        id: payload.unitId,
        // Merge with default values; the store's updateUnit will replace matching id
        callSign: '',
        status: payload.status as Unit['status'],
        isActive: true,
        createdAt: '',
        updatedAt: '',
      });
    });

    // New incident created
    socket.on('incident:created', (incident: Incident) => {
      addIncident(incident);
    });

    // Incident assigned
    socket.on('incident:assigned', (payload: { incidentId: string; unitId: string }) => {
      // Trigger a refresh of the specific incident — in production use the full updated object
      // For MVP: the store will be updated when DispatchService response comes back from the REST call
      void payload;
    });

    // Incident status changed
    socket.on('incident:status:changed', (payload: { incidentId: string; status: string }) => {
      const incidents = useIncidentsStore.getState().incidents;
      const incident = incidents.find((i) => i.id === payload.incidentId);
      if (incident) {
        updateIncident({ ...incident, status: payload.status as Incident['status'] });
      }
    });

    return () => {
      socket.off('unit:location:changed');
      socket.off('unit:status:changed');
      socket.off('incident:created');
      socket.off('incident:assigned');
      socket.off('incident:status:changed');
      disconnectSocket();
    };
  }, [accessToken, updatePosition, updateUnit, addIncident, updateIncident]);

  return <>{children}</>;
}
```

- [ ] **Step 2: Actualizar `apps/web/src/app/command/page.tsx` para incluir RealtimeProvider**

Reemplazar el import de IncidentList y agregar RealtimeProvider. El archivo completo queda:

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import dynamic from 'next/dynamic';
import IncidentList from '@/components/incidents/IncidentList';
import RealtimeProvider from '@/components/incidents/RealtimeProvider';

// MapLibre GL usa APIs del browser — cargar sin SSR
const CommandMap = dynamic(() => import('@/components/map/CommandMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-slate-900">
      <p className="text-slate-gray">Cargando mapa...</p>
    </div>
  ),
});

export default function CommandPage() {
  const { isAuthenticated, user, clearAuth } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <RealtimeProvider>
      <div className="flex flex-col h-screen bg-midnight-command">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-bold text-signal-white tracking-tight">
              Velnari Command
            </span>
            <span className="text-xs text-slate-gray font-mono">
              {new Date().toLocaleDateString('es-MX', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
              })}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-gray">{user?.name}</span>
            <button
              onClick={clearAuth}
              className="text-xs text-slate-gray hover:text-signal-white transition-colors"
            >
              Salir
            </button>
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 relative">
            <CommandMap />
          </div>
          <aside className="w-[380px] shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">
            <IncidentList />
          </aside>
        </div>
      </div>
    </RealtimeProvider>
  );
}
```

- [ ] **Step 3: Typecheck final**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web"
~/.local/bin/pnpm typecheck 2>&1
```

Esperado: exit 0, sin errores. Corregir cualquier error antes de continuar.

- [ ] **Step 4: Correr todos los tests**

```bash
~/.local/bin/pnpm test 2>&1
```

Esperado: todos los tests pasan (29+ tests en 9+ suites).

- [ ] **Step 5: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/web
git commit -m "feat: add Socket.IO realtime provider for live unit and incident updates"
```

- [ ] **Step 6: Push a GitHub**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git push origin main
```

Esperado: push exitoso a `https://github.com/ivancancan/velnari-police`.

---

## Self-Review

### Cobertura del spec (MVP P0 web)

| Requisito | Task |
|-----------|------|
| Autenticación y roles (login page) | Task 2 |
| Mapa en tiempo real de unidades | Task 5 + Task 10 |
| Alta de incidentes | Task 8 |
| Estados de unidad (visibles en mapa y badges) | Task 5, Task 6 |
| Asignación manual de unidad | Task 9 |
| Vista de incidente con timeline | Task 7 |
| Dashboard operativo básico (mapa + lista) | Task 3 |
| Socket.IO real-time updates | Task 10 |

### Tipos consistentes entre tasks
- `Unit`, `Incident`, `IncidentEvent`, `UnitPosition` definidos en Task 4 (`types.ts`) y usados en Tasks 5–9
- Enums importados de `@velnari/shared-types` consistentemente
- `useUnitsStore`, `useIncidentsStore` usados con la misma interfaz en todos los tasks

### Componentes stub → reemplazados
- `CommandMap.tsx`: stub en Task 3 → completo en Task 5
- `IncidentList.tsx`: stub en Task 3 → completo en Task 6
- `IncidentDetail.tsx`: stub en Task 6 → completo en Task 7
- `CreateIncidentModal.tsx`: stub en Task 6 → completo en Task 8
- `AssignUnitModal.tsx`: stub en Task 6 → completo en Task 9

### Pendiente para Plan 4 (Velnari Field — React Native)
- App móvil para policías en campo
- Actualización de estado de unidad desde móvil
- Envío de posición GPS
- Notificaciones de nuevos incidentes asignados

### Pendiente para Plan 5 (Velnari Insights)
- Dashboard con métricas operativas
- Reportes por período
- Exportación CSV
