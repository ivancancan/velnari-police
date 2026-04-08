# Unit Tracking Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unit detail panel that lets operators click any police unit to see its movement trail on the map and its incident history, filterable by date.

**Architecture:** Backend adds a `unit_location_history` table — every location update inserts a row. Two new API endpoints serve history and incidents filtered by date. Frontend adds a selected-unit state: clicking a marker opens a side panel with a date picker; the map renders a polyline trail from history data; the panel lists incidents the unit responded to that day.

**Tech Stack:** NestJS + TypeORM + PostGIS (API), Next.js 14 App Router + react-map-gl@7 + MapLibre GL + Zustand v5 (web), Jest + Testing Library (tests).

---

## File Structure

**New files:**
- `apps/api/src/database/migrations/003_unit_location_history.ts` — migration for the history table
- `apps/api/src/entities/unit-location-history.entity.ts` — TypeORM entity
- `apps/web/src/components/map/UnitTrail.tsx` — MapLibre Source+Layer polyline for unit trail
- `apps/web/src/components/units/UnitDetailPanel.tsx` — sidebar panel: unit info + date picker + incidents

**Modified files:**
- `apps/api/src/modules/units/units.service.ts` — inject history repo + incident repo; save history on every location update; add `getHistory` and `getIncidentsByUnit` methods
- `apps/api/src/modules/units/units.controller.ts` — add `GET /units/:id/history` and `GET /units/:id/incidents` endpoints
- `apps/api/src/modules/units/units.module.ts` — add `UnitLocationHistoryEntity` and `IncidentEntity` to `TypeOrmModule.forFeature`
- `apps/web/src/lib/types.ts` — add `LocationHistoryPoint` interface
- `apps/web/src/lib/api.ts` — add `unitsApi.getHistory()` and `unitsApi.getIncidentsByUnit()`
- `apps/web/src/store/units.store.ts` — add `selectedUnitId`, `selectUnit`, `clearUnitSelection`
- `apps/web/src/components/map/CommandMap.tsx` — make unit markers clickable; render `<UnitTrail>` when unit selected
- `apps/web/src/app/command/page.tsx` — load units on mount; toggle sidebar between IncidentList and UnitDetailPanel

---

### Task 1: DB Migration — unit_location_history table

**Files:**
- Create: `apps/api/src/database/migrations/003_unit_location_history.ts`

- [ ] **Step 1: Write the migration file**

```typescript
// apps/api/src/database/migrations/003_unit_location_history.ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UnitLocationHistory1704240000000 implements MigrationInterface {
  name = 'UnitLocationHistory1704240000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "unit_location_history" (
        "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "unit_id"     UUID NOT NULL REFERENCES "units"("id") ON DELETE CASCADE,
        "lat"         DECIMAL(10,7) NOT NULL,
        "lng"         DECIMAL(10,7) NOT NULL,
        "location"    geometry(Point, 4326),
        "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_location_history_unit_time"
        ON "unit_location_history" ("unit_id", "recorded_at" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "unit_location_history"`);
  }
}
```

- [ ] **Step 2: Run the migration**

```bash
cd apps/api
pnpm db:migrate
```

Expected output:
```
Migration UnitLocationHistory1704240000000 has been executed successfully.
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/database/migrations/003_unit_location_history.ts
git commit -m "feat: add unit_location_history migration"
```

---

### Task 2: UnitLocationHistory Entity

**Files:**
- Create: `apps/api/src/entities/unit-location-history.entity.ts`

- [ ] **Step 1: Create the entity**

```typescript
// apps/api/src/entities/unit-location-history.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UnitEntity } from './unit.entity';

@Entity('unit_location_history')
export class UnitLocationHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId!: string;

  @ManyToOne(() => UnitEntity, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit?: UnitEntity;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lat!: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lng!: number;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
    select: false,
  })
  location?: string;

  @CreateDateColumn({ name: 'recorded_at' })
  recordedAt!: Date;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/entities/unit-location-history.entity.ts
