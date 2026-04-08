# Admin Interface: Geofences Dibujables + Permisos + Reportes por Unidad

**Fecha:** 2026-04-07
**Goal:** Construir un Admin Interface completo con cuatro capacidades: (1) editor visual de geofences/sectores en el mapa con herramienta de dibujo libre de polígonos; (2) gestión de usuarios con asignación de sector; (3) permisos granulares por usuario más allá del rol; (4) reportes individuales por unidad/policía con exportación.

**Principio rector:** El admin nunca debe tocar código para configurar el territorio o los usuarios — todo desde la interfaz.

---

## Arquitectura

### 1. Geofence Editor
- Instalar `@mapbox/mapbox-gl-draw` (compatible con MapLibre GL) en `apps/web`
- Nuevo componente `SectorDrawMap` que monta los controles de dibujo sobre el mapa
- Flujo: admin dibuja polígono → GeoJSON → `PATCH /sectors/:id/boundary` (ya existe) o crea sector y luego asigna boundary
- Nueva ruta `/admin/sectors` — lista de sectores + mapa con draw tool

### 2. Gestión de Usuarios (mejoras)
- Agregar `sectorId` (dropdown de sectores) y `shift` al `UserFormModal`
- UserTable muestra sector y turno asignados
- El backend `users.service` ya tiene `sectorId` en DTOs — solo falta la UI

### 3. Permisos Granulares
- Nueva migración: columna `custom_permissions JSONB` en tabla `users`
- Nueva entidad de permisos con constantes (`incidents:create`, `units:manage`, etc.)
- Guard actualizado: rol base + overrides por usuario
- UI: checkboxes de permisos en el modal de edición de usuario

### 4. Reportes por Unidad
- Nuevo endpoint `GET /units/:id/report?from=&to=` — stats + incidentes de esa unidad en el rango
- Nueva ruta `/admin/reports` — selector de unidad + date range + tabla + CSV export

---

## File Structure

**Nuevos archivos:**
- `apps/api/src/database/migrations/006_user_permissions.ts`
- `apps/web/src/app/admin/sectors/page.tsx`
- `apps/web/src/app/admin/reports/page.tsx`
- `apps/web/src/components/admin/SectorDrawMap.tsx`
- `apps/web/src/components/admin/SectorFormModal.tsx`
- `apps/web/src/components/admin/SectorTable.tsx`
- `apps/web/src/components/admin/PermissionsEditor.tsx`
- `apps/web/src/components/admin/UnitReportPanel.tsx`
- `packages/shared-types/src/constants/permissions.ts`

**Archivos modificados:**
- `apps/api/src/entities/user.entity.ts` — agregar `customPermissions: string[]`
- `apps/api/src/modules/users/users.service.ts` — include permissions in update
- `apps/api/src/modules/units/units.controller.ts` — agregar `GET /units/:id/report`
- `apps/api/src/modules/units/units.service.ts` — agregar `getUnitReport(id, from, to)`
- `apps/api/src/modules/sectors/sectors.controller.ts` — agregar `POST /sectors` y `DELETE /sectors/:id`
- `apps/api/src/shared/guards/roles.guard.ts` — verificar custom permissions además de rol
- `apps/web/src/app/admin/page.tsx` — agregar tabs (Usuarios | Sectores | Reportes)
- `apps/web/src/components/admin/UserFormModal.tsx` — agregar sector + shift + permissions
- `apps/web/src/components/admin/UserTable.tsx` — mostrar sector y turno
- `apps/web/src/lib/api.ts` — agregar `sectorsApi.create`, `sectorsApi.delete`, `unitsApi.getReport`
- `apps/web/src/lib/types.ts` — agregar `UnitReport`, `Permission` types
- `packages/shared-types/src/index.ts` — exportar permisos
- `packages/shared-types/src/dto/users/update-user.dto.ts` — agregar `customPermissions`

---

## Task 1: Backend — Permisos Granulares (Migración + Entidad + Guard)

**Files:**
- Create: `apps/api/src/database/migrations/006_user_permissions.ts`
- Modify: `apps/api/src/entities/user.entity.ts`
- Create: `packages/shared-types/src/constants/permissions.ts`
- Modify: `apps/api/src/shared/guards/roles.guard.ts`
- Modify: `packages/shared-types/src/dto/users/update-user.dto.ts`

### Step 1: Constantes de permisos en shared-types

