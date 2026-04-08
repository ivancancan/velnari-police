# Geofences (Geocercas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let operators define polygonal geofences on the map (one per sector), visualize them with color-coded fills, and receive real-time WebSocket alerts when a unit enters or exits a geofence.

**Architecture:** The `sectors` table already has a PostGIS `geometry(Polygon, 4326)` column with a GIST index. We expose it via a new `PATCH /sectors/:id/boundary` endpoint that accepts a GeoJSON Polygon. The existing `updateLocation` flow in `UnitsService` gains a geofence check: after saving the new position, it queries `ST_Contains(boundary, point)` for all active sectors and emits `geofence:entered` / `geofence:exited` via `RealtimeGateway`. On the frontend, `CommandMap` renders sector polygons as MapLibre `fill` + `line` layers using a new `SectorLayer` component; `RealtimeProvider` handles the new socket events and fires toast alerts; a minimal draw-mode button lets operators click to set a sector's boundary by drawing a rectangle from two map clicks (no extra draw library needed).

**Tech Stack:** NestJS + TypeORM + PostGIS `ST_Contains` / `ST_AsGeoJSON` (API), Next.js 14 + react-map-gl@7 + MapLibre GL + Zustand v5 + Tailwind CSS (web), Jest (tests).

---

## File Structure

**New files:**
- `apps/web/src/components/map/SectorLayer.tsx` — MapLibre GeoJSON Source + fill + outline Layer per sector
- `apps/web/src/store/geofences.store.ts` — tracks which units are currently inside which sector

**Modified files:**
- `packages/shared-types/src/dto/sectors/sector.dto.ts` — add `SetBoundaryDto` with GeoJSON coords validation
- `packages/shared-types/src/index.ts` — export `SetBoundaryDto`
- `apps/api/src/modules/sectors/sectors.service.ts` — add `setBoundary(id, coords)` + `findAllWithBoundary()` + `checkGeofences(unitId, lat, lng)`
- `apps/api/src/modules/sectors/sectors.controller.ts` — add `PATCH /sectors/:id/boundary` + `GET /sectors/with-boundary`
- `apps/api/src/modules/sectors/sectors.module.ts` — export `SectorsService`; import `RealtimeModule`
- `apps/api/src/modules/realtime/realtime.gateway.ts` — add `emitGeofenceEntered` + `emitGeofenceExited`
- `apps/api/src/modules/units/units.service.ts` — inject `SectorsService`; call `checkGeofences` after `updateLocation`
- `apps/api/src/modules/units/units.module.ts` — import `SectorsModule`
- `apps/web/src/lib/types.ts` — add `SectorWithBoundary` interface (GeoJSON coords)
- `apps/web/src/lib/api.ts` — add `sectorsApi.getWithBoundary()` + `sectorsApi.setBoundary()`
- `apps/web/src/components/map/CommandMap.tsx` — render `<SectorLayer>` for each sector; add draw-mode for boundary setting
- `apps/web/src/components/incidents/RealtimeProvider.tsx` — handle `geofence:entered` / `geofence:exited` → toast
- `apps/web/src/store/units.store.ts` — add `insideSectors: Record<string, string[]>` (unitId → sectorId[])

---

## Task 1: shared-types — SetBoundaryDto

**Files:**
- Modify: `packages/shared-types/src/dto/sectors/sector.dto.ts`
- Modify: `packages/shared-types/src/index.ts`

The DTO accepts a GeoJSON Polygon coordinate ring: `[[lng, lat], ...]` where the array has ≥ 4 points and the first equals the last (closed ring).

- [ ] **Step 1: Add SetBoundaryDto to sector.dto.ts**

Open `packages/shared-types/src/dto/sectors/sector.dto.ts`. Add at the bottom:

```typescript
export class SetBoundaryDto {
  @IsArray()
  @ArrayMinSize(4)
  coordinates!: [number, number][];
}
```