git commit -m "feat: add UnitLocationHistoryEntity"
```

---

### Task 3: UnitsService — history storage + query methods

**Files:**
- Modify: `apps/api/src/modules/units/units.service.ts`
- Modify: `apps/api/src/modules/units/units.service.spec.ts`

The service needs to:
1. Inject `UnitLocationHistoryEntity` repo and `IncidentEntity` repo.
2. In `updateLocation`, also insert a history row.
3. Add `getHistory(id, from, to)` — returns location history points for a date range.
4. Add `getIncidentsByUnit(id, from, to)` — returns incidents assigned to this unit within a date range.

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/modules/units/units.service.spec.ts`, add after the existing tests:

```typescript
// At the top, add imports:
import { UnitLocationHistoryEntity } from '../../entities/unit-location-history.entity';
import { IncidentEntity } from '../../entities/incident.entity';

// In the describe block, add mock repos:
const mockHistoryRepo = {
  createQueryBuilder: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
};

const mockIncidentRepo = {
  find: jest.fn(),
};

// Update the beforeEach providers array to add the new repos:
// { provide: getRepositoryToken(UnitLocationHistoryEntity), useValue: mockHistoryRepo },
// { provide: getRepositoryToken(IncidentEntity), useValue: mockIncidentRepo },

// Add these test cases:
describe('getHistory', () => {
  it('retorna puntos de historial en el rango dado', async () => {
    const point = {
      id: 'h-1',
      unitId: 'unit-uuid-1',
      lat: 19.4326,
      lng: -99.1332,
      recordedAt: new Date('2026-04-07T10:00:00Z'),
    };
    mockHistoryRepo.find.mockResolvedValue([point]);
    const from = new Date('2026-04-07T00:00:00Z');
    const to = new Date('2026-04-07T23:59:59Z');
    const result = await service.getHistory('unit-uuid-1', from, to);
    expect(result).toHaveLength(1);
    expect(mockHistoryRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ unitId: 'unit-uuid-1' }) }),
    );
  });
});

describe('getIncidentsByUnit', () => {
  it('retorna incidentes asignados a la unidad en el rango dado', async () => {
    const incident = {
      id: 'inc-1',
      folio: 'IC-001',
      assignedUnitId: 'unit-uuid-1',
      assignedAt: new Date('2026-04-07T10:30:00Z'),
    };
    mockIncidentRepo.find.mockResolvedValue([incident]);
    const from = new Date('2026-04-07T00:00:00Z');
    const to = new Date('2026-04-07T23:59:59Z');
    const result = await service.getIncidentsByUnit('unit-uuid-1', from, to);
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api
TS_NODE_PROJECT=tsconfig.jest.json npx jest units.service --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `service.getHistory is not a function`

- [ ] **Step 3: Update the full units.service.ts**

Replace the entire file content:

```typescript
// apps/api/src/modules/units/units.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { UnitEntity } from '../../entities/unit.entity';
import { UnitLocationHistoryEntity } from '../../entities/unit-location-history.entity';
import { IncidentEntity } from '../../entities/incident.entity';
import { UnitStatus, CreateUnitDto } from '@velnari/shared-types';

interface FindAllFilters {
  status?: UnitStatus;
  sectorId?: string;
  shift?: string;
}

interface NearbyPoint {
  lat: number;
  lng: number;
  radiusKm?: number;
}

@Injectable()
export class UnitsService {
  constructor(
    @InjectRepository(UnitEntity)
    private readonly repo: Repository<UnitEntity>,
    @InjectRepository(UnitLocationHistoryEntity)
    private readonly historyRepo: Repository<UnitLocationHistoryEntity>,
    @InjectRepository(IncidentEntity)
    private readonly incidentRepo: Repository<IncidentEntity>,
  ) {}

  findAll(filters: FindAllFilters): Promise<UnitEntity[]> {
    const where: Record<string, unknown> = { isActive: true };
    if (filters.status) where['status'] = filters.status;
    if (filters.sectorId) where['sectorId'] = filters.sectorId;
    if (filters.shift) where['shift'] = filters.shift;
    return this.repo.find({ where });
  }

  async findOne(id: string): Promise<UnitEntity> {
    const unit = await this.repo.findOne({ where: { id } });
    if (!unit) throw new NotFoundException(`Unidad ${id} no encontrada`);
    return unit;
  }

  async findByCallSign(callSign: string): Promise<UnitEntity | null> {
    return this.repo.findOne({ where: { callSign } });
  }

