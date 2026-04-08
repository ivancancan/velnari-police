# Operational Dashboard + Critical Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/dashboard` route showing today's operational metrics (units by status, incidents by priority/type, avg response time, recent incident table) plus real-time toast alerts for critical/high priority incidents arriving via WebSocket.

**Architecture:** Backend adds two read-only stats endpoints — `GET /incidents/stats` and `GET /units/stats` — that aggregate in-memory after a single DB query (no raw SQL needed for MVP scale). Frontend adds a `/dashboard` page assembled from two small presentational components (StatsCard, MiniBarChart) with no new npm dependencies (CSS bars). Toast alerts are handled by a tiny Zustand store; the existing RealtimeProvider subscribes and fires them. A nav link connects Command ↔ Dashboard.

**Tech Stack:** NestJS + TypeORM (API), Next.js 14 App Router + Zustand v5 + Tailwind CSS (web), Jest (tests).

---

## File Structure

**New files:**
- `apps/api/src/modules/incidents/incidents.service.spec.ts` — add `getStats` tests
- `apps/web/src/components/dashboard/StatsCard.tsx` — single metric card
- `apps/web/src/components/dashboard/MiniBarChart.tsx` — CSS horizontal bar chart
- `apps/web/src/components/ui/Toast.tsx` — single dismissable toast notification
- `apps/web/src/components/ui/ToastContainer.tsx` — renders active alerts + auto-dismiss
- `apps/web/src/store/alerts.store.ts` — Zustand store for in-flight alert toasts
- `apps/web/src/app/dashboard/page.tsx` — Velnari Insights dashboard page

**Modified files:**
- `apps/api/src/modules/incidents/incidents.service.ts` — add `getStats(date)` method
- `apps/api/src/modules/incidents/incidents.controller.ts` — add `GET /incidents/stats` (BEFORE `:id` route)
- `apps/api/src/modules/units/units.service.ts` — add `getStats()` method
- `apps/api/src/modules/units/units.controller.ts` — add `GET /units/stats` (BEFORE `:id/history` route)
- `apps/web/src/lib/types.ts` — add `IncidentStats` and `UnitStats` interfaces
- `apps/web/src/lib/api.ts` — add `incidentsApi.getStats()` and `unitsApi.getStats()`
- `apps/web/src/components/incidents/RealtimeProvider.tsx` — add critical/high alert dispatch
- `apps/web/src/app/command/page.tsx` — add `<ToastContainer />` and nav link to Dashboard

---

## Task 1: Backend — IncidentsService.getStats()