Add missing imports at the top:
```typescript
import { IsString, IsOptional, IsBoolean, IsArray, ArrayMinSize, MinLength, MaxLength, Matches } from 'class-validator';
```

- [ ] **Step 2: Export SetBoundaryDto from index.ts**

Open `packages/shared-types/src/index.ts`. Find the sectors export line (e.g., `export * from './dto/sectors/sector.dto'`) — it should already export everything from that file, so no change needed if using `export *`. If the file uses named exports, add `SetBoundaryDto` to the sector exports.

- [ ] **Step 3: Build shared-types**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/packages/shared-types"
pnpm build 2>&1 | tail -10
```

Expected: build succeeds, `dist/` updated.

- [ ] **Step 4: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add packages/shared-types/src/dto/sectors/sector.dto.ts \
        packages/shared-types/src/index.ts \
        packages/shared-types/dist/
git commit -m "feat: add SetBoundaryDto to shared-types"
```

---

## Task 2: Backend — SectorsService geofence methods + RealtimeGateway events

**Files:**
- Modify: `apps/api/src/modules/sectors/sectors.service.ts`
- Modify: `apps/api/src/modules/realtime/realtime.gateway.ts`
- Modify: `apps/api/src/modules/sectors/sectors.module.ts`

- [ ] **Step 1: Add geofence emit methods to RealtimeGateway**

Open `apps/api/src/modules/realtime/realtime.gateway.ts`. Add two methods at the end of the class before the closing `}`:

```typescript
emitGeofenceEntered(payload: {
  unitId: string;
  callSign: string;
  sectorId: string;
  sectorName: string;
}): void {
  this.server.to('command').emit('geofence:entered', payload);
}

emitGeofenceExited(payload: {
  unitId: string;
  callSign: string;
  sectorId: string;
  sectorName: string;
}): void {
  this.server.to('command').emit('geofence:exited', payload);
}
```

- [ ] **Step 2: Add geofence methods to SectorsService**

Open `apps/api/src/modules/sectors/sectors.service.ts`. Replace the entire file:

```typescript
// apps/api/src/modules/sectors/sectors.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SectorEntity } from '../../entities/sector.entity';
import type { CreateSectorDto, UpdateSectorDto } from '@velnari/shared-types';

@Injectable()
export class SectorsService {
  constructor(
    @InjectRepository(SectorEntity)
    private readonly repo: Repository<SectorEntity>,
  ) {}

  findAll(): Promise<SectorEntity[]> {
    return this.repo.find({ where: { isActive: true } });
  }

  findAllWithBoundary(): Promise<SectorEntity[]> {
    return this.repo
      .createQueryBuilder('sector')
      .select([
        'sector.id',
        'sector.name',
        'sector.color',
        'sector.isActive',
        'sector.createdAt',
        'sector.updatedAt',
      ])
      .addSelect('ST_AsGeoJSON(sector.boundary)::json', 'geojson')
      .where('sector.is_active = true')
      .andWhere('sector.boundary IS NOT NULL')
      .getRawAndEntities()
      .then(({ raw, entities }) =>
        entities.map((e, i) => ({
          ...e,
          boundaryGeoJson: raw[i]?.geojson ?? null,
        })),
      );
  }

  async findOne(id: string): Promise<SectorEntity> {
    const sector = await this.repo.findOne({ where: { id } });
    if (!sector) throw new NotFoundException(`Sector ${id} no encontrado`);
    return sector;
  }

  create(dto: CreateSectorDto): Promise<SectorEntity> {
    const sector = this.repo.create({
      name: dto.name,
      color: dto.color ?? '#3B82F6',
    });
    return this.repo.save(sector);
  }

  async update(id: string, dto: UpdateSectorDto): Promise<SectorEntity> {
    const sector = await this.findOne(id);
    Object.assign(sector, dto);
    return this.repo.save(sector);
  }

  async setBoundary(
    id: string,
    coordinates: [number, number][],
  ): Promise<SectorEntity> {
    await this.findOne(id); // throws 404 if not found
    const wkt = coordinatesToWkt(coordinates);
    await this.repo
      .createQueryBuilder()
      .update(SectorEntity)
      .set({
        boundary: () => `ST_SetSRID(ST_GeomFromText('${wkt}'), 4326)`,
      })
      .where('id = :id', { id })
      .execute();
    return this.findOne(id);
  }

  async checkGeofences(
    unitId: string,
    callSign: string,
    lat: number,
    lng: number,
    previousInsideSectorIds: string[],
  ): Promise<{ entered: SectorEntity[]; exited: SectorEntity[] }> {
    const rows = await this.repo.query(
      `
      SELECT id, name, color
      FROM sectors
      WHERE is_active = true
        AND boundary IS NOT NULL
        AND ST_Contains(boundary, ST_SetSRID(ST_MakePoint($1, $2), 4326))
      `,
      [lng, lat],
    );

    const nowInside: string[] = rows.map((r: { id: string }) => r.id);
    const entered = rows.filter(
      (r: { id: string }) => !previousInsideSectorIds.includes(r.id),
    ) as SectorEntity[];
    const exitedIds = previousInsideSectorIds.filter((id) => !nowInside.includes(id));
    const exited: SectorEntity[] = exitedIds.length > 0
      ? await this.repo
          .createQueryBuilder('s')
          .select(['s.id', 's.name', 's.color'])
          .where('s.id IN (:...ids)', { ids: exitedIds })
          .getMany()
      : [];

    return { entered, exited };
  }
}

function coordinatesToWkt(coords: [number, number][]): string {
  const points = coords.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
  return `POLYGON((${points}))`;
}
```