  create(dto: CreateUnitDto): Promise<UnitEntity> {
    const unit = this.repo.create({
      callSign: dto.callSign,
      status: dto.status ?? UnitStatus.AVAILABLE,
      sectorId: dto.sectorId,
      shift: dto.shift,
      assignedUserId: dto.assignedUserId,
    });
    return this.repo.save(unit);
  }

  async updateStatus(id: string, status: UnitStatus): Promise<UnitEntity> {
    const unit = await this.findOne(id);
    unit.status = status;
    return this.repo.save(unit);
  }

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

    // Persist history point
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
  }

  getHistory(id: string, from: Date, to: Date): Promise<UnitLocationHistoryEntity[]> {
    return this.historyRepo.find({
      where: { unitId: id, recordedAt: Between(from, to) },
      order: { recordedAt: 'ASC' },
      select: ['id', 'lat', 'lng', 'recordedAt'],
    });
  }

  getIncidentsByUnit(id: string, from: Date, to: Date): Promise<IncidentEntity[]> {
    return this.incidentRepo.find({
      where: {
        assignedUnitId: id,
        assignedAt: Between(from, to),
      },
      order: { assignedAt: 'DESC' },
    });
  }

  findAvailableNearby(point: NearbyPoint): Promise<UnitEntity[]> {
    void point;
    return this.repo.find({
      where: { status: UnitStatus.AVAILABLE, isActive: true },
    });
  }
}
```

- [ ] **Step 4: Update the full units.service.spec.ts**

Replace the entire file:

```typescript
// apps/api/src/modules/units/units.service.spec.ts
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { UnitsService } from './units.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnitEntity } from '../../entities/unit.entity';
import { UnitLocationHistoryEntity } from '../../entities/unit-location-history.entity';
import { IncidentEntity } from '../../entities/incident.entity';
import { NotFoundException } from '@nestjs/common';
import { UnitStatus } from '@velnari/shared-types';

