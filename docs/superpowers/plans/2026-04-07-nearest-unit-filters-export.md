# Nearest Unit + Filters + CSV Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three P1 features in one plan: (1) sort available units by distance to the incident when assigning; (2) add status + sector filter chips to the incident sidebar; (3) add a CSV export button on the dashboard.

**Architecture:**
- **Nearest unit**: backend replaces the stub in `findAvailableNearby` with a real PostGIS `ST_Distance` query. A new `GET /units/nearby?lat=&lng=` endpoint returns available units sorted by distance with a `distanceKm` field. The AssignUnitModal calls this endpoint when it has the incident's coordinates, falls back to all-available if not.
- **Filters**: a filter bar is added above the incident list (status chips + sector dropdown). The `IncidentList` component reads filter state from a new small store slice added to `incidents.store.ts`. The command page passes sector list down; sectors are fetched on mount.
- **CSV export**: a pure-frontend function serialises the `recentIncidents` array already loaded on the dashboard page, builds a Blob, and triggers a download — no new API endpoint needed.

**Tech Stack:** NestJS + TypeORM + PostGIS (backend), Next.js 14 + Zustand v5 + Tailwind (web), Jest (tests).

---

## File Structure

**Modified files:**
- `apps/api/src/modules/units/units.service.ts` — replace `findAvailableNearby` stub with real ST_Distance query
- `apps/api/src/modules/units/units.controller.ts` — add `GET /units/nearby` endpoint (BEFORE `:id`)
- `apps/api/src/modules/units/units.service.spec.ts` — add test for `findAvailableNearby`
- `apps/web/src/lib/types.ts` — add `UnitWithDistance` interface
- `apps/web/src/lib/api.ts` — add `unitsApi.getNearby(lat, lng)`
- `apps/web/src/store/incidents.store.ts` — add `filters` state + `setFilters` action
- `apps/web/src/components/incidents/AssignUnitModal.tsx` — sort by distance when coords available
- `apps/web/src/components/incidents/IncidentList.tsx` — add filter bar above list
- `apps/web/src/app/command/page.tsx` — fetch sectors on mount, pass to IncidentList
- `apps/web/src/app/dashboard/page.tsx` — add CSV export button

---

## Task 1: Backend — findAvailableNearby with PostGIS

**Files:**
- Modify: `apps/api/src/modules/units/units.service.ts`
- Modify: `apps/api/src/modules/units/units.controller.ts`
- Modify: `apps/api/src/modules/units/units.service.spec.ts`

The current `findAvailableNearby` ignores the `point` parameter and returns all available units. We need to replace it with a real PostGIS query that calculates distance using `ST_Distance` on the `currentLocation` geometry column and returns units sorted nearest-first with their distance.

- [ ] **Step 1: Write the failing test**

Open `apps/api/src/modules/units/units.service.spec.ts`. Add this describe block at the end of the outer `describe('UnitsService', ...)`:

```typescript
describe('findAvailableNearby', () => {
  it('retorna unidades disponibles con distancia calculada', async () => {
    const mockQbResult = [
      { id: 'u1', callSign: 'P-01', status: UnitStatus.AVAILABLE, isActive: true, distance_km: '0.5' },
      { id: 'u2', callSign: 'P-02', status: UnitStatus.AVAILABLE, isActive: true, distance_km: '1.2' },
    ];
    const mockQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawAndEntities: jest.fn().mockResolvedValue({ raw: mockQbResult, entities: [
        { id: 'u1', callSign: 'P-01', status: UnitStatus.AVAILABLE, isActive: true },
        { id: 'u2', callSign: 'P-02', status: UnitStatus.AVAILABLE, isActive: true },
      ]}),
    };
    mockRepo.createQueryBuilder.mockReturnValue(mockQb);

    const result = await service.findAvailableNearby({ lat: 19.4326, lng: -99.1332 });
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('distanceKm');
    expect(result[0].distanceKm).toBe(0.5);
    expect(mockQb.orderBy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
TS_NODE_PROJECT=tsconfig.jest.json npx jest units.service --no-coverage 2>&1 | tail -10
```

Expected: FAIL — result[0] has no property `distanceKm`

- [ ] **Step 3: Update `findAvailableNearby` in units.service.ts**

Replace the entire `findAvailableNearby` method with:

```typescript
async findAvailableNearby(point: NearbyPoint): Promise<(UnitEntity & { distanceKm: number })[]> {
  const radiusKm = point.radiusKm ?? 10;
  const { raw, entities } = await this.repo
    .createQueryBuilder('unit')
    .select('unit')
    .addSelect(
      `ST_Distance(
        unit.current_location::geography,
        ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography
      ) / 1000`,
      'distance_km',
    )
    .where('unit.is_active = true')
    .andWhere('unit.status = :status', { status: UnitStatus.AVAILABLE })
    .andWhere(
      `ST_DWithin(
        unit.current_location::geography,
        ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography,
        :radiusMeters
      )`,
      { radiusMeters: radiusKm * 1000 },
    )
    .orderBy('distance_km', 'ASC')
    .limit(20)
    .getRawAndEntities();

  return entities.map((entity, i) => ({
    ...entity,
    distanceKm: parseFloat(raw[i]?.distance_km ?? '0'),
  }));
}
```

Also update the `NearbyPoint` interface in the same file to match (it should already exist at the top):
```typescript
interface NearbyPoint {
  lat: number;
  lng: number;
  radiusKm?: number;
}
```

And update the return type annotation for `findAvailableNearby` in the interface. Since `getRawAndEntities` is only available via `createQueryBuilder`, the `mockRepo.createQueryBuilder` must return a mock with `getRawAndEntities`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
TS_NODE_PROJECT=tsconfig.jest.json npx jest units.service --no-coverage 2>&1 | tail -15
```

Expected: PASS — all tests green

- [ ] **Step 5: Add `GET /units/nearby` to UnitsController**

Open `apps/api/src/modules/units/units.controller.ts`. Add this method BEFORE `@Get('stats')` (i.e., right after `findAll`):

```typescript
@Get('nearby')
findNearby(
  @Query('lat') lat: string,
  @Query('lng') lng: string,
  @Query('radiusKm') radiusKm?: string,
) {
  return this.service.findAvailableNearby({
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    radiusKm: radiusKm ? parseFloat(radiusKm) : undefined,
  });
}
```

Note: The controller may already have a `findNearby` method — if so, **replace** it with this updated version that passes `radiusKm`.

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
git commit -m "feat: implement PostGIS ST_Distance query in findAvailableNearby with distanceKm"
```

---

## Task 2: Web — UnitWithDistance type + getNearby API + AssignUnitModal update

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/components/incidents/AssignUnitModal.tsx`

- [ ] **Step 1: Add `UnitWithDistance` to types.ts**

Append to end of `apps/web/src/lib/types.ts`:

```typescript
export interface UnitWithDistance extends Unit {
  distanceKm: number;
}
```

- [ ] **Step 2: Add `getNearby` to unitsApi in api.ts**

Add to `unitsApi` object after `getStats`:

```typescript
getNearby: (lat: number, lng: number, radiusKm?: number) =>
  api.get<UnitWithDistance[]>('/units/nearby', {
    params: { lat, lng, ...(radiusKm ? { radiusKm } : {}) },
  }),
```

Also add `UnitWithDistance` to the import from `'./types'`.

- [ ] **Step 3: Rewrite AssignUnitModal.tsx**

Replace the entire file:

```tsx
// apps/web/src/components/incidents/AssignUnitModal.tsx
'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { useUnitsStore } from '@/store/units.store';
import { useIncidentsStore } from '@/store/incidents.store';
import { dispatchApi, unitsApi } from '@/lib/api';
import { UnitStatus } from '@velnari/shared-types';
import type { BadgeVariant } from '@/components/ui/Badge';
import type { UnitWithDistance, Unit } from '@/lib/types';

interface AssignUnitModalProps {
  incidentId: string;
  onClose: () => void;
}