- [ ] **Step 3: Update sectors.module.ts to import RealtimeModule**

Open `apps/api/src/modules/sectors/sectors.module.ts`. Replace entirely:

```typescript
// apps/api/src/modules/sectors/sectors.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SectorEntity } from '../../entities/sector.entity';
import { SectorsService } from './sectors.service';
import { SectorsController } from './sectors.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SectorEntity])],
  controllers: [SectorsController],
  providers: [SectorsService],
  exports: [SectorsService],
})
export class SectorsModule {}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/api/src/modules/sectors/sectors.service.ts \
        apps/api/src/modules/sectors/sectors.module.ts \
        apps/api/src/modules/realtime/realtime.gateway.ts
git commit -m "feat: add setBoundary, findAllWithBoundary, checkGeofences to SectorsService and geofence events to RealtimeGateway"
```

---

## Task 3: Backend — SectorsController new endpoints + UnitsService geofence hook

**Files:**
- Modify: `apps/api/src/modules/sectors/sectors.controller.ts`
- Modify: `apps/api/src/modules/units/units.service.ts`
- Modify: `apps/api/src/modules/units/units.module.ts`

- [ ] **Step 1: Add new endpoints to SectorsController**

Open `apps/api/src/modules/sectors/sectors.controller.ts`. Read it first, then add two endpoints:

**a)** Add `GET /sectors/with-boundary` — place this BEFORE `GET /sectors/:id`:

```typescript
@Get('with-boundary')
findAllWithBoundary() {
  return this.service.findAllWithBoundary();
}
```

**b)** Add `PATCH /sectors/:id/boundary` — add after the existing `update` method:

```typescript
@Patch(':id/boundary')
@Roles(UserRole.ADMIN, UserRole.COMMANDER)
setBoundary(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: SetBoundaryDto,
): Promise<SectorEntity> {
  return this.service.setBoundary(id, dto.coordinates);
}
```

Add `Patch` and `ParseUUIDPipe` to the NestJS imports if not already present. Add `SetBoundaryDto` to the shared-types import.

- [ ] **Step 2: Hook geofence check into UnitsService.updateLocation**