**Files:**
- Modify: `apps/api/src/modules/incidents/incidents.service.ts`
- Modify: `apps/api/src/modules/incidents/incidents.controller.ts`
- Test: `apps/api/src/modules/incidents/incidents.service.spec.ts` (create if it doesn't exist)

- [ ] **Step 1: Write the failing tests**

Create (or append to) `apps/api/src/modules/incidents/incidents.service.spec.ts`:

```typescript
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { IncidentsService } from './incidents.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IncidentEntity } from '../../entities/incident.entity';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import { IncidentStatus, IncidentPriority, IncidentType } from '@velnari/shared-types';

describe('IncidentsService.getStats', () => {
  let service: IncidentsService;

  const mockRepo = { find: jest.fn(), count: jest.fn(), findOne: jest.fn(), createQueryBuilder: jest.fn(), save: jest.fn() };
  const mockEventRepo = { find: jest.fn(), create: jest.fn(), save: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        { provide: getRepositoryToken(IncidentEntity), useValue: mockRepo },
        { provide: getRepositoryToken(IncidentEventEntity), useValue: mockEventRepo },
      ],
    }).compile();
    service = module.get<IncidentsService>(IncidentsService);
    jest.clearAllMocks();
  });

  it('cuenta totales por estado', async () => {
    const now = new Date('2026-04-07T10:00:00Z');
    mockRepo.find.mockResolvedValue([
      { status: IncidentStatus.OPEN, priority: IncidentPriority.HIGH, type: IncidentType.ROBBERY, createdAt: now, assignedAt: null },
      { status: IncidentStatus.ASSIGNED, priority: IncidentPriority.CRITICAL, type: IncidentType.ASSAULT, createdAt: now, assignedAt: null },
      { status: IncidentStatus.CLOSED, priority: IncidentPriority.LOW, type: IncidentType.TRAFFIC, createdAt: now, assignedAt: null },
    ]);
    const stats = await service.getStats(new Date('2026-04-07'));
    expect(stats.total).toBe(3);
    expect(stats.open).toBe(1);
    expect(stats.assigned).toBe(1);
    expect(stats.closed).toBe(1);
  });

  it('cuenta incidentes por prioridad', async () => {
    const now = new Date('2026-04-07T10:00:00Z');
    mockRepo.find.mockResolvedValue([
      { status: IncidentStatus.OPEN, priority: IncidentPriority.CRITICAL, type: IncidentType.ROBBERY, createdAt: now, assignedAt: null },
      { status: IncidentStatus.OPEN, priority: IncidentPriority.CRITICAL, type: IncidentType.ASSAULT, createdAt: now, assignedAt: null },
      { status: IncidentStatus.OPEN, priority: IncidentPriority.HIGH, type: IncidentType.TRAFFIC, createdAt: now, assignedAt: null },
    ]);
    const stats = await service.getStats(new Date('2026-04-07'));
    expect(stats.byPriority['critical']).toBe(2);
    expect(stats.byPriority['high']).toBe(1);
  });

  it('calcula avgResponseMinutes cuando hay assignedAt', async () => {
    const createdAt = new Date('2026-04-07T10:00:00Z');
    const assignedAt = new Date('2026-04-07T10:05:00Z'); // 5 minutes later
    mockRepo.find.mockResolvedValue([
      { status: IncidentStatus.ASSIGNED, priority: IncidentPriority.HIGH, type: IncidentType.ROBBERY, createdAt, assignedAt },
    ]);
    const stats = await service.getStats(new Date('2026-04-07'));
    expect(stats.avgResponseMinutes).toBe(5);
  });

  it('retorna null para avgResponseMinutes si no hay asignaciones', async () => {
    mockRepo.find.mockResolvedValue([
      { status: IncidentStatus.OPEN, priority: IncidentPriority.HIGH, type: IncidentType.ROBBERY, createdAt: new Date(), assignedAt: null },
    ]);
    const stats = await service.getStats(new Date('2026-04-07'));
    expect(stats.avgResponseMinutes).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
TS_NODE_PROJECT=tsconfig.jest.json npx jest incidents.service --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `service.getStats is not a function`

- [ ] **Step 3: Add `getStats` to IncidentsService**

Open `apps/api/src/modules/incidents/incidents.service.ts`. Add `Between` to the typeorm import (it's already there if used). Then add this method at the end of the class, before the closing `}`:

```typescript
async getStats(date: Date): Promise<{
  total: number;
  open: number;
  assigned: number;
  closed: number;
  byPriority: Record<string, number>;
  byType: Record<string, number>;
  avgResponseMinutes: number | null;
}> {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

  const incidents = await this.repo.find({
    where: { createdAt: Between(dayStart, dayEnd) },
    select: ['id', 'status', 'priority', 'type', 'createdAt', 'assignedAt'],
  });

  const byPriority: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let open = 0, assigned = 0, closed = 0;
  let totalResponseMs = 0, responseCount = 0;

  for (const inc of incidents) {
    if (inc.status === IncidentStatus.OPEN) open++;
    else if (
      inc.status === IncidentStatus.ASSIGNED ||
      inc.status === IncidentStatus.EN_ROUTE ||
      inc.status === IncidentStatus.ON_SCENE
    ) assigned++;
    else if (inc.status === IncidentStatus.CLOSED) closed++;

    byPriority[inc.priority] = (byPriority[inc.priority] ?? 0) + 1;
    byType[inc.type] = (byType[inc.type] ?? 0) + 1;

    if (inc.assignedAt && inc.createdAt) {
      totalResponseMs += new Date(inc.assignedAt).getTime() - new Date(inc.createdAt).getTime();
      responseCount++;
    }
  }

  return {
    total: incidents.length,
    open,
    assigned,
    closed,
    byPriority,
    byType,
    avgResponseMinutes: responseCount > 0
      ? Math.round(totalResponseMs / responseCount / 60000 * 10) / 10
      : null,
  };
}
```

Also add `Between` and the status enums to the imports if not already present:
- `Between` from `'typeorm'`
- `IncidentStatus` from `'@velnari/shared-types'` (already imported)

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
TS_NODE_PROJECT=tsconfig.jest.json npx jest incidents.service --no-coverage 2>&1 | tail -10
```