Crear `packages/shared-types/src/constants/permissions.ts`:

```typescript
export const PERMISSIONS = {
  // Incidentes
  INCIDENTS_CREATE:   'incidents:create',
  INCIDENTS_ASSIGN:   'incidents:assign',
  INCIDENTS_CLOSE:    'incidents:close',
  INCIDENTS_VIEW_ALL: 'incidents:view_all',

  // Unidades
  UNITS_MANAGE:       'units:manage',
  UNITS_VIEW_HISTORY: 'units:view_history',

  // Sectores
  SECTORS_MANAGE:     'sectors:manage',

  // Usuarios (solo admin)
  USERS_MANAGE:       'users:manage',

  // Reportes
  REPORTS_VIEW:       'reports:view',
  REPORTS_EXPORT:     'reports:export',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/** Permisos por defecto de cada rol */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  admin: Object.values(PERMISSIONS) as Permission[],
  commander: [
    PERMISSIONS.INCIDENTS_CREATE, PERMISSIONS.INCIDENTS_ASSIGN,
    PERMISSIONS.INCIDENTS_CLOSE, PERMISSIONS.INCIDENTS_VIEW_ALL,
    PERMISSIONS.UNITS_MANAGE, PERMISSIONS.UNITS_VIEW_HISTORY,
    PERMISSIONS.SECTORS_MANAGE, PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_EXPORT,
  ],
  supervisor: [
    PERMISSIONS.INCIDENTS_CREATE, PERMISSIONS.INCIDENTS_ASSIGN,
    PERMISSIONS.INCIDENTS_CLOSE, PERMISSIONS.INCIDENTS_VIEW_ALL,
    PERMISSIONS.UNITS_VIEW_HISTORY, PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_EXPORT,
  ],
  operator: [
    PERMISSIONS.INCIDENTS_CREATE, PERMISSIONS.INCIDENTS_ASSIGN,
    PERMISSIONS.INCIDENTS_CLOSE, PERMISSIONS.INCIDENTS_VIEW_ALL,
  ],
  field_unit: [],
};
```

Exportar en `packages/shared-types/src/index.ts`:
```typescript
export * from './constants/permissions';
```

### Step 2: Migración

Crear `apps/api/src/database/migrations/006_user_permissions.ts`:

```typescript
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPermissions1712534400000 implements MigrationInterface {
  name = 'UserPermissions1712534400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "custom_permissions" JSONB NOT NULL DEFAULT '[]'::jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "shift" VARCHAR
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "custom_permissions"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "shift"`);
  }
}
```

### Step 3: Entidad User — agregar campo

En `apps/api/src/entities/user.entity.ts`, agregar después de `sectorId`:

```typescript
@Column({ name: 'custom_permissions', type: 'jsonb', default: [] })
customPermissions: string[];

@Column({ nullable: true })
shift: string | null;
```

### Step 4: Actualizar UpdateUserDto

En `packages/shared-types/src/dto/users/update-user.dto.ts`, agregar:

```typescript
import { IsArray, IsString, IsOptional } from 'class-validator';

@IsOptional()
@IsArray()
@IsString({ each: true })
customPermissions?: string[];