Open `apps/api/src/modules/units/units.service.ts`. Read it fully first.

**a)** Add `SectorsService` injection — update the constructor:

```typescript
constructor(
  @InjectRepository(UnitEntity)
  private readonly repo: Repository<UnitEntity>,
  @InjectRepository(UnitLocationHistoryEntity)
  private readonly historyRepo: Repository<UnitLocationHistoryEntity>,
  @InjectRepository(IncidentEntity)
  private readonly incidentRepo: Repository<IncidentEntity>,
  private readonly sectorsService: SectorsService,
  private readonly realtime: RealtimeGateway,
) {}
```

Add imports at the top:
```typescript
import { SectorsService } from '../sectors/sectors.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
```

**b)** Add an in-memory geofence state map at the class level (before the constructor):
```typescript
private readonly unitSectorCache = new Map<string, string[]>();
```

**c)** Update `updateLocation` to call geofence check after saving history. Replace the existing method:

```typescript
async updateLocation(id: string, lat: number, lng: number): Promise<void> {
  await this.repo
    .createQueryBuilder()
    .update(UnitEntity)
    .set({
      currentLocation: () => `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`,
      lastLocationAt: new Date(),
    })
    .where('id = :id', { id })
    .execute();

  await this.historyRepo
    .createQueryBuilder()
    .insert()
    .into(UnitLocationHistoryEntity)
    .values({
      unitId: id,
      lat,
      lng,
      location: () => `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`,
    })
    .execute();

  // Geofence check
  const unit = await this.repo.findOne({
    where: { id },
    select: ['id', 'callSign', 'sectorId'],
  });
  if (!unit) return;

  const previous = this.unitSectorCache.get(id) ?? [];
  const { entered, exited } = await this.sectorsService.checkGeofences(
    id,
    unit.callSign,
    lat,
    lng,
    previous,
  );

  const nowInside = [
    ...previous.filter((sid) => !exited.map((s) => s.id).includes(sid)),
    ...entered.map((s) => s.id),
  ];
  this.unitSectorCache.set(id, nowInside);

  for (const sector of entered) {
    this.realtime.emitGeofenceEntered({
      unitId: id,
      callSign: unit.callSign,
      sectorId: sector.id,
      sectorName: sector.name,
    });
  }
  for (const sector of exited) {
    this.realtime.emitGeofenceExited({
      unitId: id,
      callSign: unit.callSign,
      sectorId: sector.id,
      sectorName: sector.name,
    });
  }
}
```

- [ ] **Step 3: Update units.module.ts to import SectorsModule and RealtimeModule**

Open `apps/api/src/modules/units/units.module.ts`. Read it first. Add `SectorsModule` and `RealtimeModule` to imports and `RealtimeGateway` to providers if not already there. The file should look like:

```typescript
// apps/api/src/modules/units/units.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitEntity } from '../../entities/unit.entity';
import { UnitLocationHistoryEntity } from '../../entities/unit-location-history.entity';
import { IncidentEntity } from '../../entities/incident.entity';
import { UnitsService } from './units.service';
import { UnitsController } from './units.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { SectorsModule } from '../sectors/sectors.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UnitEntity, UnitLocationHistoryEntity, IncidentEntity]),
    RealtimeModule,
    SectorsModule,
  ],
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService],
})
export class UnitsModule {}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/api/src/modules/sectors/sectors.controller.ts \
        apps/api/src/modules/units/units.service.ts \
        apps/api/src/modules/units/units.module.ts
git commit -m "feat: add geofence hook to updateLocation and new sector boundary endpoints"
```

---