Expected: PASS — all tests green

- [ ] **Step 5: Add `GET /incidents/stats` to the controller**

Open `apps/api/src/modules/incidents/incidents.controller.ts`. Add the stats endpoint **BEFORE** the `@Get(':id')` route — this is critical, otherwise NestJS will try to parse the string `"stats"` as a UUID and throw 400.

Add this method right after the `findAll` method and before `findOne`:

```typescript
@Get('stats')
getStats(@Query('date') date?: string): Promise<{
  total: number;
  open: number;
  assigned: number;
  closed: number;
  byPriority: Record<string, number>;
  byType: Record<string, number>;
  avgResponseMinutes: number | null;
}> {
  const d = date && !isNaN(Date.parse(date)) ? new Date(date) : new Date();
  return this.service.getStats(d);
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
npx tsc --noEmit 2>&1 | head -15
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/api/src/modules/incidents/incidents.service.ts \
        apps/api/src/modules/incidents/incidents.controller.ts \
        apps/api/src/modules/incidents/incidents.service.spec.ts
git commit -m "feat: add getStats to IncidentsService and GET /incidents/stats endpoint"
```

---

## Task 2: Backend — UnitsService.getStats()

**Files:**
- Modify: `apps/api/src/modules/units/units.service.ts`
- Modify: `apps/api/src/modules/units/units.controller.ts`
- Modify: `apps/api/src/modules/units/units.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Open `apps/api/src/modules/units/units.service.spec.ts`. Add this test block at the end of the outer `describe`:

```typescript
describe('getStats', () => {
  it('cuenta unidades por estado', async () => {
    mockRepo.find.mockResolvedValue([
      { ...mockUnit, status: UnitStatus.AVAILABLE },
      { ...mockUnit, id: 'u2', status: UnitStatus.EN_ROUTE },
      { ...mockUnit, id: 'u3', status: UnitStatus.ON_SCENE },
      { ...mockUnit, id: 'u4', status: UnitStatus.OUT_OF_SERVICE },
    ]);
    const stats = await service.getStats();
    expect(stats.total).toBe(4);
    expect(stats.available).toBe(1);
    expect(stats.enRoute).toBe(1);
    expect(stats.onScene).toBe(1);
    expect(stats.outOfService).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
TS_NODE_PROJECT=tsconfig.jest.json npx jest units.service --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `service.getStats is not a function`

- [ ] **Step 3: Add `getStats` to UnitsService**

Open `apps/api/src/modules/units/units.service.ts`. Add this method at the end of the class before the closing `}`:

```typescript
async getStats(): Promise<{
  total: number;
  available: number;
  enRoute: number;
  onScene: number;
  outOfService: number;
}> {
  const units = await this.repo.find({ where: { isActive: true } });
  const stats = { total: units.length, available: 0, enRoute: 0, onScene: 0, outOfService: 0 };
  for (const unit of units) {
    if (unit.status === UnitStatus.AVAILABLE) stats.available++;
    else if (unit.status === UnitStatus.EN_ROUTE) stats.enRoute++;
    else if (unit.status === UnitStatus.ON_SCENE) stats.onScene++;
    else if (unit.status === UnitStatus.OUT_OF_SERVICE) stats.outOfService++;
  }
  return stats;
}
```

`UnitStatus` is already imported in the service.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
TS_NODE_PROJECT=tsconfig.jest.json npx jest units.service --no-coverage 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 5: Add `GET /units/stats` to the controller**

Open `apps/api/src/modules/units/units.controller.ts`. Add this method **BEFORE** `@Get(':id')` (after `findNearby`):

```typescript
@Get('stats')
getStats(): Promise<{
  total: number;
  available: number;
  enRoute: number;
  onScene: number;
  outOfService: number;
}> {
  return this.service.getStats();
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
npx tsc --noEmit 2>&1 | head -15
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/api/src/modules/units/units.service.ts \
        apps/api/src/modules/units/units.controller.ts \
        apps/api/src/modules/units/units.service.spec.ts
git commit -m "feat: add getStats to UnitsService and GET /units/stats endpoint"
```

---

## Task 3: Web — Stats types + API methods

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add `IncidentStats` and `UnitStats` to types.ts**

Append to the end of `apps/web/src/lib/types.ts`:

```typescript
export interface IncidentStats {
  total: number;
  open: number;
  assigned: number;
  closed: number;
  byPriority: Record<string, number>;
  byType: Record<string, number>;
  avgResponseMinutes: number | null;
}

export interface UnitStats {
  total: number;
  available: number;
  enRoute: number;
  onScene: number;
  outOfService: number;
}
```

- [ ] **Step 2: Add `IncidentStats` and `UnitStats` to the import in api.ts**

In `apps/web/src/lib/api.ts`, update line 4 from:

```typescript
import type { Unit, Incident, Sector, IncidentEvent, LocationHistoryPoint } from './types';
```

to:

```typescript
import type { Unit, Incident, Sector, IncidentEvent, LocationHistoryPoint, IncidentStats, UnitStats } from './types';
```

- [ ] **Step 3: Add `getStats` to `incidentsApi` in api.ts**

In `apps/web/src/lib/api.ts`, add this method to the `incidentsApi` object after `getEvents`:

```typescript
getStats: (date?: string) =>
  api.get<IncidentStats>('/incidents/stats', { params: date ? { date } : {} }),
```

- [ ] **Step 4: Add `getStats` to `unitsApi` in api.ts**

In `apps/web/src/lib/api.ts`, add this method to the `unitsApi` object after `getIncidentsByUnit`:

```typescript
getStats: () => api.get<UnitStats>('/units/stats'),
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web"
npx tsc --noEmit 2>&1 | head -15
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts
git commit -m "feat: add IncidentStats and UnitStats types and API methods"
```

---

## Task 4: Web — StatsCard + MiniBarChart components

**Files:**
- Create: `apps/web/src/components/dashboard/StatsCard.tsx`
- Create: `apps/web/src/components/dashboard/MiniBarChart.tsx`

- [ ] **Step 1: Create `StatsCard.tsx`**

```tsx
// apps/web/src/components/dashboard/StatsCard.tsx
interface StatsCardProps {
  label: string;
  value: number | string;
  color?: 'blue' | 'amber' | 'green' | 'red' | 'slate';
  sub?: string;
}

const VALUE_COLORS = {
  blue: 'text-tactical-blue',
  amber: 'text-alert-amber',
  green: 'text-green-400',
  red: 'text-red-400',
  slate: 'text-slate-gray',
} as const;

export default function StatsCard({ label, value, color = 'blue', sub }: StatsCardProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 flex flex-col gap-1">
      <p className="text-xs text-slate-gray uppercase tracking-widest">{label}</p>
      <p className={`text-3xl font-bold font-mono ${VALUE_COLORS[color]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create `MiniBarChart.tsx`**

```tsx
// apps/web/src/components/dashboard/MiniBarChart.tsx
interface MiniBarChartProps {
  title: string;
  data: Record<string, number>;
  colorMap?: Record<string, string>;
  labelMap?: Record<string, string>;
}

export default function MiniBarChart({ title, data, colorMap = {}, labelMap = {} }: MiniBarChartProps) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <p className="text-xs text-slate-gray uppercase tracking-widest mb-3">{title}</p>
      {entries.length === 0 && (
        <p className="text-xs text-slate-500 py-2">Sin datos</p>
      )}
      <div className="flex flex-col gap-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-24 shrink-0 truncate">
              {labelMap[key] ?? key}
            </span>
            <div className="flex-1 bg-slate-700 rounded-full h-2">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${Math.round((value / max) * 100)}%`,
                  backgroundColor: colorMap[key] ?? '#3B82F6',
                }}
              />
            </div>
            <span className="text-xs text-signal-white font-mono w-5 text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web"
npx tsc --noEmit 2>&1 | head -15
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/web/src/components/dashboard/StatsCard.tsx \
        apps/web/src/components/dashboard/MiniBarChart.tsx
git commit -m "feat: add StatsCard and MiniBarChart dashboard components"
```

---

## Task 5: Web — Dashboard page

**Files:**
- Create: `apps/web/src/app/dashboard/page.tsx`

- [ ] **Step 1: Create the dashboard page**

```tsx
// apps/web/src/app/dashboard/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { incidentsApi, unitsApi } from '@/lib/api';
import type { IncidentStats, UnitStats, Incident } from '@/lib/types';
import StatsCard from '@/components/dashboard/StatsCard';
import MiniBarChart from '@/components/dashboard/MiniBarChart';

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#22C55E',
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
};

const TYPE_LABELS: Record<string, string> = {
  robbery: 'Robo',
  assault: 'Agresión',
  traffic: 'Tráfico',
  noise: 'Ruido',
  domestic: 'Doméstico',
  missing_person: 'Extraviado',
  other: 'Otro',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  open: { label: 'Abierto', className: 'bg-red-900 text-red-300' },
  assigned: { label: 'Asignado', className: 'bg-blue-900 text-blue-300' },
  en_route: { label: 'En Ruta', className: 'bg-amber-900 text-amber-300' },
  on_scene: { label: 'En Escena', className: 'bg-amber-900 text-amber-300' },
  closed: { label: 'Cerrado', className: 'bg-slate-700 text-slate-300' },
};

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const { isAuthenticated, user, clearAuth } = useAuthStore();
  const router = useRouter();
  const [date, setDate] = useState(toDateString(new Date()));
  const [incidentStats, setIncidentStats] = useState<IncidentStats | null>(null);
  const [unitStats, setUnitStats] = useState<UnitStats | null>(null);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      incidentsApi.getStats(date),
      unitsApi.getStats(),
      incidentsApi.getAll(),
    ])
      .then(([statsRes, unitStatsRes, incidentsRes]) => {
        setIncidentStats(statsRes.data);
        setUnitStats(unitStatsRes.data);
        const forDate = incidentsRes.data
          .filter((i) => i.createdAt.startsWith(date))
          .slice(0, 15);
        setRecentIncidents(forDate);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex flex-col min-h-screen bg-midnight-command">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-6">
          <span className="font-bold text-signal-white tracking-tight">Velnari Insights</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/command" className="text-slate-gray hover:text-signal-white transition-colors">
              Mapa
            </Link>
            <span className="text-signal-white font-medium border-b-2 border-tactical-blue pb-0.5">
              Dashboard
            </span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={date}
            max={toDateString(new Date())}
            onChange={(e) => setDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-signal-white text-xs focus:outline-none focus:border-tactical-blue"
            aria-label="Fecha del reporte"
          />
          <span className="text-sm text-slate-gray">{user?.name}</span>
          <button
            onClick={clearAuth}
            className="text-xs text-slate-gray hover:text-signal-white transition-colors"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-6 max-w-6xl mx-auto w-full">
        {loading && !incidentStats && (
          <p className="text-slate-gray text-center py-20 text-sm">Cargando métricas...</p>
        )}

        {incidentStats && unitStats && (
          <>
            {/* Units status */}
            <section className="mb-6">
              <h2 className="text-xs text-slate-gray uppercase tracking-widest mb-3 font-semibold">
                Estado de Unidades
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard label="Disponibles" value={unitStats.available} color="green" />
                <StatsCard label="En Ruta" value={unitStats.enRoute} color="blue" />
                <StatsCard label="En Escena" value={unitStats.onScene} color="amber" />
                <StatsCard label="Fuera de Servicio" value={unitStats.outOfService} color="slate" />
              </div>
            </section>

            {/* Incidents stats */}
            <section className="mb-6">
              <h2 className="text-xs text-slate-gray uppercase tracking-widest mb-3 font-semibold">
                Incidentes del Día
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard label="Total" value={incidentStats.total} color="blue" />
                <StatsCard label="Sin Atender" value={incidentStats.open} color="red" />
                <StatsCard label="En Atención" value={incidentStats.assigned} color="amber" />
                <StatsCard
                  label="Cerrados"
                  value={incidentStats.closed}
                  color="green"
                  sub={
                    incidentStats.avgResponseMinutes != null
                      ? `Resp. prom: ${incidentStats.avgResponseMinutes} min`
                      : undefined
                  }
                />
              </div>
            </section>

            {/* Charts */}
            <section className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <MiniBarChart
                title="Incidentes por Prioridad"
                data={incidentStats.byPriority}
                colorMap={PRIORITY_COLORS}
                labelMap={PRIORITY_LABELS}
              />
              <MiniBarChart
                title="Incidentes por Tipo"
                data={incidentStats.byType}
                labelMap={TYPE_LABELS}
              />
            </section>

            {/* Recent incidents table */}
            <section>
              <h2 className="text-xs text-slate-gray uppercase tracking-widest mb-3 font-semibold">
                Últimos Incidentes del Día
              </h2>
              <div className="bg-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-gray text-xs uppercase tracking-widest">
                      <th className="text-left px-4 py-2">Folio</th>
                      <th className="text-left px-4 py-2 hidden sm:table-cell">Tipo</th>
                      <th className="text-left px-4 py-2">Prioridad</th>
                      <th className="text-left px-4 py-2 hidden md:table-cell">Dirección</th>
                      <th className="text-left px-4 py-2">Estado</th>
                      <th className="text-left px-4 py-2">Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentIncidents.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-slate-gray py-10 text-sm">
                          Sin incidentes para esta fecha
                        </td>
                      </tr>
                    )}
                    {recentIncidents.map((inc) => {
                      const statusInfo = STATUS_BADGE[inc.status] ?? {
                        label: inc.status,
                        className: 'bg-slate-700 text-slate-300',
                      };
                      return (
                        <tr
                          key={inc.id}
                          className="border-b border-slate-700 hover:bg-slate-700 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-signal-white font-bold text-xs">
                            {inc.folio}
                          </td>
                          <td className="px-4 py-3 text-slate-300 text-xs capitalize hidden sm:table-cell">
                            {TYPE_LABELS[inc.type] ?? inc.type}
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold" style={{ color: PRIORITY_COLORS[inc.priority] }}>
                            {PRIORITY_LABELS[inc.priority] ?? inc.priority}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-[180px] hidden md:table-cell">
                            {inc.address ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.className}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                            {new Date(inc.createdAt).toLocaleTimeString('es-MX', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web"
npx tsc --noEmit 2>&1 | head -15
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/web/src/app/dashboard/page.tsx
git commit -m "feat: add Velnari Insights dashboard page with metrics, charts, and incident table"
```

---

## Task 6: Web — Toast alerts + nav links

**Files:**
- Create: `apps/web/src/store/alerts.store.ts`
- Create: `apps/web/src/components/ui/Toast.tsx`
- Create: `apps/web/src/components/ui/ToastContainer.tsx`
- Modify: `apps/web/src/components/incidents/RealtimeProvider.tsx`
- Modify: `apps/web/src/app/command/page.tsx`

- [ ] **Step 1: Create `alerts.store.ts`**

```typescript
// apps/web/src/store/alerts.store.ts
import { create } from 'zustand';

export interface Alert {
  id: string;
  folio: string;
  message: string;
  priority: string;
  createdAt: number;
}

interface AlertsState {
  alerts: Alert[];
  addAlert: (alert: Omit<Alert, 'id' | 'createdAt'>) => void;
  dismissAlert: (id: string) => void;
}

export const useAlertsStore = create<AlertsState>()((set) => ({
  alerts: [],

  addAlert: (alert) =>
    set((state) => ({
      alerts: [
        ...state.alerts,
        { ...alert, id: crypto.randomUUID(), createdAt: Date.now() },
      ],
    })),

  dismissAlert: (id) =>
    set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),
}));
```

- [ ] **Step 2: Create `Toast.tsx`**

```tsx
// apps/web/src/components/ui/Toast.tsx
interface ToastProps {
  id: string;
  folio: string;
  message: string;
  priority: string;
  onDismiss: (id: string) => void;
}

const COLORS: Record<string, { bg: string; border: string; label: string }> = {
  critical: { bg: 'bg-red-950', border: 'border-red-500', label: 'text-red-300' },
  high: { bg: 'bg-orange-950', border: 'border-orange-500', label: 'text-orange-300' },
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'CRÍTICO',
  high: 'ALTO',
};

export default function Toast({ id, folio, message, priority, onDismiss }: ToastProps) {
  const colors = COLORS[priority] ?? COLORS.high;
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-2xl max-w-sm w-full ${colors.bg} ${colors.border}`}
      role="alert"
      aria-live="assertive"
    >
      <span className="text-xl shrink-0 mt-0.5">🚨</span>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold uppercase tracking-widest ${colors.label}`}>
          {PRIORITY_LABELS[priority] ?? priority} · {folio}
        </p>
        <p className="text-signal-white text-sm mt-0.5 line-clamp-2">{message}</p>
      </div>
      <button
        onClick={() => onDismiss(id)}
        className="text-slate-400 hover:text-signal-white shrink-0 text-xl leading-none mt-0.5"
        aria-label="Cerrar alerta"
      >
        ×
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create `ToastContainer.tsx`**

```tsx
// apps/web/src/components/ui/ToastContainer.tsx
'use client';

import { useEffect } from 'react';
import { useAlertsStore } from '@/store/alerts.store';
import Toast from './Toast';

const AUTO_DISMISS_MS = 8000;

export default function ToastContainer() {
  const { alerts, dismissAlert } = useAlertsStore();

  useEffect(() => {
    if (alerts.length === 0) return;
    const oldest = alerts[0];
    const age = Date.now() - oldest.createdAt;
    const remaining = Math.max(0, AUTO_DISMISS_MS - age);
    const timer = setTimeout(() => dismissAlert(oldest.id), remaining);
    return () => clearTimeout(timer);
  }, [alerts, dismissAlert]);

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {alerts.map((alert) => (
        <div key={alert.id} className="pointer-events-auto">
          <Toast
            id={alert.id}
            folio={alert.folio}
            message={alert.message}
            priority={alert.priority}
            onDismiss={dismissAlert}
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Update `RealtimeProvider.tsx` to fire alerts**

Open `apps/web/src/components/incidents/RealtimeProvider.tsx`. Add the import and hook at the top, then update the `incident:created` handler:

Add import after existing imports:
```typescript
import { useAlertsStore } from '@/store/alerts.store';
```

Add inside the component, after `const updateIncident`:
```typescript
const addAlert = useAlertsStore((s) => s.addAlert);
```

Update the `socket.on('incident:created', ...)` handler:
```typescript
socket.on('incident:created', (incident: Incident) => {
  addIncident(incident);
  if (incident.priority === 'critical' || incident.priority === 'high') {
    addAlert({
      folio: incident.folio,
      message: incident.description ?? incident.address ?? 'Nuevo incidente',
      priority: incident.priority,
    });
  }
});
```

Also add `addAlert` to the `useEffect` dependency array:
```typescript
  }, [accessToken, updatePosition, updateUnit, addIncident, updateIncident, addAlert]);
```

- [ ] **Step 5: Update `command/page.tsx` — add ToastContainer + Dashboard nav link**

Open `apps/web/src/app/command/page.tsx`.

Add import after the existing imports:
```typescript
import ToastContainer from '@/components/ui/ToastContainer';
import Link from 'next/link';
```

Add `<ToastContainer />` just before the closing `</RealtimeProvider>` tag:
```tsx
        </RealtimeProvider>
```
→
```tsx
        <ToastContainer />
      </RealtimeProvider>
```

Add a Dashboard nav link in the header, after the date span:
```tsx
<span className="text-xs text-slate-gray font-mono">
  {new Date().toLocaleDateString('es-MX', { ... })}
</span>
```
→
```tsx
<span className="text-xs text-slate-gray font-mono">
  {new Date().toLocaleDateString('es-MX', { ... })}
</span>
<Link href="/dashboard" className="text-xs text-slate-gray hover:text-signal-white transition-colors ml-2">
  Dashboard →
</Link>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web"
npx tsc --noEmit 2>&1 | head -15
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/web/src/store/alerts.store.ts \
        apps/web/src/components/ui/Toast.tsx \
        apps/web/src/components/ui/ToastContainer.tsx \
        apps/web/src/components/incidents/RealtimeProvider.tsx \
        apps/web/src/app/command/page.tsx
git commit -m "feat: add critical incident toast alerts and Dashboard nav link"
```

---

## Self-Review

**Spec coverage:**
- ✅ Dashboard operativo básico (P0) — `/dashboard` route with stats, charts, recent incidents
- ✅ Units by status — 4 StatsCards showing available/en_route/on_scene/out_of_service
- ✅ Incidents today — total/open/assigned/closed counts + avg response time
- ✅ Incidents by priority — MiniBarChart with priority color coding
- ✅ Incidents by type — MiniBarChart with Spanish labels
- ✅ Recent incidents table — last 15 incidents of the selected day
- ✅ Date picker — filter all metrics by any past date, defaults to today
- ✅ Auto-refresh every 30s — setInterval in loadData useEffect
- ✅ Nav links — Command page links to Dashboard; Dashboard links to Command
- ✅ Alertas de incidentes críticos (P0) — Toast fires for `critical` and `high` priority incidents
- ✅ Toast auto-dismiss — 8s timeout, manual ✕ dismiss

**Placeholder scan:** All code blocks are complete with no TBDs.

**Type consistency:**
- `IncidentStats` defined in Task 3, consumed in Task 5 ✅
- `UnitStats` defined in Task 3, consumed in Task 5 ✅
- `Alert` interface defined in alerts.store.ts, used by Toast and ToastContainer via store ✅
- `incidentsApi.getStats(date?)` → `IncidentStats` used in dashboard page ✅
- `unitsApi.getStats()` → `UnitStats` used in dashboard page ✅

**Route ordering check:**
- `GET /incidents/stats` added BEFORE `GET /incidents/:id` — critical, noted in Task 1 Step 5 ✅
- `GET /units/stats` added BEFORE `GET /units/:id` — noted in Task 2 Step 5 ✅