@IsOptional()
@IsString()
shift?: string;
```

### Step 5: Guard con permisos

En `apps/api/src/shared/guards/roles.guard.ts`, agregar soporte para `@RequirePermission()`:

```typescript
// Nuevo decorador (crear roles.decorator.ts o en el mismo archivo):
export const PERMISSION_KEY = 'required_permission';
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);
```

En el guard, después de la verificación de roles:
```typescript
const requiredPermission = this.reflector.get<string>(PERMISSION_KEY, context.getHandler());
if (requiredPermission) {
  const user = request.user as { role: string; customPermissions?: string[] };
  if (user.role === 'admin') return true;
  const defaultPerms = ROLE_DEFAULT_PERMISSIONS[user.role] ?? [];
  const allPerms = [...defaultPerms, ...(user.customPermissions ?? [])];
  return allPerms.includes(requiredPermission);
}
```

- [ ] Step 1: Crear archivo de constantes de permisos
- [ ] Step 2: Exportar en shared-types/index.ts
- [ ] Step 3: Crear migración 006
- [ ] Step 4: Actualizar user.entity.ts
- [ ] Step 5: Actualizar UpdateUserDto
- [ ] Step 6: Actualizar guard
- [ ] Step 7: Compilar shared-types: `cd packages/shared-types && node_modules/.bin/tsc`
- [ ] Step 8: Correr migración: `cd apps/api && node_modules/.bin/typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts`

---

## Task 2: Backend — Endpoint de Reporte por Unidad

**Files:**
- Modify: `apps/api/src/modules/units/units.service.ts`
- Modify: `apps/api/src/modules/units/units.controller.ts`

### Step 1: Agregar `getUnitReport` al service

En `units.service.ts`, agregar método:

```typescript
async getUnitReport(unitId: string, from: Date, to: Date) {
  const unit = await this.repo.findOne({ where: { id: unitId } });
  if (!unit) throw new NotFoundException('Unidad no encontrada');

  const [incidents, historyPoints] = await Promise.all([
    this.incidentRepo.find({
      where: {
        assignedUnitId: unitId,
        assignedAt: Between(from, to),
      },
      order: { assignedAt: 'ASC' },
    }),
    this.historyRepo.find({
      where: {
        unitId,
        recordedAt: Between(from, to),
      },
      order: { recordedAt: 'ASC' },
    }),
  ]);

  const closed = incidents.filter(i => i.closedAt);
  const responseTimes = closed
    .filter(i => i.assignedAt && i.arrivedAt)
    .map(i => (i.arrivedAt!.getTime() - i.assignedAt!.getTime()) / 60000);

  const avgResponseMinutes =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;

  return {
    unit: { id: unit.id, callSign: unit.callSign, status: unit.status },
    period: { from, to },
    stats: {
      totalIncidents: incidents.length,
      closedIncidents: closed.length,
      avgResponseMinutes,
      gpsPointsRecorded: historyPoints.length,
    },
    incidents,
  };
}
```

### Step 2: Agregar endpoint al controller

En `units.controller.ts`, ANTES del `@Get(':id')`:

```typescript
@Get(':id/report')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.COMMANDER, UserRole.SUPERVISOR)
getReport(
  @Param('id') id: string,
  @Query('from') fromStr: string,
  @Query('to') toStr: string,
) {
  const from = fromStr ? new Date(fromStr) : startOfDay(new Date());
  const to = toStr ? new Date(toStr) : endOfDay(new Date());
  return this.unitsService.getUnitReport(id, from, to);
}
```

(Importar `startOfDay`/`endOfDay` de `date-fns` o implementar manualmente)

- [ ] Step 1: Agregar `getUnitReport` a units.service.ts
- [ ] Step 2: Agregar `GET /units/:id/report` al controller (ANTES de `:id`)

---

## Task 3: Backend — CRUD completo de Sectores

**Files:**
- Modify: `apps/api/src/modules/sectors/sectors.controller.ts`
- Modify: `apps/api/src/modules/sectors/sectors.service.ts`

### Step 1: Agregar `delete` al service

En `sectors.service.ts`:

```typescript
async delete(id: string): Promise<void> {
  const sector = await this.repo.findOne({ where: { id } });
  if (!sector) throw new NotFoundException('Sector no encontrado');
  await this.repo.update(id, { isActive: false });
}
```

### Step 2: Agregar endpoint DELETE al controller

```typescript
@Delete(':id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.COMMANDER)
@HttpCode(204)
delete(@Param('id') id: string) {
  return this.sectorsService.delete(id);
}
```

- [ ] Step 1: Agregar `delete` a sectors.service.ts
- [ ] Step 2: Agregar `DELETE /sectors/:id` al controller

---

## Task 4: Frontend — Tipos y API Client

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`

### Step 1: Nuevos tipos en types.ts

```typescript
export interface UnitReportStats {
  totalIncidents: number;
  closedIncidents: number;
  avgResponseMinutes: number | null;
  gpsPointsRecorded: number;
}

export interface UnitReport {
  unit: { id: string; callSign: string; status: string };
  period: { from: string; to: string };
  stats: UnitReportStats;
  incidents: Incident[];
}
```

### Step 2: Métodos en api.ts

Agregar a `sectorsApi`:
```typescript
create: (data: { name: string; color?: string }) =>
  api.post<Sector>('/sectors', data).then(r => r.data),

delete: (id: string) =>
  api.delete(`/sectors/${id}`).then(r => r.data),
```

Agregar a `unitsApi`:
```typescript
getReport: (id: string, from: string, to: string) =>
  api.get<UnitReport>(`/units/${id}/report`, { params: { from, to } }).then(r => r.data),
```

- [ ] Step 1: Agregar UnitReport, UnitReportStats a types.ts
- [ ] Step 2: Agregar sectorsApi.create, sectorsApi.delete, unitsApi.getReport a api.ts

---

## Task 5: Frontend — SectorDrawMap (Editor de Geofences)

**Files:**
- Create: `apps/web/src/components/admin/SectorDrawMap.tsx`

### Step 1: Instalar dependencias

```bash
cd apps/web
pnpm add @mapbox/mapbox-gl-draw
pnpm add -D @types/mapbox__mapbox-gl-draw
```

### Step 2: Crear componente SectorDrawMap

```tsx
// apps/web/src/components/admin/SectorDrawMap.tsx
'use client';
import { useRef, useEffect, useCallback } from 'react';
import Map, { Source, Layer, type MapRef } from 'react-map-gl/maplibre';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import type { SectorWithBoundary } from '@/lib/types';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface Props {
  sectors: SectorWithBoundary[];
  selectedSectorId: string | null;
  onBoundaryDrawn: (sectorId: string, coordinates: [number, number][]) => void;
}

export default function SectorDrawMap({ sectors, selectedSectorId, onBoundaryDrawn }: Props) {
  const mapRef = useRef<MapRef>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  // Inicializar MapboxDraw cuando el mapa esté listo
  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || drawRef.current) return;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      defaultMode: 'simple_select',
      styles: [
        {
          id: 'gl-draw-polygon-fill',
          type: 'fill',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          paint: { 'fill-color': '#3B82F6', 'fill-opacity': 0.2 },
        },
        {
          id: 'gl-draw-polygon-stroke',
          type: 'line',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          paint: { 'line-color': '#3B82F6', 'line-width': 2, 'line-dasharray': [4, 2] },
        },
        {
          id: 'gl-draw-polygon-vertex',
          type: 'circle',
          filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
          paint: { 'circle-radius': 5, 'circle-color': '#3B82F6' },
        },
      ],
    });

    map.addControl(draw as any);
    drawRef.current = draw;

    // Al terminar de dibujar
    map.on('draw.create', (e: any) => {
      if (!selectedSectorId) return;
      const feature = e.features[0];
      if (feature?.geometry?.type === 'Polygon') {
        const coords = feature.geometry.coordinates[0] as [number, number][];
        onBoundaryDrawn(selectedSectorId, coords);
        draw.deleteAll();
      }
    });
  }, [selectedSectorId, onBoundaryDrawn]);

  // Si hay un sector seleccionado con boundary, pre-cargarlo en el draw
  useEffect(() => {
    const draw = drawRef.current;
    if (!draw || !selectedSectorId) return;
    draw.deleteAll();

    const sector = sectors.find(s => s.id === selectedSectorId);
    if (sector?.boundaryGeoJson) {
      draw.add({ type: 'Feature', geometry: sector.boundaryGeoJson, properties: {} });
    }
  }, [selectedSectorId, sectors]);

  // GeoJSON de sectores para mostrar en mapa (solo los que no están seleccionados)
  const sectorsGeoJson = {
    type: 'FeatureCollection' as const,
    features: sectors
      .filter(s => s.boundaryGeoJson && s.id !== selectedSectorId)
      .map(s => ({
        type: 'Feature' as const,
        geometry: s.boundaryGeoJson!,
        properties: { id: s.id, name: s.name, color: s.color },
      })),
  };

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: -99.1332, latitude: 19.4326, zoom: 12 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLE}
      onLoad={onMapLoad}
    >
      {sectorsGeoJson.features.length > 0 && (
        <Source id="sectors" type="geojson" data={sectorsGeoJson}>
          <Layer
            id="sector-fill"
            type="fill"
            paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': 0.15 }}
          />
          <Layer
            id="sector-line"
            type="line"
            paint={{ 'line-color': ['get', 'color'], 'line-width': 2 }}
          />
        </Source>
      )}
    </Map>
  );
}
```

- [ ] Step 1: Instalar @mapbox/mapbox-gl-draw y @types
- [ ] Step 2: Crear SectorDrawMap.tsx

---

## Task 6: Frontend — SectorFormModal y SectorTable

**Files:**
- Create: `apps/web/src/components/admin/SectorFormModal.tsx`
- Create: `apps/web/src/components/admin/SectorTable.tsx`

### SectorFormModal

```tsx
'use client';
import { useState } from 'react';

const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316'];

interface Props {
  sector?: { id: string; name: string; color: string } | null;
  onSave: (data: { name: string; color: string }) => void;
  onClose: () => void;
}

export default function SectorFormModal({ sector, onSave, onClose }: Props) {
  const [name, setName] = useState(sector?.name ?? '');
  const [color, setColor] = useState(sector?.color ?? '#3B82F6');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-sm border border-slate-700">
        <h2 className="text-white font-semibold text-lg mb-4">
          {sector ? 'Editar Sector' : 'Nuevo Sector'}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm">Nombre</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full mt-1 bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Sector Norte"
            />
          </div>
          <div>
            <label className="text-slate-400 text-sm">Color</label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 ${color === c ? 'border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 text-slate-400 text-sm hover:text-white">
            Cancelar
          </button>
          <button
            onClick={() => name.trim() && onSave({ name: name.trim(), color })}
            disabled={!name.trim()}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
```

### SectorTable

```tsx
'use client';
import type { SectorWithBoundary } from '@/lib/types';

interface Props {
  sectors: SectorWithBoundary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (sector: SectorWithBoundary) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export default function SectorTable({ sectors, selectedId, onSelect, onEdit, onDelete, onNew }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold">Sectores</h3>
        <button onClick={onNew} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium">
          + Nuevo
        </button>
      </div>
      <div className="space-y-1 overflow-y-auto flex-1">
        {sectors.map(s => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
              selectedId === s.id ? 'bg-blue-600/20 border border-blue-500/50' : 'hover:bg-slate-700/50'
            }`}
          >
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-white text-sm flex-1">{s.name}</span>
            <span className={`text-xs ${s.boundaryGeoJson ? 'text-green-400' : 'text-amber-400'}`}>
              {s.boundaryGeoJson ? '✓ Geo' : '⚠ Sin geo'}
            </span>
            <button
              onClick={e => { e.stopPropagation(); onEdit(s); }}
              className="text-slate-400 hover:text-white text-xs px-1"
            >
              ✎
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(s.id); }}
              className="text-slate-400 hover:text-red-400 text-xs px-1"
            >
              ✕
            </button>
          </div>
        ))}
        {sectors.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">No hay sectores</p>
        )}
      </div>
      {selectedId && (
        <p className="text-slate-400 text-xs mt-3 text-center">
          Dibuja un polígono en el mapa para definir la geocerca
        </p>
      )}
    </div>
  );
}
```

- [ ] Step 1: Crear SectorFormModal.tsx
- [ ] Step 2: Crear SectorTable.tsx

---

## Task 7: Frontend — Página /admin/sectors

**Files:**
- Create: `apps/web/src/app/admin/sectors/page.tsx`

```tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { sectorsApi } from '@/lib/api';
import type { SectorWithBoundary } from '@/lib/types';
import SectorTable from '@/components/admin/SectorTable';
import SectorFormModal from '@/components/admin/SectorFormModal';