describe('UnitsService', () => {
  let service: UnitsService;

  const mockUnit: UnitEntity = {
    id: 'unit-uuid-1',
    callSign: 'P-14',
    status: UnitStatus.AVAILABLE,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockHistoryRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockIncidentRepo = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnitsService,
        { provide: getRepositoryToken(UnitEntity), useValue: mockRepo },
        { provide: getRepositoryToken(UnitLocationHistoryEntity), useValue: mockHistoryRepo },
        { provide: getRepositoryToken(IncidentEntity), useValue: mockIncidentRepo },
      ],
    }).compile();

    service = module.get<UnitsService>(UnitsService);
    jest.clearAllMocks();
  });

  it('findAll retorna unidades activas', async () => {
    mockRepo.find.mockResolvedValue([mockUnit]);
    const result = await service.findAll({});
    expect(result).toHaveLength(1);
  });

  it('findOne retorna unidad por id', async () => {
    mockRepo.findOne.mockResolvedValue(mockUnit);
    const result = await service.findOne('unit-uuid-1');
    expect(result.callSign).toBe('P-14');
  });

  it('findOne lanza NotFoundException si no existe', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
  });

  it('updateStatus cambia el estado de la unidad', async () => {
    const updatedUnit = { ...mockUnit, status: UnitStatus.EN_ROUTE };
    mockRepo.findOne.mockResolvedValue({ ...mockUnit });
    mockRepo.save.mockResolvedValue(updatedUnit);
    const result = await service.updateStatus('unit-uuid-1', UnitStatus.EN_ROUTE);
    expect(result.status).toBe(UnitStatus.EN_ROUTE);
  });

  it('findAvailableNearby retorna unidades disponibles', async () => {
    mockRepo.find.mockResolvedValue([mockUnit]);
    const result = await service.findAvailableNearby({ lat: 19.4, lng: -99.1 });
    expect(result).toHaveLength(1);
  });

  describe('updateLocation', () => {
    it('llama a createQueryBuilder para actualizar la ubicación y guardar historial', async () => {
      const qbUnit = { update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({}) };
      const qbHistory = { insert: jest.fn().mockReturnThis(), into: jest.fn().mockReturnThis(), values: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({}) };
      mockRepo.createQueryBuilder.mockReturnValue(qbUnit);
      mockHistoryRepo.createQueryBuilder.mockReturnValue(qbHistory);
      await service.updateLocation('unit-uuid-1', 19.4326, -99.1332);
      expect(qbUnit.execute).toHaveBeenCalled();
      expect(qbHistory.execute).toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('retorna puntos de historial en el rango dado', async () => {
      const point = { id: 'h-1', unitId: 'unit-uuid-1', lat: 19.4326, lng: -99.1332, recordedAt: new Date() };
      mockHistoryRepo.find.mockResolvedValue([point]);
      const from = new Date('2026-04-07T00:00:00Z');
      const to = new Date('2026-04-07T23:59:59Z');
      const result = await service.getHistory('unit-uuid-1', from, to);
      expect(result).toHaveLength(1);
      expect(mockHistoryRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ unitId: 'unit-uuid-1' }) }),
      );
    });
  });

  describe('getIncidentsByUnit', () => {
    it('retorna incidentes asignados a la unidad en el rango dado', async () => {
      const incident = { id: 'inc-1', folio: 'IC-001', assignedUnitId: 'unit-uuid-1', assignedAt: new Date() };
      mockIncidentRepo.find.mockResolvedValue([incident]);
      const from = new Date('2026-04-07T00:00:00Z');
      const to = new Date('2026-04-07T23:59:59Z');
      const result = await service.getIncidentsByUnit('unit-uuid-1', from, to);
      expect(result).toHaveLength(1);
    });
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api
TS_NODE_PROJECT=tsconfig.jest.json npx jest units.service --no-coverage 2>&1 | tail -15
```

Expected: PASS — all tests green

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/units/units.service.ts apps/api/src/modules/units/units.service.spec.ts
git commit -m "feat: persist location history and add getHistory/getIncidentsByUnit to UnitsService"
```

---

### Task 4: UnitsModule + UnitsController — new endpoints

**Files:**
- Modify: `apps/api/src/modules/units/units.module.ts`
- Modify: `apps/api/src/modules/units/units.controller.ts`

- [ ] **Step 1: Update units.module.ts**

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

@Module({
  imports: [
    TypeOrmModule.forFeature([UnitEntity, UnitLocationHistoryEntity, IncidentEntity]),
    RealtimeModule,
  ],
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService],
})
export class UnitsModule {}
```

- [ ] **Step 2: Add the two new endpoints to units.controller.ts**

Add these two methods inside the `UnitsController` class, after the existing `updateLocation` method:

```typescript
  @Get(':id/history')
  getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = from ? new Date(from) : startOfDay(new Date());
    const toDate = to ? new Date(to) : endOfDay(new Date());
    return this.service.getHistory(id, fromDate, toDate);
  }

  @Get(':id/incidents')
  getIncidentsByUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = from ? new Date(from) : startOfDay(new Date());
    const toDate = to ? new Date(to) : endOfDay(new Date());
    return this.service.getIncidentsByUnit(id, fromDate, toDate);
  }
```

Also add these helper functions at the top of the controller file (before the class, after imports):

```typescript
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
```

- [ ] **Step 3: Verify the API compiles and endpoints respond**

Wait for Nest watch to recompile, then:

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@velnari.mx","password":"Velnari2024!"}' \
  | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d).accessToken)")

UNIT_ID=$(curl -s http://localhost:3001/api/units \
  -H "Authorization: Bearer $TOKEN" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d)[0].id)")

curl -s "http://localhost:3001/api/units/$UNIT_ID/history" \
  -H "Authorization: Bearer $TOKEN" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const r=JSON.parse(d); console.log('history points:', Array.isArray(r) ? r.length : r)"
```

Expected: `history points: N` (N ≥ 0, returns an array)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/units/units.module.ts apps/api/src/modules/units/units.controller.ts
git commit -m "feat: add GET /units/:id/history and GET /units/:id/incidents endpoints"
```

---

### Task 5: Web — types + api + store

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/store/units.store.ts`

- [ ] **Step 1: Add LocationHistoryPoint to types.ts**

Add at the end of `apps/web/src/lib/types.ts`:

```typescript
export interface LocationHistoryPoint {
  id: string;
  lat: number;
  lng: number;
  recordedAt: string;
}
```

- [ ] **Step 2: Add API methods to api.ts**

In `apps/web/src/lib/api.ts`, extend the `unitsApi` object:

```typescript
export const unitsApi = {
  getAll: (params?: { status?: string; sectorId?: string }) =>
    api.get<Unit[]>('/units', { params }),

  getById: (id: string) => api.get<Unit>(`/units/${id}`),

  updateStatus: (id: string, status: UnitStatus) =>
    api.patch<Unit>(`/units/${id}/status`, { status }),

  getHistory: (id: string, from: string, to: string) =>
    api.get<LocationHistoryPoint[]>(`/units/${id}/history`, { params: { from, to } }),

  getIncidentsByUnit: (id: string, from: string, to: string) =>
    api.get<Incident[]>(`/units/${id}/incidents`, { params: { from, to } }),
};
```

Also add `LocationHistoryPoint` to the import from `./types`:

```typescript
import type { Unit, UnitPosition, IncidentEvent, Incident, Sector, LocationHistoryPoint } from './types';
```

- [ ] **Step 3: Add selectedUnit state to units.store.ts**

Replace the entire file:

```typescript
// apps/web/src/store/units.store.ts
import { create } from 'zustand';
import type { Unit, UnitPosition } from '@/lib/types';

interface UnitsState {
  units: Unit[];
  positions: Record<string, UnitPosition>;
  isLoading: boolean;
  selectedUnitId: string | null;
  setUnits: (units: Unit[]) => void;
  updateUnit: (updated: Unit) => void;
  updatePosition: (position: UnitPosition) => void;
  setLoading: (loading: boolean) => void;
  selectUnit: (id: string | null) => void;
}

export const useUnitsStore = create<UnitsState>()((set) => ({
  units: [],
  positions: {},
  isLoading: false,
  selectedUnitId: null,

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

  selectUnit: (id) => set({ selectedUnitId: id }),
}));
```

- [ ] **Step 4: Run the web tests to ensure no regressions**

```bash
cd apps/web
TS_NODE_PROJECT=tsconfig.jest.json npx jest --no-coverage 2>&1 | tail -15
```

Expected: all existing tests still PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts apps/web/src/store/units.store.ts
git commit -m "feat: add LocationHistoryPoint type, history/incidents API methods, selectedUnitId to store"
```

---

### Task 6: UnitTrail — map polyline component

**Files:**
- Create: `apps/web/src/components/map/UnitTrail.tsx`

This component receives an array of `LocationHistoryPoint` and renders a blue polyline on the MapLibre map using react-map-gl's `Source` and `Layer`.

- [ ] **Step 1: Create UnitTrail.tsx**

```tsx
// apps/web/src/components/map/UnitTrail.tsx
import { Source, Layer } from 'react-map-gl/maplibre';
import type { LocationHistoryPoint } from '@/lib/types';

interface UnitTrailProps {
  unitId: string;
  points: LocationHistoryPoint[];
}