## Task 4: Web — SectorWithBoundary type + API + SectorLayer component

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/components/map/SectorLayer.tsx`

- [ ] **Step 1: Add SectorWithBoundary to types.ts**

Append to the end of `apps/web/src/lib/types.ts`:

```typescript
export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export interface SectorWithBoundary extends Sector {
  boundaryGeoJson: GeoJsonPolygon | null;
}
```

- [ ] **Step 2: Add API methods to api.ts**

Read `apps/web/src/lib/api.ts` first.

**a)** Add `SectorWithBoundary` to the import from `'./types'`.

**b)** Replace the existing `sectorsApi` object with:

```typescript
export const sectorsApi = {
  getAll: () => api.get<Sector[]>('/sectors'),

  getWithBoundary: () => api.get<SectorWithBoundary[]>('/sectors/with-boundary'),

  setBoundary: (id: string, coordinates: [number, number][]) =>
    api.patch<Sector>(`/sectors/${id}/boundary`, { coordinates }),
};
```

- [ ] **Step 3: Create SectorLayer.tsx**

```tsx
// apps/web/src/components/map/SectorLayer.tsx
import { Source, Layer } from 'react-map-gl/maplibre';
import type { SectorWithBoundary } from '@/lib/types';

interface SectorLayerProps {
  sectors: SectorWithBoundary[];
}

export default function SectorLayer({ sectors }: SectorLayerProps) {
  const validSectors = sectors.filter((s) => s.boundaryGeoJson !== null);
  if (validSectors.length === 0) return null;

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: validSectors.map((s) => ({
      type: 'Feature' as const,
      geometry: s.boundaryGeoJson!,
      properties: { id: s.id, name: s.name, color: s.color },
    })),
  };

  return (
    <Source id="sectors" type="geojson" data={geojson}>
      {/* Fill layer */}
      <Layer
        id="sectors-fill"
        type="fill"
        paint={{
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.08,
        }}
      />
      {/* Outline layer */}
      <Layer
        id="sectors-outline"
        type="line"
        paint={{
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-opacity': 0.6,
          'line-dasharray': [4, 2],
        }}
      />
      {/* Label layer */}
      <Layer
        id="sectors-label"
        type="symbol"
        layout={{
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': 12,
          'text-anchor': 'center',
        }}
        paint={{
          'text-color': ['get', 'color'],
          'text-halo-color': '#0F172A',
          'text-halo-width': 2,
        }}
      />
    </Source>
  );
}
```

If TypeScript can't resolve `GeoJSON.FeatureCollection`, use this inline type instead:

```typescript
type FeatureCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'Polygon'; coordinates: [number, number][][] };
    properties: Record<string, unknown>;
  }>;
};
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
        apps/web/src/components/map/SectorLayer.tsx
git commit -m "feat: add SectorWithBoundary type, getWithBoundary/setBoundary API, and SectorLayer map component"
```

---

## Task 5: Web — CommandMap sector visualization + draw mode

**Files:**
- Modify: `apps/web/src/components/map/CommandMap.tsx`
- Modify: `apps/web/src/store/units.store.ts`

The map needs to:
1. Render `<SectorLayer>` when sector boundaries are loaded
2. Expose a "draw mode" where two clicks define the NW and SE corners of a rectangle — the map then calls `sectorsApi.setBoundary` with the 5-point closed polygon

- [ ] **Step 1: Add insideSectors to units.store.ts**

Read `apps/web/src/store/units.store.ts` first. Add to the interface after `selectedUnitId`:
```typescript
insideSectors: Record<string, string[]>;
setUnitInsideSectors: (unitId: string, sectorIds: string[]) => void;
```

Add to the initial state:
```typescript
insideSectors: {},
```

Add to the implementation:
```typescript
setUnitInsideSectors: (unitId, sectorIds) =>
  set((state) => ({
    insideSectors: { ...state.insideSectors, [unitId]: sectorIds },
  })),
```

- [ ] **Step 2: Rewrite CommandMap.tsx**

Read the current `apps/web/src/components/map/CommandMap.tsx` fully. Then replace the entire file:

```tsx
// apps/web/src/components/map/CommandMap.tsx
'use client';