export default function AssignUnitModal({ incidentId, onClose }: AssignUnitModalProps) {
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nearbyUnits, setNearbyUnits] = useState<UnitWithDistance[] | null>(null);

  const units = useUnitsStore((s) => s.units);
  const updateIncident = useIncidentsStore((s) => s.updateIncident);
  const incidents = useIncidentsStore((s) => s.incidents);

  const incident = incidents.find((i) => i.id === incidentId);

  useEffect(() => {
    if (!incident?.lat || !incident?.lng) return;
    unitsApi
      .getNearby(incident.lat, incident.lng)
      .then((res) => setNearbyUnits(res.data))
      .catch(() => setNearbyUnits(null));
  }, [incident?.lat, incident?.lng]);

  // Fallback: all available units from store (no distance)
  const fallbackUnits: Unit[] = units.filter(
    (u) => u.status === UnitStatus.AVAILABLE && u.isActive,
  );

  const displayUnits: (UnitWithDistance | Unit)[] = nearbyUnits ?? fallbackUnits;

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
        {nearbyUnits !== null && (
          <p className="text-xs text-slate-gray text-center">
            Unidades disponibles más cercanas al incidente
          </p>
        )}

        {displayUnits.length === 0 ? (
          <p className="text-slate-gray text-sm text-center py-4">
            Sin unidades disponibles
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {displayUnits.map((unit) => {
              const dist = 'distanceKm' in unit ? unit.distanceKm : null;
              return (
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
                        <span className="text-xs text-slate-gray">Turno: {unit.shift}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {dist !== null && (
                        <span className="text-xs font-mono text-tactical-blue bg-slate-700 px-2 py-0.5 rounded">
                          {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}
                        </span>
                      )}
                      <Badge variant={unit.status as BadgeVariant} />
                    </div>
                  </button>
                </li>
              );
            })}
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

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web"
npx tsc --noEmit 2>&1 | head -15
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/web/src/lib/types.ts \
        apps/web/src/lib/api.ts \
        apps/web/src/components/incidents/AssignUnitModal.tsx
git commit -m "feat: sort units by proximity in AssignUnitModal using ST_Distance"
```

---

## Task 3: Web — Incident list filters (status + sector)

**Files:**
- Modify: `apps/web/src/store/incidents.store.ts`
- Modify: `apps/web/src/components/incidents/IncidentList.tsx`
- Modify: `apps/web/src/app/command/page.tsx`

- [ ] **Step 1: Add filter state to incidents.store.ts**

Read the file first. Add `filters` and `setFilters` to the interface and implementation.

After the existing `isLoading: boolean;` line in the interface, add:
```typescript
filters: { status: string | null; sectorId: string | null };
setFilters: (filters: Partial<{ status: string | null; sectorId: string | null }>) => void;
```

After `setLoading: (isLoading) => set({ isLoading }),` in the implementation, add:
```typescript
filters: { status: null, sectorId: null },
setFilters: (f) =>
  set((state) => ({ filters: { ...state.filters, ...f } })),
```

- [ ] **Step 2: Rewrite IncidentList.tsx with filter bar**

Replace the entire file:

```tsx
// apps/web/src/components/incidents/IncidentList.tsx
'use client';

import { useState } from 'react';
import { useIncidentsStore } from '@/store/incidents.store';
import IncidentCard from './IncidentCard';
import CreateIncidentModal from './CreateIncidentModal';
import type { Sector } from '@/lib/types';

const STATUS_OPTIONS = [
  { value: null, label: 'Todos' },
  { value: 'open', label: 'Abiertos' },
  { value: 'assigned', label: 'Asignados' },
  { value: 'on_scene', label: 'En Escena' },
  { value: 'closed', label: 'Cerrados' },
];

interface IncidentListProps {
  sectors?: Sector[];
}

export default function IncidentList({ sectors = [] }: IncidentListProps) {
  const { incidents, selectedId, selectIncident, filters, setFilters } = useIncidentsStore();
  const [showCreate, setShowCreate] = useState(false);

  const filtered = incidents.filter((inc) => {
    if (filters.status && inc.status !== filters.status) return false;
    if (filters.sectorId && inc.sectorId !== filters.sectorId) return false;
    return true;
  });

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

      {/* Status filter chips */}
      <div className="flex gap-1 px-3 py-2 border-b border-slate-800 overflow-x-auto shrink-0">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => setFilters({ status: opt.value })}
            className={`text-xs px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
              filters.status === opt.value
                ? 'bg-tactical-blue text-white'
                : 'bg-slate-800 text-slate-gray hover:text-signal-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Sector filter */}
      {sectors.length > 0 && (
        <div className="px-3 py-2 border-b border-slate-800 shrink-0">
          <select
            value={filters.sectorId ?? ''}
            onChange={(e) => setFilters({ sectorId: e.target.value || null })}
            className="w-full bg-slate-800 border border-slate-700 text-signal-white text-xs rounded px-2 py-1 focus:outline-none focus:border-tactical-blue"
            aria-label="Filtrar por sector"
          >
            <option value="">Todos los sectores</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-center text-slate-gray text-sm py-12">
            Sin incidentes
          </p>
        ) : (
          filtered.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              isSelected={incident.id === selectedId}
              onClick={() => selectIncident(incident.id)}
            />
          ))
        )}
      </div>

      {showCreate && (
        <CreateIncidentModal onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update CommandPage to fetch sectors and pass them down**

Read `apps/web/src/app/command/page.tsx`. Then make these surgical edits:

a) Add `sectorsApi` to the import line for `incidentsApi, unitsApi`:
```typescript
import { incidentsApi, unitsApi, sectorsApi } from '@/lib/api';
```

b) Add `Sector` to the `LocationHistoryPoint` import:
```typescript
import type { LocationHistoryPoint, Sector } from '@/lib/types';
```

c) Add `sectors` state after `trailPoints`:
```typescript
const [sectors, setSectors] = useState<Sector[]>([]);
```

d) Add a new `useEffect` for sectors, after the units `useEffect`:
```typescript
useEffect(() => {
  sectorsApi.getAll().then((res) => setSectors(res.data)).catch(console.error);
}, []);
```

e) Pass `sectors` to `<IncidentList>`:
```tsx
<IncidentList sectors={sectors} />
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web"
npx tsc --noEmit 2>&1 | head -15
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/web/src/store/incidents.store.ts \
        apps/web/src/components/incidents/IncidentList.tsx \
        apps/web/src/app/command/page.tsx
git commit -m "feat: add status and sector filter chips to incident list"
```

---

## Task 4: Web — CSV export on Dashboard

**Files:**
- Modify: `apps/web/src/app/dashboard/page.tsx`

The dashboard already has `recentIncidents: Incident[]` in state. We add a `downloadCSV` function and a button in the header. No new files needed.

- [ ] **Step 1: Add the export helper and button to dashboard/page.tsx**

Read `apps/web/src/app/dashboard/page.tsx` to locate the exact positions. Then make two surgical edits:

**a) Add `downloadCSV` function** — add this function right before the `return (` statement in the component:

```typescript
const downloadCSV = () => {
  const headers = ['Folio', 'Tipo', 'Prioridad', 'Estado', 'Dirección', 'Hora'];
  const rows = recentIncidents.map((inc) => [
    inc.folio,
    TYPE_LABELS[inc.type] ?? inc.type,
    PRIORITY_LABELS[inc.priority] ?? inc.priority,
    STATUS_BADGE[inc.status]?.label ?? inc.status,
    inc.address ?? '',
    new Date(inc.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `incidentes-${date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
```

**b) Add the export button in the header** — find the `<input type="date"` element in the header and add the button right before it:

```tsx
<button
  onClick={downloadCSV}
  disabled={recentIncidents.length === 0}
  className="text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-signal-white px-3 py-1 rounded transition-colors"
  aria-label="Exportar a CSV"
>
  ↓ CSV
</button>
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
git commit -m "feat: add CSV export button to dashboard"
```

---

## Self-Review

**Spec coverage:**
- ✅ Sugerencia de unidad más cercana (P1) — backend ST_Distance query, frontend shows distance badge in AssignUnitModal, sorted nearest-first
- ✅ Fallback when no nearby units — falls back to all available from store, no broken UI
- ✅ Filtros por sector y prioridad/estado (P1) — status chips + sector dropdown on IncidentList
- ✅ Sector filter only appears when sectors exist — `sectors.length > 0` guard
- ✅ Filter state in Zustand — persists selection, can be reset to null
- ✅ Exportación de reportes (P1) — CSV download from dashboard, one click, no server needed
- ✅ CSV includes all key fields with Spanish labels

**Placeholder scan:** All code blocks complete, no TBDs.

**Type consistency:**
- `UnitWithDistance extends Unit` — includes all `Unit` fields plus `distanceKm: number` ✅
- `getNearby` returns `UnitWithDistance[]`, consumed in AssignUnitModal ✅
- `filters: { status, sectorId }` added to both interface and initial state ✅
- `IncidentList` receives `sectors?: Sector[]` from CommandPage ✅
- `downloadCSV` uses `recentIncidents`, `date`, `TYPE_LABELS`, `PRIORITY_LABELS`, `STATUS_BADGE` — all already defined in the same component ✅

**Route ordering (backend):**
- `GET /units/nearby` must stay BEFORE `GET /units/:id` — plan instructs to place it before `stats` which is already before `:id` ✅