export default function UnitTrail({ unitId, points }: UnitTrailProps) {
  if (points.length < 2) return null;

  const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: points.map((p) => [Number(p.lng), Number(p.lat)]),
    },
    properties: {},
  };

  return (
    <Source id={`trail-${unitId}`} type="geojson" data={geojson}>
      <Layer
        id={`trail-line-${unitId}`}
        type="line"
        paint={{
          'line-color': '#3B82F6',
          'line-width': 3,
          'line-opacity': 0.75,
          'line-dasharray': [2, 1],
        }}
        layout={{ 'line-join': 'round', 'line-cap': 'round' }}
      />
    </Source>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/map/UnitTrail.tsx
git commit -m "feat: add UnitTrail map polyline component"
```

---

### Task 7: UnitDetailPanel component

**Files:**
- Create: `apps/web/src/components/units/UnitDetailPanel.tsx`

This component shows:
- Unit name, status badge, shift
- Date picker (native `<input type="date">`, defaults to today)
- Number of location points recorded that day
- List of incidents the unit was assigned to that day (folio, type, priority, address, time)
- A "← Volver" button to clear the selection

- [ ] **Step 1: Create UnitDetailPanel.tsx**

```tsx
// apps/web/src/components/units/UnitDetailPanel.tsx
'use client';

import { useEffect, useState } from 'react';
import { useUnitsStore } from '@/store/units.store';
import { unitsApi } from '@/lib/api';
import type { LocationHistoryPoint, Incident, Unit } from '@/lib/types';

const STATUS_LABELS: Record<string, string> = {
  available: 'Disponible',
  en_route: 'En ruta',
  on_scene: 'En escena',
  out_of_service: 'Fuera de servicio',
};

const STATUS_COLORS: Record<string, string> = {
  available: 'text-green-400',
  en_route: 'text-blue-400',
  on_scene: 'text-amber-400',
  out_of_service: 'text-slate-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-amber-400',
  low: 'text-green-400',
};

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`;
}

function endOfDay(dateStr: string): string {
  return `${dateStr}T23:59:59.999Z`;
}

interface UnitDetailPanelProps {
  unit: Unit;
  onTrailChange: (points: LocationHistoryPoint[]) => void;
}

export default function UnitDetailPanel({ unit, onTrailChange }: UnitDetailPanelProps) {
  const { selectUnit } = useUnitsStore();
  const [date, setDate] = useState<string>(toDateString(new Date()));
  const [history, setHistory] = useState<LocationHistoryPoint[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const from = startOfDay(date);
    const to = endOfDay(date);

    Promise.all([
      unitsApi.getHistory(unit.id, from, to),
      unitsApi.getIncidentsByUnit(unit.id, from, to),
    ])
      .then(([histRes, incRes]) => {
        setHistory(histRes.data);
        setIncidents(incRes.data);
        onTrailChange(histRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [unit.id, date, onTrailChange]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { selectUnit(null); onTrailChange([]); }}
            className="text-slate-gray hover:text-signal-white transition-colors text-sm"
            aria-label="Volver a incidentes"
          >
            ←
          </button>
          <span className="font-bold text-signal-white font-mono">{unit.callSign}</span>
          <span className={`text-xs ${STATUS_COLORS[unit.status] ?? 'text-slate-gray'}`}>
            {STATUS_LABELS[unit.status] ?? unit.status}
          </span>
        </div>
        <input
          type="date"
          value={date}
          max={toDateString(new Date())}
          onChange={(e) => setDate(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-signal-white text-xs focus:outline-none focus:border-tactical-blue"
          aria-label="Filtrar por fecha"
        />
      </div>

      {/* Stats row */}
      <div className="flex gap-4 px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="text-center">
          <p className="text-2xl font-bold text-tactical-blue font-mono">{history.length}</p>
          <p className="text-xs text-slate-gray">Puntos GPS</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-alert-amber font-mono">{incidents.length}</p>
          <p className="text-xs text-slate-gray">Incidentes</p>
        </div>
        {unit.shift && (
          <div className="text-center">
            <p className="text-sm font-semibold text-signal-white">{unit.shift}</p>
            <p className="text-xs text-slate-gray">Turno</p>
          </div>
        )}
      </div>

      {/* Incidents list */}
      <div className="flex-1 overflow-y-auto">
        <p className="px-4 py-2 text-xs font-semibold text-slate-gray uppercase tracking-widest border-b border-slate-800">
          Incidentes del día
        </p>

        {loading && (
          <p className="text-center text-slate-gray text-sm py-8">Cargando...</p>
        )}

        {!loading && incidents.length === 0 && (
          <p className="text-center text-slate-gray text-sm py-12">
            Sin incidentes registrados
          </p>
        )}

        {!loading && incidents.map((incident) => (
          <div
            key={incident.id}
            className="px-4 py-3 border-b border-slate-800 hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-xs text-signal-white font-bold">{incident.folio}</span>
              <span className={`text-xs font-semibold uppercase ${PRIORITY_COLORS[incident.priority] ?? 'text-slate-gray'}`}>
                {incident.priority}
              </span>
            </div>
            <p className="text-xs text-slate-gray truncate">{incident.address ?? '—'}</p>
            <p className="text-xs text-slate-500 mt-1">
              {incident.assignedAt
                ? new Date(incident.assignedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                : '—'}
              {' · '}
              <span className="capitalize">{incident.type?.replace('_', ' ') ?? ''}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/units/UnitDetailPanel.tsx
git commit -m "feat: add UnitDetailPanel with date picker, GPS stats, and incident history"
```

---

### Task 8: Wire up CommandMap + CommandPage

**Files:**
- Modify: `apps/web/src/components/map/CommandMap.tsx`
- Modify: `apps/web/src/app/command/page.tsx`

**CommandMap changes:**
- Import `useUnitsStore` `selectUnit`, `selectedUnitId`
- Pass `onClick` to each `UnitMarker` to call `selectUnit(unit.id)`
- When `selectedUnitId` is set, render `<UnitTrail>` inside the Map

**CommandPage changes:**
- Load units on mount via `unitsApi.getAll()` → `setUnits()`
- Hold `trailPoints` state (`LocationHistoryPoint[]`)
- Show `<UnitDetailPanel>` in sidebar when a unit is selected, otherwise show `<IncidentList>`

- [ ] **Step 1: Update CommandMap.tsx**

```tsx
// apps/web/src/components/map/CommandMap.tsx
'use client';

import Map, { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useUnitsStore } from '@/store/units.store';
import { useIncidentsStore } from '@/store/incidents.store';
import UnitMarker from './UnitMarker';
import UnitTrail from './UnitTrail';
import type { LocationHistoryPoint } from '@/lib/types';

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
}

export default function CommandMap({ trailPoints = [] }: CommandMapProps) {
  const { units, positions, selectedUnitId, selectUnit } = useUnitsStore();
  const { incidents, selectedId, selectIncident } = useIncidentsStore();

  const activeIncidents = incidents.filter((i) => i.status !== 'closed');

  return (
    <Map
      initialViewState={DEFAULT_VIEW}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLE}
    >
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
  );
}
```

- [ ] **Step 2: Update CommandPage**

```tsx
// apps/web/src/app/command/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useIncidentsStore } from '@/store/incidents.store';
import { useUnitsStore } from '@/store/units.store';
import { incidentsApi, unitsApi } from '@/lib/api';
import dynamic from 'next/dynamic';
import IncidentList from '@/components/incidents/IncidentList';
import RealtimeProvider from '@/components/incidents/RealtimeProvider';
import UnitDetailPanel from '@/components/units/UnitDetailPanel';
import type { LocationHistoryPoint } from '@/lib/types';

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
  const { setIncidents, setLoading } = useIncidentsStore();
  const { setUnits, units, selectedUnitId } = useUnitsStore();
  const [trailPoints, setTrailPoints] = useState<LocationHistoryPoint[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    setLoading(true);
    incidentsApi
      .getAll()
      .then((res) => setIncidents(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [setIncidents, setLoading]);

  useEffect(() => {
    unitsApi
      .getAll()
      .then((res) => setUnits(res.data))
      .catch(console.error);
  }, [setUnits]);

  if (!isAuthenticated) return null;

  const selectedUnit = selectedUnitId
    ? units.find((u) => u.id === selectedUnitId) ?? null
    : null;

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
            <CommandMap trailPoints={trailPoints} />
          </div>

          <aside className="w-[380px] shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">
            {selectedUnit ? (
              <UnitDetailPanel
                unit={selectedUnit}
                onTrailChange={setTrailPoints}
              />
            ) : (
              <IncidentList />
            )}
          </aside>
        </div>
      </div>
    </RealtimeProvider>
  );
}
```

- [ ] **Step 3: Run the web tests to verify no regressions**

```bash
cd apps/web
TS_NODE_PROJECT=tsconfig.jest.json npx jest --no-coverage 2>&1 | tail -15
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/map/CommandMap.tsx apps/web/src/app/command/page.tsx
git commit -m "feat: wire up unit selection, trail display, and UnitDetailPanel in CommandPage"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Filter by police unit on the map — unit markers are clickable, `selectUnit` toggles selection
- ✅ Where the police is on the map — existing real-time markers stay visible; selected unit has a blue polyline trail
- ✅ Tracking during the day — `GET /units/:id/history` with date range, displayed as GPS point count + trail
- ✅ Reports created/assigned — `GET /units/:id/incidents` with date range, listed in UnitDetailPanel
- ✅ Filter by date — native date picker in UnitDetailPanel, defaults to today, both history and incidents re-fetch on change

**Placeholder scan:** No TBDs, all code blocks are complete.

**Type consistency:**
- `LocationHistoryPoint` defined in Task 5, used in Task 6, 7, 8 ✅
- `onTrailChange: (points: LocationHistoryPoint[]) => void` matches `setTrailPoints` signature ✅
- `unitsApi.getHistory` returns `LocationHistoryPoint[]`, consumed in `UnitDetailPanel` ✅
- `CommandMap` accepts `trailPoints?: LocationHistoryPoint[]`, passed from `CommandPage` ✅