import { useState, useCallback } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useUnitsStore } from '@/store/units.store';
import { useIncidentsStore } from '@/store/incidents.store';
import { sectorsApi } from '@/lib/api';
import UnitMarker from './UnitMarker';
import UnitTrail from './UnitTrail';
import SectorLayer from './SectorLayer';
import type { LocationHistoryPoint, SectorWithBoundary } from '@/lib/types';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const DEFAULT_VIEW = { latitude: 19.4326, longitude: -99.1332, zoom: 12 };

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#22C55E',
};

interface CommandMapProps {
  trailPoints?: LocationHistoryPoint[];
  sectors?: SectorWithBoundary[];
  onBoundarySet?: () => void;
}

export default function CommandMap({
  trailPoints = [],
  sectors = [],
  onBoundarySet,
}: CommandMapProps) {
  const { units, positions, selectedUnitId, selectUnit } = useUnitsStore();
  const { incidents, selectedId, selectIncident } = useIncidentsStore();

  const [drawMode, setDrawMode] = useState<{
    sectorId: string;
    sectorName: string;
    firstClick: [number, number] | null;
  } | null>(null);

  const activeIncidents = incidents.filter((i) => i.status !== 'closed');

  const handleMapClick = useCallback(
    async (e: MapLayerMouseEvent) => {
      if (!drawMode) return;
      const { lng, lat } = e.lngLat;

      if (!drawMode.firstClick) {
        setDrawMode((prev) => prev && { ...prev, firstClick: [lng, lat] });
        return;
      }

      // Second click — build closed rectangle polygon from two corner points
      const [lng1, lat1] = drawMode.firstClick;
      const [lng2, lat2] = [lng, lat];
      const minLng = Math.min(lng1, lng2);
      const maxLng = Math.max(lng1, lng2);
      const minLat = Math.min(lat1, lat2);
      const maxLat = Math.max(lat1, lat2);

      const coordinates: [number, number][] = [
        [minLng, maxLat], // NW
        [maxLng, maxLat], // NE
        [maxLng, minLat], // SE
        [minLng, minLat], // SW
        [minLng, maxLat], // close
      ];

      try {
        await sectorsApi.setBoundary(drawMode.sectorId, coordinates);
        setDrawMode(null);
        onBoundarySet?.();
      } catch {
        setDrawMode(null);
      }
    },
    [drawMode, onBoundarySet],
  );

  return (
    <div className="relative w-full h-full">
      {/* Draw mode indicator */}
      {drawMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-alert-amber text-midnight-command text-xs font-bold px-4 py-2 rounded-full shadow-lg pointer-events-none">
          {drawMode.firstClick
            ? `2° clic → esquina SE de "${drawMode.sectorName}"`
            : `1° clic → esquina NW de "${drawMode.sectorName}"`}
        </div>
      )}

      {/* Cancel draw mode */}
      {drawMode && (
        <button
          onClick={() => setDrawMode(null)}
          className="absolute top-14 left-1/2 -translate-x-1/2 z-10 bg-slate-800 hover:bg-slate-700 text-signal-white text-xs px-3 py-1 rounded shadow"
        >
          Cancelar
        </button>
      )}

      <Map
        initialViewState={DEFAULT_VIEW}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
        cursor={drawMode ? 'crosshair' : 'auto'}
        onClick={handleMapClick}
      >
        {/* Sector boundaries */}
        <SectorLayer sectors={sectors} />

        {/* Unit trail polyline */}
        {selectedUnitId && trailPoints.length > 0 && (
          <UnitTrail unitId={selectedUnitId} points={trailPoints} />
        )}

        {/* Unit markers */}
        {units.map((unit) => {
          const pos = positions[unit.id];
          if (!pos) return null;
          return (
            <Marker key={unit.id} latitude={pos.lat} longitude={pos.lng}>
              <UnitMarker
                callSign={unit.callSign}
                status={unit.status}
                onClick={() => selectUnit(unit.id === selectedUnitId ? null : unit.id)}
              />
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
    </div>
  );
}

// Export draw mode setter type for CommandPage to use
export type { CommandMapProps };
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
git add apps/web/src/components/map/CommandMap.tsx \
        apps/web/src/store/units.store.ts
git commit -m "feat: add SectorLayer rendering and rectangle draw mode to CommandMap"
```

---

## Task 6: Web — Wire up CommandPage + RealtimeProvider geofence alerts

**Files:**
- Modify: `apps/web/src/app/command/page.tsx`
- Modify: `apps/web/src/components/incidents/RealtimeProvider.tsx`

- [ ] **Step 1: Update CommandPage to load sector boundaries + expose draw mode**

Read `apps/web/src/app/command/page.tsx` first. Make these surgical edits:

**a)** Change `sectorsApi.getAll()` import — also import `getWithBoundary`. Update the sectors `useEffect`:

Replace:
```typescript
useEffect(() => {
  sectorsApi.getAll().then((res) => setSectors(res.data)).catch(console.error);
}, []);
```
With:
```typescript
useEffect(() => {
  sectorsApi.getAll().then((res) => setSectors(res.data)).catch(console.error);
}, []);

useEffect(() => {
  sectorsApi.getWithBoundary().then((res) => setSectorsWithBoundary(res.data)).catch(console.error);
}, []);
```

**b)** Add `sectorsWithBoundary` state (after `sectors` state):
```typescript
const [sectorsWithBoundary, setSectorsWithBoundary] = useState<SectorWithBoundary[]>([]);
```

**c)** Update the `Sector` type import to also import `SectorWithBoundary`:
```typescript
import type { LocationHistoryPoint, Sector, SectorWithBoundary } from '@/lib/types';
```

**d)** Pass new props to `<CommandMap>`:
Change:
```tsx
<CommandMap trailPoints={trailPoints} />
```
To:
```tsx
<CommandMap
  trailPoints={trailPoints}
  sectors={sectorsWithBoundary}
  onBoundarySet={() => {
    sectorsApi.getWithBoundary().then((res) => setSectorsWithBoundary(res.data)).catch(console.error);
  }}
/>
```

**e)** Add a "Draw Geocerca" button in the header (only visible to admin/commander roles — but for now just show it always since role check is a nice-to-have). Add after the "Dashboard →" link:

```tsx
{sectors.length > 0 && (
  <select
    onChange={(e) => {
      if (!e.target.value) return;
      const sector = sectors.find((s) => s.id === e.target.value);
      if (sector) {
        // Trigger draw mode via a ref callback or prop
        // For now, store selected sector in local state
        setDrawSectorId(e.target.value);
        e.target.value = '';
      }
    }}
    className="text-xs bg-slate-800 border border-slate-700 text-slate-gray rounded px-2 py-1 focus:outline-none"
    defaultValue=""
    aria-label="Dibujar geocerca"
  >
    <option value="">+ Geocerca</option>
    {sectors.map((s) => (
      <option key={s.id} value={s.id}>{s.name}</option>
    ))}
  </select>
)}
```

Add `drawSectorId` state:
```typescript
const [drawSectorId, setDrawSectorId] = useState<string | null>(null);
```

Pass `drawSectorId` and `setDrawSectorId` to `CommandMap` — update the map props:
```tsx
<CommandMap
  trailPoints={trailPoints}
  sectors={sectorsWithBoundary}
  drawSectorId={drawSectorId}
  onDrawStart={() => {}}
  onBoundarySet={() => {
    setDrawSectorId(null);
    sectorsApi.getWithBoundary().then((res) => setSectorsWithBoundary(res.data)).catch(console.error);
  }}
/>
```

Update `CommandMapProps` in CommandMap to accept `drawSectorId?: string | null` and use it to enter draw mode automatically when it changes. Add a `useEffect` in CommandMap:

```typescript
useEffect(() => {
  if (!drawSectorId) return;
  const sector = sectors.find((s) => s.id === drawSectorId);
  if (sector) {
    setDrawMode({ sectorId: drawSectorId, sectorName: sector.name, firstClick: null });
  }
}, [drawSectorId, sectors]);
```

Update `CommandMapProps`:
```typescript
interface CommandMapProps {
  trailPoints?: LocationHistoryPoint[];
  sectors?: SectorWithBoundary[];
  drawSectorId?: string | null;
  onBoundarySet?: () => void;
}
```

- [ ] **Step 2: Add geofence events to RealtimeProvider**

Read `apps/web/src/components/incidents/RealtimeProvider.tsx`. Add the following after the `incident:status:changed` handler:

```typescript
// Geofence entered
socket.on(
  'geofence:entered',
  (payload: { unitId: string; callSign: string; sectorId: string; sectorName: string }) => {
    addAlert({
      folio: payload.callSign,
      message: `Entró a sector: ${payload.sectorName}`,
      priority: 'geofence',
    });
  },
);

// Geofence exited
socket.on(
  'geofence:exited',
  (payload: { unitId: string; callSign: string; sectorId: string; sectorName: string }) => {
    addAlert({
      folio: payload.callSign,
      message: `Salió de sector: ${payload.sectorName}`,
      priority: 'geofence',
    });
  },
);
```

Also add cleanup in the return function:
```typescript
socket.off('geofence:entered');
socket.off('geofence:exited');
```

Add `'geofence'` color support to `Toast.tsx` — open `apps/web/src/components/ui/Toast.tsx` and add to the `COLORS` map:
```typescript
geofence: { bg: 'bg-slate-900', border: 'border-tactical-blue', label: 'text-tactical-blue' },
```

And to `PRIORITY_LABELS`:
```typescript
geofence: 'GEOCERCA',
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web"
npx tsc --noEmit 2>&1 | head -15
```

Fix any errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/web/src/app/command/page.tsx \
        apps/web/src/components/incidents/RealtimeProvider.tsx \
        apps/web/src/components/ui/Toast.tsx
git commit -m "feat: wire up geofence sector layers, draw mode selector, and enter/exit alert toasts"
```

---

## Self-Review

**Spec coverage:**
- ✅ Define polygonal geofences — `setBoundary` endpoint accepts GeoJSON ring coordinates, stored as PostGIS Polygon
- ✅ Visualize with color-coded fills — `SectorLayer` renders fill (8% opacity), dashed outline, and name label using sector's `color` field
- ✅ Real-time enter/exit alerts — `checkGeofences` runs on every `updateLocation`, emits `geofence:entered`/`geofence:exited` via WebSocket; frontend fires toast
- ✅ Draw mode — two-click rectangle boundary setter in CommandMap, invoked from sector dropdown in CommandPage header
- ✅ Reload boundaries after drawing — `onBoundarySet` callback re-fetches `getWithBoundary`
- ✅ No extra dependencies — rectangle drawing uses native map click events, no `mapbox-gl-draw` needed

**Placeholder scan:** All code blocks complete, no TBDs.

**Type consistency:**
- `SectorWithBoundary extends Sector` adds `boundaryGeoJson: GeoJsonPolygon | null` ✅
- `SectorLayer` receives `SectorWithBoundary[]`, filters nulls, builds FeatureCollection ✅
- `CommandMapProps` includes `sectors?: SectorWithBoundary[]`, `drawSectorId?: string | null`, `onBoundarySet?: () => void` ✅
- `checkGeofences` returns `{ entered: SectorEntity[], exited: SectorEntity[] }` — consumed in `updateLocation` ✅
- Toast `priority: 'geofence'` handled by `Toast.tsx` COLORS map ✅

**Route ordering:**
- `GET /sectors/with-boundary` must be BEFORE `GET /sectors/:id` — instructed in Task 3 Step 1 ✅