// Dynamic import para evitar SSR del mapa
const SectorDrawMap = dynamic(() => import('@/components/admin/SectorDrawMap'), { ssr: false });

export default function SectorsAdminPage() {
  const router = useRouter();
  const [sectors, setSectors] = useState<SectorWithBoundary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; sector?: SectorWithBoundary } | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadSectors = useCallback(async () => {
    const data = await sectorsApi.getWithBoundary();
    setSectors(data);
  }, []);

  useEffect(() => { loadSectors(); }, [loadSectors]);

  const handleSaveModal = async (data: { name: string; color: string }) => {
    setSaving(true);
    try {
      if (modal?.mode === 'edit' && modal.sector) {
        await sectorsApi.update(modal.sector.id, data);
        showToast('Sector actualizado');
      } else {
        const created = await sectorsApi.create(data);
        setSelectedId(created.id);
        showToast('Sector creado — ahora dibuja su geocerca en el mapa');
      }
      await loadSectors();
      setModal(null);
    } finally {
      setSaving(false);
    }
  };

  const handleBoundaryDrawn = async (sectorId: string, coords: [number, number][]) => {
    setSaving(true);
    try {
      await sectorsApi.setBoundary(sectorId, coords);
      await loadSectors();
      showToast('Geocerca guardada ✓');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este sector?')) return;
    await sectorsApi.delete(id);
    if (selectedId === id) setSelectedId(null);
    await loadSectors();
    showToast('Sector eliminado');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-4">
        <button onClick={() => router.push('/admin')} className="text-slate-400 hover:text-white text-sm">
          ← Admin
        </button>
        <h1 className="text-white font-bold text-lg">Sectores / Geocercas</h1>
        {saving && <span className="text-blue-400 text-sm animate-pulse">Guardando…</span>}
      </div>

      {/* Body: tabla + mapa */}
      <div className="flex flex-1 overflow-hidden">
        {/* Panel izquierdo */}
        <div className="w-72 flex-shrink-0 p-4 border-r border-slate-700 overflow-y-auto">
          <SectorTable
            sectors={sectors}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onEdit={s => setModal({ mode: 'edit', sector: s })}
            onDelete={handleDelete}
            onNew={() => setModal({ mode: 'create' })}
          />
        </div>

        {/* Mapa */}
        <div className="flex-1 relative">
          <SectorDrawMap
            sectors={sectors}
            selectedSectorId={selectedId}
            onBoundaryDrawn={handleBoundaryDrawn}
          />
          {!selectedId && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-slate-800/80 rounded-xl px-6 py-4 text-center">
                <p className="text-slate-300 text-sm">Selecciona un sector de la lista</p>
                <p className="text-slate-500 text-xs mt-1">o crea uno nuevo para dibujar su geocerca</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-700 text-white px-5 py-2.5 rounded-full text-sm shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <SectorFormModal
          sector={modal.mode === 'edit' ? modal.sector : null}
          onSave={handleSaveModal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
```

- [ ] Step 1: Crear `apps/web/src/app/admin/sectors/page.tsx`

---

## Task 8: Frontend — PermissionsEditor Component

**Files:**
- Create: `apps/web/src/components/admin/PermissionsEditor.tsx`

```tsx
'use client';
import { PERMISSIONS, ROLE_DEFAULT_PERMISSIONS, type Permission } from '@velnari/shared-types';

const PERMISSION_LABELS: Record<string, string> = {
  'incidents:create':   'Crear incidentes',
  'incidents:assign':   'Asignar incidentes',
  'incidents:close':    'Cerrar incidentes',
  'incidents:view_all': 'Ver todos los incidentes',
  'units:manage':       'Gestionar unidades',
  'units:view_history': 'Ver historial GPS',
  'sectors:manage':     'Gestionar sectores',
  'users:manage':       'Gestionar usuarios',
  'reports:view':       'Ver reportes',
  'reports:export':     'Exportar reportes',
};

const PERMISSION_GROUPS = [
  { label: 'Incidentes', perms: ['incidents:create','incidents:assign','incidents:close','incidents:view_all'] },
  { label: 'Unidades', perms: ['units:manage','units:view_history'] },
  { label: 'Sectores y Admin', perms: ['sectors:manage','users:manage'] },
  { label: 'Reportes', perms: ['reports:view','reports:export'] },
];

interface Props {
  role: string;
  customPermissions: string[];
  onChange: (perms: string[]) => void;
}

export default function PermissionsEditor({ role, customPermissions, onChange }: Props) {
  const defaults = new Set(ROLE_DEFAULT_PERMISSIONS[role] ?? []);
  const extras = new Set(customPermissions);

  const togglePermission = (perm: string) => {
    if (defaults.has(perm)) return; // no se pueden quitar los del rol base
    const next = new Set(extras);
    next.has(perm) ? next.delete(perm) : next.add(perm);
    onChange([...next]);
  };

  const isActive = (perm: string) => defaults.has(perm) || extras.has(perm);

  return (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map(group => (
        <div key={group.label}>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-2">{group.label}</p>
          <div className="space-y-1">
            {group.perms.map(perm => {
              const active = isActive(perm);
              const isDefault = defaults.has(perm);
              return (
                <label
                  key={perm}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    isDefault ? 'opacity-60 cursor-default' : 'hover:bg-slate-700/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    disabled={isDefault}
                    onChange={() => togglePermission(perm)}
                    className="accent-blue-500"
                  />
                  <span className="text-white text-sm">{PERMISSION_LABELS[perm]}</span>
                  {isDefault && (
                    <span className="ml-auto text-xs text-slate-500">por rol</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] Step 1: Crear PermissionsEditor.tsx

---

## Task 9: Frontend — Actualizar UserFormModal con Sector + Shift + Permisos

**Files:**
- Modify: `apps/web/src/components/admin/UserFormModal.tsx`

Cambios a hacer en el modal existente:

1. Agregar al estado del form: `sectorId`, `shift`, `customPermissions`
2. Agregar campo `<select>` de sector (fetching sectors en el modal)
3. Agregar campo `<select>` de turno: Matutino / Vespertino / Nocturno
4. Agregar sección "Permisos adicionales" usando `<PermissionsEditor>`
5. Incluir los tres campos nuevos en el payload del `onSubmit`

Skeleton del formulario actualizado:
```tsx
// Nuevos estados
const [sectorId, setSectorId] = useState(user?.sectorId ?? '');
const [shift, setShift] = useState(user?.shift ?? '');
const [customPermissions, setCustomPermissions] = useState<string[]>(user?.customPermissions ?? []);
const [sectors, setSectors] = useState<Sector[]>([]);

// En useEffect, fetchear sectores
useEffect(() => {
  sectorsApi.getAll().then(setSectors);
}, []);

// En el form, agregar después del campo de role:
<select value={sectorId} onChange={e => setSectorId(e.target.value)}>
  <option value="">Sin sector asignado</option>
  {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
</select>

<select value={shift} onChange={e => setShift(e.target.value)}>
  <option value="">Sin turno</option>
  <option value="morning">Matutino (06–14h)</option>
  <option value="afternoon">Vespertino (14–22h)</option>
  <option value="night">Nocturno (22–06h)</option>
</select>

// Sección de permisos (solo al editar, no al crear)
{user && (
  <div>
    <p className="text-slate-400 text-sm mb-2">Permisos adicionales</p>
    <PermissionsEditor
      role={role}
      customPermissions={customPermissions}
      onChange={setCustomPermissions}
    />
  </div>
)}
```

- [ ] Step 1: Actualizar UserFormModal para incluir sectorId, shift, customPermissions

---

## Task 10: Frontend — Página /admin/reports (Reportes por Unidad)

**Files:**
- Create: `apps/web/src/app/admin/reports/page.tsx`
- Create: `apps/web/src/components/admin/UnitReportPanel.tsx`

### UnitReportPanel

```tsx
'use client';
import type { UnitReport } from '@/lib/types';

interface Props { report: UnitReport }

export default function UnitReportPanel({ report }: Props) {
  const downloadCSV = () => {
    const rows = [
      ['Folio', 'Tipo', 'Prioridad', 'Estado', 'Dirección', 'Asignado', 'Cerrado'],
      ...report.incidents.map(i => [
        i.folio, i.type, i.priority, i.status,
        i.address ?? '',
        i.assignedAt ? new Date(i.assignedAt).toLocaleTimeString('es-MX') : '',
        i.closedAt ? new Date(i.closedAt).toLocaleTimeString('es-MX') : '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `reporte-${report.unit.callSign}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Incidentes atendidos', value: report.stats.totalIncidents },
          { label: 'Incidentes cerrados', value: report.stats.closedIncidents },
          { label: 'T. respuesta promedio', value: report.stats.avgResponseMinutes != null ? `${report.stats.avgResponseMinutes} min` : '—' },
          { label: 'Puntos GPS registrados', value: report.stats.gpsPointsRecorded },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-xs">{stat.label}</p>
            <p className="text-white text-2xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabla de incidentes */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="text-white font-medium text-sm">Incidentes del período</h3>
          <button onClick={downloadCSV} className="text-xs text-blue-400 hover:text-blue-300">
            Exportar CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-slate-700">
                <th className="px-4 py-2 text-left">Folio</th>
                <th className="px-4 py-2 text-left">Tipo</th>
                <th className="px-4 py-2 text-left">Prioridad</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-left">Dirección</th>
                <th className="px-4 py-2 text-left">T. respuesta</th>
              </tr>
            </thead>
            <tbody>
              {report.incidents.map(inc => {
                const responseMin = inc.assignedAt && inc.arrivedAt
                  ? Math.round((new Date(inc.arrivedAt).getTime() - new Date(inc.assignedAt).getTime()) / 60000)
                  : null;
                return (
                  <tr key={inc.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-2 text-slate-300 font-mono">{inc.folio}</td>
                    <td className="px-4 py-2 text-slate-300 capitalize">{inc.type}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        inc.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                        inc.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-slate-600 text-slate-300'
                      }`}>{inc.priority}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-300">{inc.status}</td>
                    <td className="px-4 py-2 text-slate-400 truncate max-w-xs">{inc.address ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-300">{responseMin != null ? `${responseMin} min` : '—'}</td>
                  </tr>
                );
              })}
              {report.incidents.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Sin incidentes en este período</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

### /admin/reports/page.tsx

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { unitsApi } from '@/lib/api';
import type { Unit, UnitReport } from '@/lib/types';
import UnitReportPanel from '@/components/admin/UnitReportPanel';

export default function ReportsPage() {
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<UnitReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    unitsApi.getAll({}).then(setUnits);
  }, []);

  const fetchReport = async () => {
    if (!selectedUnitId) return;
    setLoading(true);
    try {
      const r = await unitsApi.getReport(selectedUnitId, `${from}T00:00:00Z`, `${to}T23:59:59Z`);
      setReport(r);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/admin')} className="text-slate-400 hover:text-white text-sm">
            ← Admin
          </button>
          <h1 className="text-white font-bold text-xl">Reportes por Unidad</h1>
        </div>

        {/* Filtros */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-slate-400 text-xs block mb-1">Unidad</label>
            <select
              value={selectedUnitId}
              onChange={e => setSelectedUnitId(e.target.value)}
              className="bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar unidad</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.callSign}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-xs block mb-1">Desde</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs block mb-1">Hasta</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={fetchReport}
            disabled={!selectedUnitId || loading}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Cargando…' : 'Generar reporte'}
          </button>
        </div>

        {/* Resultado */}
        {report && <UnitReportPanel report={report} />}
      </div>
    </div>
  );
}
```

- [ ] Step 1: Crear UnitReportPanel.tsx
- [ ] Step 2: Crear /admin/reports/page.tsx

---

## Task 11: Frontend — Actualizar /admin/page.tsx con Navegación por Tabs

**Files:**
- Modify: `apps/web/src/app/admin/page.tsx`

Agregar al header del admin los links a las nuevas secciones:

```tsx
{/* Agregar después del título en el header */}
<div className="flex gap-1 mt-3 border-b border-slate-700">
  {[
    { label: 'Usuarios', href: '/admin' },
    { label: 'Sectores / Geocercas', href: '/admin/sectors' },
    { label: 'Reportes', href: '/admin/reports' },
  ].map(tab => (
    <Link
      key={tab.href}
      href={tab.href}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        pathname === tab.href
          ? 'border-blue-500 text-white'
          : 'border-transparent text-slate-400 hover:text-white'
      }`}
    >
      {tab.label}
    </Link>
  ))}
</div>
```

(Importar `Link` de `next/link` y `usePathname` de `next/navigation`)

- [ ] Step 1: Actualizar admin/page.tsx para agregar tabs de navegación

---

## Orden de Ejecución

1. **Task 1** — Backend: permisos (migración + entidad + guard) ← bloquea Task 9
2. **Task 2** — Backend: `getUnitReport`
3. **Task 3** — Backend: `DELETE /sectors/:id`
4. **Task 4** — Frontend: tipos + API client
5. **Task 5** — Frontend: SectorDrawMap (instalar @mapbox/mapbox-gl-draw)
6. **Task 6** — Frontend: SectorFormModal + SectorTable
7. **Task 7** — Frontend: /admin/sectors page
8. **Task 8** — Frontend: PermissionsEditor
9. **Task 9** — Frontend: actualizar UserFormModal
10. **Task 10** — Frontend: reportes por unidad
11. **Task 11** — Frontend: tabs de navegación en /admin

---

## Notas de Implementación

- `@mapbox/mapbox-gl-draw` funciona con MapLibre GL porque MapLibre es un fork de Mapbox GL — los controles son compatibles.
- El CSS del draw tool (`@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css`) hay que importarlo en el componente o en globals.css.
- Los permisos del rol base son inmutables desde la UI — solo se pueden agregar permisos extra. Para restringir un permiso del rol, habría que cambiar el rol del usuario.
- El endpoint `GET /units/:id/report` debe ir ANTES de `GET /units/:id` en el controller para evitar que NestJS lo interprete como un ID.
- `date-fns` no está instalado — usar implementación manual de startOfDay/endOfDay o instalar el paquete.
