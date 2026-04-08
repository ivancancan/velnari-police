# Backend Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar los módulos core del backend (Sectors, Units, Incidents, Dispatch, Realtime) que convierten la API de Velnari en un sistema operativo funcional de despacho — con endpoints REST completos, WebSocket gateway para actualizaciones en tiempo real, y caché de posiciones GPS en Redis.

**Architecture:** NestJS modular monolith construido sobre la Foundation (Plan 1). Cada dominio es un módulo NestJS independiente con su entidad TypeORM, servicio, controlador y tests. El flujo de despacho es: Sector → Unit → Incident → Dispatch (asignación). El WebSocket Gateway usa Socket.IO con rooms por sector, emitiendo eventos cuando cambian estados de unidades e incidentes. Redis cachea la posición GPS más reciente de cada unidad (TTL 60s) para lecturas rápidas del mapa.

**Tech Stack:** NestJS 10, TypeORM + PostGIS, Socket.IO, Redis (ioredis), Jest, class-validator, class-transformer

---

## Dependencias entre tasks

```
Task 1: Shared DTOs nuevos (shared-types)
    ↓
Task 2: Sector entity + module
    ↓
Task 3: Unit entity + module (depende de Sector)
    ↓
Task 4: Incident + IncidentEvent entities + module (depende de Unit, Sector)
    ↓
Task 5: Dispatch module (depende de Incident, Unit)
    ↓
Task 6: WebSocket Gateway (depende de Unit, Incident)
    ↓
Task 7: Redis position cache (depende de Unit, Gateway)
    ↓
Task 8: DB Migration (todos los nuevos modelos)
    ↓
Task 9: Auth refresh endpoint (independiente, pero completa Auth)
```

---

## Mapa de Archivos

```
apps/api/src/
├── entities/
│   ├── sector.entity.ts              # Sector con geometry PostGIS
│   ├── unit.entity.ts                # Unidad policial con GPS
│   ├── incident.entity.ts            # Incidente
│   └── incident-event.entity.ts     # Evento del timeline
├── modules/
│   ├── sectors/
│   │   ├── sectors.module.ts
│   │   ├── sectors.controller.ts
│   │   ├── sectors.service.ts
│   │   └── sectors.service.spec.ts
│   ├── units/
│   │   ├── units.module.ts
│   │   ├── units.controller.ts
│   │   ├── units.service.ts
│   │   └── units.service.spec.ts
│   ├── incidents/
│   │   ├── incidents.module.ts
│   │   ├── incidents.controller.ts
│   │   ├── incidents.service.ts
│   │   └── incidents.service.spec.ts
│   ├── dispatch/
│   │   ├── dispatch.module.ts
│   │   ├── dispatch.controller.ts
│   │   ├── dispatch.service.ts
│   │   └── dispatch.service.spec.ts
│   └── realtime/
│       ├── realtime.module.ts
│       ├── realtime.gateway.ts
│       └── realtime.gateway.spec.ts
├── database/
│   └── migrations/
│       └── 002_core_schema.ts        # Sectors, units, incidents, events
└── shared/
    └── services/
        └── redis-cache.service.ts    # Caché de posiciones GPS

packages/shared-types/src/
├── dto/
│   ├── sectors/
│   │   └── sector.dto.ts
│   ├── units/
│   │   ├── create-unit.dto.ts
│   │   ├── update-unit-status.dto.ts
│   │   └── unit-location.dto.ts
│   ├── incidents/
│   │   ├── create-incident.dto.ts
│   │   ├── update-incident.dto.ts
│   │   └── add-incident-note.dto.ts
│   └── dispatch/
│       └── assign-unit.dto.ts
└── index.ts                          # actualizar con nuevos exports
```

---

## Task 1: Nuevos DTOs en shared-types

**Files:**
- Create: `packages/shared-types/src/dto/sectors/sector.dto.ts`
- Create: `packages/shared-types/src/dto/units/create-unit.dto.ts`
- Create: `packages/shared-types/src/dto/units/update-unit-status.dto.ts`
- Create: `packages/shared-types/src/dto/units/unit-location.dto.ts`
- Create: `packages/shared-types/src/dto/incidents/create-incident.dto.ts`
- Create: `packages/shared-types/src/dto/incidents/update-incident.dto.ts`
- Create: `packages/shared-types/src/dto/incidents/add-incident-note.dto.ts`
- Create: `packages/shared-types/src/dto/dispatch/assign-unit.dto.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1: Crear directorios**

```bash
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/packages/shared-types/src/dto/sectors"
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/packages/shared-types/src/dto/units"
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/packages/shared-types/src/dto/incidents"
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/packages/shared-types/src/dto/dispatch"
```

- [ ] **Step 2: Crear `dto/sectors/sector.dto.ts`**

```typescript
import { IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';

export class CreateSectorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  color?: string; // hex color ej. "#3B82F6"
}

export class UpdateSectorDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

- [ ] **Step 3: Crear `dto/units/create-unit.dto.ts`**

```typescript
import { IsString, IsOptional, IsUUID, IsEnum, MinLength, MaxLength } from 'class-validator';
import { UnitStatus } from '../../enums/unit-status.enum';

export class CreateUnitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  callSign!: string; // ej. "P-14"

  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus; // default AVAILABLE

  @IsOptional()
  @IsUUID()
  sectorId?: string;

  @IsOptional()
  @IsString()
  shift?: string; // 'morning' | 'afternoon' | 'night'

  @IsOptional()
  @IsUUID()
  assignedUserId?: string; // policia asignado a la unidad
}
```

- [ ] **Step 4: Crear `dto/units/update-unit-status.dto.ts`**

```typescript
import { IsEnum } from 'class-validator';
import { UnitStatus } from '../../enums/unit-status.enum';

export class UpdateUnitStatusDto {
  @IsEnum(UnitStatus)
  status!: UnitStatus;
}
```

- [ ] **Step 5: Crear `dto/units/unit-location.dto.ts`**

```typescript
import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class UnitLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsOptional()
  @IsNumber()
  accuracy?: number; // metros

  @IsOptional()
  @IsNumber()
  heading?: number; // 0-360 grados
}
```

- [ ] **Step 6: Crear `dto/incidents/create-incident.dto.ts`**

```typescript
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IncidentPriority } from '../../enums/incident-priority.enum';
import { IncidentType } from '../../enums/incident-type.enum';

export class CreateIncidentDto {
  @IsEnum(IncidentType)
  type!: IncidentType;

  @IsEnum(IncidentPriority)
  priority!: IncidentPriority;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUUID()
  sectorId?: string;
}
```

- [ ] **Step 7: Crear `dto/incidents/update-incident.dto.ts`**

```typescript
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { IncidentPriority } from '../../enums/incident-priority.enum';
import { IncidentType } from '../../enums/incident-type.enum';

export class UpdateIncidentDto {
  @IsOptional()
  @IsEnum(IncidentType)
  type?: IncidentType;

  @IsOptional()
  @IsEnum(IncidentPriority)
  priority?: IncidentPriority;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CloseIncidentDto {
  @IsString()
  @MaxLength(50)
  resolution!: string; // 'arrest' | 'citation' | 'mediation' | 'referral' | 'no_action' | 'other'

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

- [ ] **Step 8: Crear `dto/incidents/add-incident-note.dto.ts`**

```typescript
import { IsString, MinLength, MaxLength } from 'class-validator';

export class AddIncidentNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text!: string;
}
```

- [ ] **Step 9: Crear `dto/dispatch/assign-unit.dto.ts`**

```typescript
import { IsUUID } from 'class-validator';

export class AssignUnitDto {
  @IsUUID()
  unitId!: string;
}
```

- [ ] **Step 10: Actualizar `packages/shared-types/src/index.ts`**

Reemplazar el contenido completo del archivo con:

```typescript
// Enums
export * from './enums/role.enum';
export * from './enums/unit-status.enum';
export * from './enums/incident-priority.enum';
export * from './enums/incident-status.enum';
export * from './enums/incident-type.enum';

// DTOs — Auth
export * from './dto/auth/login.dto';
export * from './dto/auth/token-response.dto';

// DTOs — Pagination
export * from './dto/pagination.dto';

// DTOs — Sectors
export * from './dto/sectors/sector.dto';

// DTOs — Units
export * from './dto/units/create-unit.dto';
export * from './dto/units/update-unit-status.dto';
export * from './dto/units/unit-location.dto';

// DTOs — Incidents
export * from './dto/incidents/create-incident.dto';
export * from './dto/incidents/update-incident.dto';
export * from './dto/incidents/add-incident-note.dto';

// DTOs — Dispatch
export * from './dto/dispatch/assign-unit.dto';
```

- [ ] **Step 11: Build shared-types y verificar**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/packages/shared-types"
~/.local/bin/pnpm build 2>&1 | tail -5
```

Esperado: exit 0, `dist/` actualizado sin errores TypeScript.

- [ ] **Step 12: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add packages/shared-types
git commit -m "feat: add core DTOs to shared-types (sectors, units, incidents, dispatch)"
```

---

## Task 2: Sector Entity + Module

**Files:**
- Create: `apps/api/src/entities/sector.entity.ts`
- Create: `apps/api/src/modules/sectors/sectors.module.ts`
- Create: `apps/api/src/modules/sectors/sectors.service.ts`
- Create: `apps/api/src/modules/sectors/sectors.service.spec.ts`
- Create: `apps/api/src/modules/sectors/sectors.controller.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Crear directorios**

```bash
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api/src/modules/sectors"
```

- [ ] **Step 2: Crear `apps/api/src/entities/sector.entity.ts`**

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sectors')
export class SectorEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  // Geometría del polígono del sector (PostGIS)
  // Se almacena como geometry(Polygon, 4326) — WGS84
  // Nullable porque puede crearse el sector sin geometría y añadirla después
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Polygon',
    srid: 4326,
    nullable: true,
    select: false, // no incluir en queries por defecto (es grande)
  })
  boundary?: string; // GeoJSON string

  @Column({ default: '#3B82F6' })
  color!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

- [ ] **Step 3: Escribir tests del SectorsService (TDD — fallan primero)**

`apps/api/src/modules/sectors/sectors.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { SectorsService } from './sectors.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SectorEntity } from '../../entities/sector.entity';
import { NotFoundException } from '@nestjs/common';

describe('SectorsService', () => {
  let service: SectorsService;

  const mockSector: SectorEntity = {
    id: 'sector-uuid-1',
    name: 'Sector Norte',
    color: '#3B82F6',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SectorsService,
        { provide: getRepositoryToken(SectorEntity), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<SectorsService>(SectorsService);
    jest.clearAllMocks();
  });

  it('findAll retorna lista de sectores activos', async () => {
    mockRepo.find.mockResolvedValue([mockSector]);
    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(mockRepo.find).toHaveBeenCalledWith({ where: { isActive: true } });
  });

  it('findOne retorna sector por id', async () => {
    mockRepo.findOne.mockResolvedValue(mockSector);
    const result = await service.findOne('sector-uuid-1');
    expect(result.id).toBe('sector-uuid-1');
  });

  it('findOne lanza NotFoundException si no existe', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
  });

  it('create guarda y retorna el nuevo sector', async () => {
    mockRepo.create.mockReturnValue(mockSector);
    mockRepo.save.mockResolvedValue(mockSector);
    const result = await service.create({ name: 'Sector Norte' });
    expect(result.name).toBe('Sector Norte');
    expect(mockRepo.save).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Verificar que los tests fallan**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
~/.local/bin/pnpm test -- --testPathPattern=sectors.service.spec 2>&1 | tail -8
```

Esperado: FAIL — "Cannot find module './sectors.service'"

- [ ] **Step 5: Implementar `SectorsService`**

`apps/api/src/modules/sectors/sectors.service.ts`:

```typescript
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
}
```

- [ ] **Step 6: Correr tests — deben pasar**

```bash
~/.local/bin/pnpm test -- --testPathPattern=sectors.service.spec 2>&1 | tail -10
```

Esperado: PASS — 4 tests passed.

- [ ] **Step 7: Crear `SectorsController`**

`apps/api/src/modules/sectors/sectors.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SectorsService } from './sectors.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole, type CreateSectorDto, type UpdateSectorDto } from '@velnari/shared-types';
import type { SectorEntity } from '../../entities/sector.entity';

@Controller('sectors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SectorsController {
  constructor(private readonly service: SectorsService) {}

  @Get()
  findAll(): Promise<SectorEntity[]> {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<SectorEntity> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.COMMANDER)
  create(@Body() dto: CreateSectorDto): Promise<SectorEntity> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.COMMANDER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSectorDto,
  ): Promise<SectorEntity> {
    return this.service.update(id, dto);
  }
}
```

- [ ] **Step 8: Crear `SectorsModule`**

`apps/api/src/modules/sectors/sectors.module.ts`:

```typescript
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

- [ ] **Step 9: Registrar en AppModule**

Modificar `apps/api/src/app.module.ts` — agregar al array `imports`:

```typescript
import { SectorsModule } from './modules/sectors/sectors.module';
// ... agregar SectorsModule al array imports
```

- [ ] **Step 10: Typecheck + todos los tests**

```bash
~/.local/bin/pnpm typecheck 2>&1 | tail -3
~/.local/bin/pnpm test 2>&1 | tail -10
```

Esperado: typecheck exit 0, todos los tests pasan.

- [ ] **Step 11: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/api/src/entities/sector.entity.ts apps/api/src/modules/sectors apps/api/src/app.module.ts
git commit -m "feat: add sectors module with CRUD endpoints"
```

---

## Task 3: Unit Entity + Module

**Files:**
- Create: `apps/api/src/entities/unit.entity.ts`
- Create: `apps/api/src/modules/units/units.module.ts`
- Create: `apps/api/src/modules/units/units.service.ts`
- Create: `apps/api/src/modules/units/units.service.spec.ts`
- Create: `apps/api/src/modules/units/units.controller.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Crear directorio**

```bash
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api/src/modules/units"
```

- [ ] **Step 2: Crear `apps/api/src/entities/unit.entity.ts`**

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UnitStatus } from '@velnari/shared-types';
import { SectorEntity } from './sector.entity';
import { UserEntity } from './user.entity';

@Entity('units')
export class UnitEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'call_sign', unique: true })
  callSign!: string; // ej. "P-14"

  @Column({
    type: 'enum',
    enum: UnitStatus,
    default: UnitStatus.AVAILABLE,
  })
  status!: UnitStatus;

  @Column({ name: 'sector_id', nullable: true, type: 'uuid' })
  sectorId?: string;

  @ManyToOne(() => SectorEntity, { nullable: true, eager: false })
  @JoinColumn({ name: 'sector_id' })
  sector?: SectorEntity;

  @Column({ nullable: true })
  shift?: string; // 'morning' | 'afternoon' | 'night'

  @Column({ name: 'assigned_user_id', nullable: true, type: 'uuid' })
  assignedUserId?: string;

  @ManyToOne(() => UserEntity, { nullable: true, eager: false })
  @JoinColumn({ name: 'assigned_user_id' })
  assignedUser?: UserEntity;

  // Posición GPS actual (Point GeoJSON)
  @Column({
    name: 'current_location',
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
    select: false,
  })
  currentLocation?: string;

  @Column({ name: 'last_location_at', nullable: true })
  lastLocationAt?: Date;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

- [ ] **Step 3: Escribir tests del UnitsService (TDD — fallan primero)**

`apps/api/src/modules/units/units.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { UnitsService } from './units.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnitEntity } from '../../entities/unit.entity';
import { NotFoundException, ConflictException } from '@nestjs/common';
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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnitsService,
        { provide: getRepositoryToken(UnitEntity), useValue: mockRepo },
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
});
```

- [ ] **Step 4: Verificar que los tests fallan**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
~/.local/bin/pnpm test -- --testPathPattern=units.service.spec 2>&1 | tail -8
```

Esperado: FAIL — "Cannot find module './units.service'"

- [ ] **Step 5: Implementar `UnitsService`**

`apps/api/src/modules/units/units.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnitEntity } from '../../entities/unit.entity';
import { UnitStatus, type CreateUnitDto } from '@velnari/shared-types';

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

  async updateLocation(
    id: string,
    lat: number,
    lng: number,
  ): Promise<void> {
    // Actualiza posición usando PostGIS ST_SetSRID + ST_MakePoint
    await this.repo
      .createQueryBuilder()
      .update(UnitEntity)
      .set({
        currentLocation: () =>
          `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`,
        lastLocationAt: new Date(),
      })
      .where('id = :id', { id })
      .execute();
  }

  // Retorna unidades disponibles cercanas a un punto
  // En MVP sin PostGIS activo retorna todas las disponibles
  findAvailableNearby(point: NearbyPoint): Promise<UnitEntity[]> {
    // TODO P1: usar ST_DWithin para query geoespacial real cuando PostGIS esté disponible
    return this.repo.find({
      where: { status: UnitStatus.AVAILABLE, isActive: true },
    });
  }
}
```

- [ ] **Step 6: Correr tests — deben pasar**

```bash
~/.local/bin/pnpm test -- --testPathPattern=units.service.spec 2>&1 | tail -10
```

Esperado: PASS — 5 tests passed.

- [ ] **Step 7: Crear `UnitsController`**

`apps/api/src/modules/units/units.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UnitsService } from './units.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import {
  UserRole,
  UnitStatus,
  type CreateUnitDto,
  type UpdateUnitStatusDto,
} from '@velnari/shared-types';
import type { UnitEntity } from '../../entities/unit.entity';

@Controller('units')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UnitsController {
  constructor(private readonly service: UnitsService) {}

  @Get()
  findAll(
    @Query('status') status?: UnitStatus,
    @Query('sectorId') sectorId?: string,
    @Query('shift') shift?: string,
  ): Promise<UnitEntity[]> {
    return this.service.findAll({ status, sectorId, shift });
  }

  @Get('nearby')
  findNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ): Promise<UnitEntity[]> {
    return this.service.findAvailableNearby({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UnitEntity> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.COMMANDER, UserRole.SUPERVISOR)
  create(@Body() dto: CreateUnitDto): Promise<UnitEntity> {
    return this.service.create(dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.FIELD_UNIT)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnitStatusDto,
  ): Promise<UnitEntity> {
    return this.service.updateStatus(id, dto.status);
  }
}
```

- [ ] **Step 8: Crear `UnitsModule`**

`apps/api/src/modules/units/units.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitEntity } from '../../entities/unit.entity';
import { UnitsService } from './units.service';
import { UnitsController } from './units.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UnitEntity])],
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService],
})
export class UnitsModule {}
```

- [ ] **Step 9: Agregar UnitsModule al AppModule**

En `apps/api/src/app.module.ts`, agregar:
```typescript
import { UnitsModule } from './modules/units/units.module';
// Agregar UnitsModule al array imports
```

- [ ] **Step 10: Typecheck + todos los tests**

```bash
~/.local/bin/pnpm typecheck 2>&1 | tail -3
~/.local/bin/pnpm test 2>&1 | tail -10
```

Esperado: todos los tests pasan.

- [ ] **Step 11: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/api/src/entities/unit.entity.ts apps/api/src/modules/units apps/api/src/app.module.ts
git commit -m "feat: add units module with status management and GPS location update"
```

---

## Task 4: Incident + IncidentEvent Entities + Module

**Files:**
- Create: `apps/api/src/entities/incident.entity.ts`
- Create: `apps/api/src/entities/incident-event.entity.ts`
- Create: `apps/api/src/modules/incidents/incidents.module.ts`
- Create: `apps/api/src/modules/incidents/incidents.service.ts`
- Create: `apps/api/src/modules/incidents/incidents.service.spec.ts`
- Create: `apps/api/src/modules/incidents/incidents.controller.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Crear directorio**

```bash
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api/src/modules/incidents"
```

- [ ] **Step 2: Crear `apps/api/src/entities/incident.entity.ts`**

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IncidentPriority, IncidentStatus, IncidentType } from '@velnari/shared-types';
import { SectorEntity } from './sector.entity';
import { UnitEntity } from './unit.entity';
import { UserEntity } from './user.entity';
import { IncidentEventEntity } from './incident-event.entity';

@Entity('incidents')
export class IncidentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Folio legible: IC-001, IC-002, etc.
  @Column({ unique: true })
  folio!: string;

  @Column({ type: 'enum', enum: IncidentType })
  type!: IncidentType;

  @Column({ type: 'enum', enum: IncidentPriority })
  priority!: IncidentPriority;

  @Column({
    type: 'enum',
    enum: IncidentStatus,
    default: IncidentStatus.OPEN,
  })
  status!: IncidentStatus;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  // Ubicación del incidente
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    select: false,
  })
  location!: string;

  // Coordenadas desnormalizadas para queries rápidas sin PostGIS
  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lat!: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lng!: number;

  @Column({ name: 'sector_id', nullable: true, type: 'uuid' })
  sectorId?: string;

  @ManyToOne(() => SectorEntity, { nullable: true, eager: false })
  @JoinColumn({ name: 'sector_id' })
  sector?: SectorEntity;

  @Column({ name: 'assigned_unit_id', nullable: true, type: 'uuid' })
  assignedUnitId?: string;

  @ManyToOne(() => UnitEntity, { nullable: true, eager: false })
  @JoinColumn({ name: 'assigned_unit_id' })
  assignedUnit?: UnitEntity;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'created_by' })
  creator?: UserEntity;

  // Timestamps operativos
  @Column({ name: 'assigned_at', nullable: true })
  assignedAt?: Date;

  @Column({ name: 'arrived_at', nullable: true })
  arrivedAt?: Date;

  @Column({ name: 'closed_at', nullable: true })
  closedAt?: Date;

  @Column({ nullable: true })
  resolution?: string;

  @Column({ name: 'resolution_notes', nullable: true, type: 'text' })
  resolutionNotes?: string;

  @OneToMany(() => IncidentEventEntity, (e) => e.incident, { eager: false })
  events?: IncidentEventEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

- [ ] **Step 3: Crear `apps/api/src/entities/incident-event.entity.ts`**

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IncidentEntity } from './incident.entity';
import { UserEntity } from './user.entity';

@Entity('incident_events')
export class IncidentEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'incident_id', type: 'uuid' })
  incidentId!: string;

  @ManyToOne(() => IncidentEntity, (i) => i.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident!: IncidentEntity;

  // Tipo de evento: 'created' | 'assigned' | 'en_route' | 'on_scene' | 'note' | 'closed'
  @Column()
  type!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId!: string;

  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'actor_id' })
  actor?: UserEntity;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
```

- [ ] **Step 4: Escribir tests del IncidentsService (TDD — fallan primero)**

`apps/api/src/modules/incidents/incidents.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { IncidentsService } from './incidents.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IncidentEntity } from '../../entities/incident.entity';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import { NotFoundException } from '@nestjs/common';
import { IncidentPriority, IncidentStatus, IncidentType } from '@velnari/shared-types';

describe('IncidentsService', () => {
  let service: IncidentsService;

  const mockIncident: IncidentEntity = {
    id: 'incident-uuid-1',
    folio: 'IC-001',
    type: IncidentType.ROBBERY,
    priority: IncidentPriority.HIGH,
    status: IncidentStatus.OPEN,
    lat: 19.4326,
    lng: -99.1332,
    location: '',
    createdBy: 'user-uuid-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockIncidentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockEventRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        { provide: getRepositoryToken(IncidentEntity), useValue: mockIncidentRepo },
        { provide: getRepositoryToken(IncidentEventEntity), useValue: mockEventRepo },
      ],
    }).compile();

    service = module.get<IncidentsService>(IncidentsService);
    jest.clearAllMocks();
  });

  it('findAll retorna incidentes activos', async () => {
    mockIncidentRepo.find.mockResolvedValue([mockIncident]);
    const result = await service.findAll({});
    expect(result).toHaveLength(1);
  });

  it('findOne retorna incidente por id', async () => {
    mockIncidentRepo.findOne.mockResolvedValue(mockIncident);
    const result = await service.findOne('incident-uuid-1');
    expect(result.folio).toBe('IC-001');
  });

  it('findOne lanza NotFoundException si no existe', async () => {
    mockIncidentRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
  });

  it('create genera folio y guarda incidente', async () => {
    mockIncidentRepo.count.mockResolvedValue(0);
    mockIncidentRepo.create.mockReturnValue({ ...mockIncident, folio: 'IC-001' });
    mockIncidentRepo.save.mockResolvedValue(mockIncident);
    mockEventRepo.create.mockReturnValue({});
    mockEventRepo.save.mockResolvedValue({});

    const result = await service.create(
      {
        type: IncidentType.ROBBERY,
        priority: IncidentPriority.HIGH,
        lat: 19.4326,
        lng: -99.1332,
      },
      'user-uuid-1',
    );

    expect(mockIncidentRepo.save).toHaveBeenCalled();
    expect(result.folio).toBe('IC-001');
  });

  it('close actualiza estado y timestamps', async () => {
    const closedIncident = {
      ...mockIncident,
      status: IncidentStatus.CLOSED,
      closedAt: new Date(),
      resolution: 'no_action',
    };
    mockIncidentRepo.findOne.mockResolvedValue({ ...mockIncident });
    mockIncidentRepo.save.mockResolvedValue(closedIncident);
    mockEventRepo.create.mockReturnValue({});
    mockEventRepo.save.mockResolvedValue({});

    const result = await service.close('incident-uuid-1', { resolution: 'no_action' }, 'user-uuid-1');
    expect(result.status).toBe(IncidentStatus.CLOSED);
  });
});
```

- [ ] **Step 5: Verificar que los tests fallan**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
~/.local/bin/pnpm test -- --testPathPattern=incidents.service.spec 2>&1 | tail -8
```

Esperado: FAIL — "Cannot find module './incidents.service'"

- [ ] **Step 6: Implementar `IncidentsService`**

`apps/api/src/modules/incidents/incidents.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentEntity } from '../../entities/incident.entity';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import { IncidentStatus, type CreateIncidentDto, type CloseIncidentDto, type AddIncidentNoteDto } from '@velnari/shared-types';

interface FindAllFilters {
  status?: IncidentStatus;
  sectorId?: string;
  priority?: string;
}

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(IncidentEntity)
    private readonly repo: Repository<IncidentEntity>,
    @InjectRepository(IncidentEventEntity)
    private readonly eventRepo: Repository<IncidentEventEntity>,
  ) {}

  findAll(filters: FindAllFilters): Promise<IncidentEntity[]> {
    const where: Record<string, unknown> = {};
    if (filters.status) where['status'] = filters.status;
    else {
      // Por defecto: solo incidentes no cerrados
    }
    if (filters.sectorId) where['sectorId'] = filters.sectorId;
    if (filters.priority) where['priority'] = filters.priority;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<IncidentEntity> {
    const incident = await this.repo.findOne({
      where: { id },
      relations: ['events'],
    });
    if (!incident) throw new NotFoundException(`Incidente ${id} no encontrado`);
    return incident;
  }

  async create(dto: CreateIncidentDto, actorId: string): Promise<IncidentEntity> {
    // Generar folio secuencial: IC-001, IC-002, ...
    const count = await this.repo.count();
    const folio = `IC-${String(count + 1).padStart(3, '0')}`;

    const incident = this.repo.create({
      folio,
      type: dto.type,
      priority: dto.priority,
      lat: dto.lat,
      lng: dto.lng,
      address: dto.address,
      description: dto.description,
      sectorId: dto.sectorId,
      createdBy: actorId,
      status: IncidentStatus.OPEN,
      // PostGIS point: se actualiza en migration con trigger o en update
      location: `SRID=4326;POINT(${dto.lng} ${dto.lat})`,
    });

    const saved = await this.repo.save(incident);

    // Crear evento de timeline
    const event = this.eventRepo.create({
      incidentId: saved.id,
      type: 'created',
      description: `Incidente ${folio} creado`,
      actorId,
    });
    await this.eventRepo.save(event);

    return saved;
  }

  async close(id: string, dto: CloseIncidentDto, actorId: string): Promise<IncidentEntity> {
    const incident = await this.findOne(id);
    incident.status = IncidentStatus.CLOSED;
    incident.closedAt = new Date();
    incident.resolution = dto.resolution;
    incident.resolutionNotes = dto.notes;
    const saved = await this.repo.save(incident);

    const event = this.eventRepo.create({
      incidentId: id,
      type: 'closed',
      description: `Incidente cerrado. Resolución: ${dto.resolution}`,
      actorId,
      metadata: { resolution: dto.resolution },
    });
    await this.eventRepo.save(event);

    return saved;
  }

  async addNote(id: string, dto: AddIncidentNoteDto, actorId: string): Promise<IncidentEventEntity> {
    // Verificar que el incidente existe
    await this.findOne(id);

    const event = this.eventRepo.create({
      incidentId: id,
      type: 'note',
      description: dto.text,
      actorId,
    });
    return this.eventRepo.save(event);
  }

  getEvents(incidentId: string): Promise<IncidentEventEntity[]> {
    return this.eventRepo.find({
      where: { incidentId },
      order: { createdAt: 'ASC' },
    });
  }
}
```

- [ ] **Step 7: Correr tests — deben pasar**

```bash
~/.local/bin/pnpm test -- --testPathPattern=incidents.service.spec 2>&1 | tail -10
```

Esperado: PASS — 5 tests passed.

- [ ] **Step 8: Crear `IncidentsController`**

`apps/api/src/modules/incidents/incidents.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '../../shared/decorators/current-user.decorator';
import {
  UserRole,
  IncidentStatus,
  type CreateIncidentDto,
  type CloseIncidentDto,
  type AddIncidentNoteDto,
} from '@velnari/shared-types';
import type { IncidentEntity } from '../../entities/incident.entity';
import type { IncidentEventEntity } from '../../entities/incident-event.entity';

@Controller('incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncidentsController {
  constructor(private readonly service: IncidentsService) {}

  @Get()
  findAll(
    @Query('status') status?: IncidentStatus,
    @Query('sectorId') sectorId?: string,
    @Query('priority') priority?: string,
  ): Promise<IncidentEntity[]> {
    return this.service.findAll({ status, sectorId, priority });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<IncidentEntity> {
    return this.service.findOne(id);
  }

  @Get(':id/events')
  getEvents(@Param('id', ParseUUIDPipe) id: string): Promise<IncidentEventEntity[]> {
    return this.service.getEvents(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPERVISOR)
  create(
    @Body() dto: CreateIncidentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<IncidentEntity> {
    return this.service.create(dto, user.sub);
  }

  @Post(':id/close')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.FIELD_UNIT)
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseIncidentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<IncidentEntity> {
    return this.service.close(id, dto, user.sub);
  }

  @Post(':id/notes')
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddIncidentNoteDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<IncidentEventEntity> {
    return this.service.addNote(id, dto, user.sub);
  }
}
```

- [ ] **Step 9: Crear `IncidentsModule`**

`apps/api/src/modules/incidents/incidents.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentEntity } from '../../entities/incident.entity';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';

@Module({
  imports: [TypeOrmModule.forFeature([IncidentEntity, IncidentEventEntity])],
  controllers: [IncidentsController],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
```

- [ ] **Step 10: Registrar en AppModule**

En `apps/api/src/app.module.ts`:
```typescript
import { IncidentsModule } from './modules/incidents/incidents.module';
// Agregar IncidentsModule al array imports
```

- [ ] **Step 11: Typecheck + todos los tests**

```bash
~/.local/bin/pnpm typecheck 2>&1 | tail -3
~/.local/bin/pnpm test 2>&1 | tail -10
```

Esperado: todos los tests pasan.

- [ ] **Step 12: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/api/src/entities/incident.entity.ts apps/api/src/entities/incident-event.entity.ts apps/api/src/modules/incidents apps/api/src/app.module.ts
git commit -m "feat: add incidents module with timeline events and close flow"
```

---

## Task 5: Dispatch Module

**Files:**
- Create: `apps/api/src/modules/dispatch/dispatch.module.ts`
- Create: `apps/api/src/modules/dispatch/dispatch.service.ts`
- Create: `apps/api/src/modules/dispatch/dispatch.service.spec.ts`
- Create: `apps/api/src/modules/dispatch/dispatch.controller.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Crear directorio**

```bash
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api/src/modules/dispatch"
```

- [ ] **Step 2: Escribir tests del DispatchService (TDD — fallan primero)**

`apps/api/src/modules/dispatch/dispatch.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { DispatchService } from './dispatch.service';
import { IncidentsService } from '../incidents/incidents.service';
import { UnitsService } from '../units/units.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import { BadRequestException } from '@nestjs/common';
import { IncidentPriority, IncidentStatus, IncidentType, UnitStatus } from '@velnari/shared-types';

describe('DispatchService', () => {
  let service: DispatchService;

  const mockIncident = {
    id: 'incident-uuid-1',
    folio: 'IC-001',
    type: IncidentType.ROBBERY,
    priority: IncidentPriority.HIGH,
    status: IncidentStatus.OPEN,
    assignedUnitId: undefined,
    lat: 19.4,
    lng: -99.1,
    location: '',
    createdBy: 'user-uuid-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUnit = {
    id: 'unit-uuid-1',
    callSign: 'P-14',
    status: UnitStatus.AVAILABLE,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockIncidentsService = {
    findOne: jest.fn(),
    repo: { save: jest.fn() },
  };

  const mockUnitsService = {
    findOne: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockEventRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchService,
        { provide: IncidentsService, useValue: mockIncidentsService },
        { provide: UnitsService, useValue: mockUnitsService },
        { provide: getRepositoryToken(IncidentEventEntity), useValue: mockEventRepo },
      ],
    }).compile();

    service = module.get<DispatchService>(DispatchService);
    jest.clearAllMocks();
  });

  it('assignUnit asigna unidad disponible al incidente', async () => {
    mockIncidentsService.findOne.mockResolvedValue({ ...mockIncident });
    mockUnitsService.findOne.mockResolvedValue({ ...mockUnit });
    mockUnitsService.updateStatus.mockResolvedValue({ ...mockUnit, status: UnitStatus.EN_ROUTE });
    mockIncidentsService.repo.save = jest.fn().mockResolvedValue({
      ...mockIncident,
      assignedUnitId: 'unit-uuid-1',
      status: IncidentStatus.ASSIGNED,
    });
    mockEventRepo.create.mockReturnValue({});
    mockEventRepo.save.mockResolvedValue({});

    const result = await service.assignUnit('incident-uuid-1', 'unit-uuid-1', 'operator-uuid-1');

    expect(mockUnitsService.updateStatus).toHaveBeenCalledWith('unit-uuid-1', UnitStatus.EN_ROUTE);
    expect(result.status).toBe(IncidentStatus.ASSIGNED);
  });

  it('assignUnit lanza BadRequestException si la unidad no está disponible', async () => {
    mockIncidentsService.findOne.mockResolvedValue({ ...mockIncident });
    mockUnitsService.findOne.mockResolvedValue({ ...mockUnit, status: UnitStatus.ON_SCENE });

    await expect(
      service.assignUnit('incident-uuid-1', 'unit-uuid-1', 'operator-uuid-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('assignUnit lanza BadRequestException si el incidente ya está cerrado', async () => {
    mockIncidentsService.findOne.mockResolvedValue({
      ...mockIncident,
      status: IncidentStatus.CLOSED,
    });
    mockUnitsService.findOne.mockResolvedValue({ ...mockUnit });

    await expect(
      service.assignUnit('incident-uuid-1', 'unit-uuid-1', 'operator-uuid-1'),
    ).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 3: Verificar que los tests fallan**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
~/.local/bin/pnpm test -- --testPathPattern=dispatch.service.spec 2>&1 | tail -8
```

Esperado: FAIL — "Cannot find module './dispatch.service'"

- [ ] **Step 4: Implementar `DispatchService`**

`apps/api/src/modules/dispatch/dispatch.service.ts`:

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentsService } from '../incidents/incidents.service';
import { UnitsService } from '../units/units.service';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import { IncidentStatus, UnitStatus } from '@velnari/shared-types';
import type { IncidentEntity } from '../../entities/incident.entity';

@Injectable()
export class DispatchService {
  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly unitsService: UnitsService,
    @InjectRepository(IncidentEventEntity)
    private readonly eventRepo: Repository<IncidentEventEntity>,
  ) {}

  async assignUnit(
    incidentId: string,
    unitId: string,
    actorId: string,
  ): Promise<IncidentEntity> {
    const [incident, unit] = await Promise.all([
      this.incidentsService.findOne(incidentId),
      this.unitsService.findOne(unitId),
    ]);

    if (incident.status === IncidentStatus.CLOSED) {
      throw new BadRequestException('No se puede asignar una unidad a un incidente cerrado.');
    }

    if (unit.status !== UnitStatus.AVAILABLE) {
      throw new BadRequestException(
        `La unidad ${unit.callSign} no está disponible (estado: ${unit.status}).`,
      );
    }

    // Actualizar incidente
    incident.assignedUnitId = unitId;
    incident.status = IncidentStatus.ASSIGNED;
    incident.assignedAt = new Date();

    // Actualizar estado de la unidad
    await this.unitsService.updateStatus(unitId, UnitStatus.EN_ROUTE);

    // Guardar incidente actualizado
    // Accedemos al repo del IncidentsService indirectamente via el servicio
    // Para evitar dependencia circular usamos el método que provee el servicio
    const savedIncident = await (this.incidentsService as unknown as {
      repo: { save: (e: IncidentEntity) => Promise<IncidentEntity> };
    }).repo.save(incident);

    // Crear evento de timeline
    const event = this.eventRepo.create({
      incidentId,
      type: 'assigned',
      description: `Unidad ${unit.callSign} asignada al incidente`,
      actorId,
      metadata: { unitId, callSign: unit.callSign },
    });
    await this.eventRepo.save(event);

    return savedIncident;
  }
}
```

**Nota:** El acceso directo al repo del IncidentsService no es ideal. Agregaremos un método `save` al IncidentsService en el siguiente paso.

- [ ] **Step 5: Agregar método `save` a IncidentsService**

Modificar `apps/api/src/modules/incidents/incidents.service.ts` — agregar al final de la clase:

```typescript
  // Método interno para que DispatchService pueda guardar el incidente actualizado
  saveIncident(incident: IncidentEntity): Promise<IncidentEntity> {
    return this.repo.save(incident);
  }
```

- [ ] **Step 6: Actualizar DispatchService para usar el método limpio**

Modificar `apps/api/src/modules/dispatch/dispatch.service.ts` — reemplazar el bloque del `savedIncident` por:

```typescript
    const savedIncident = await this.incidentsService.saveIncident(incident);
```

Y actualizar la línea de importación del tipo (eliminar el cast `unknown`):

```typescript
    const savedIncident = await this.incidentsService.saveIncident(incident);
```

El `DispatchService` completo y limpio queda:

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentsService } from '../incidents/incidents.service';
import { UnitsService } from '../units/units.service';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import { IncidentStatus, UnitStatus } from '@velnari/shared-types';
import type { IncidentEntity } from '../../entities/incident.entity';

@Injectable()
export class DispatchService {
  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly unitsService: UnitsService,
    @InjectRepository(IncidentEventEntity)
    private readonly eventRepo: Repository<IncidentEventEntity>,
  ) {}

  async assignUnit(
    incidentId: string,
    unitId: string,
    actorId: string,
  ): Promise<IncidentEntity> {
    const [incident, unit] = await Promise.all([
      this.incidentsService.findOne(incidentId),
      this.unitsService.findOne(unitId),
    ]);

    if (incident.status === IncidentStatus.CLOSED) {
      throw new BadRequestException('No se puede asignar una unidad a un incidente cerrado.');
    }

    if (unit.status !== UnitStatus.AVAILABLE) {
      throw new BadRequestException(
        `La unidad ${unit.callSign} no está disponible (estado: ${unit.status}).`,
      );
    }

    incident.assignedUnitId = unitId;
    incident.status = IncidentStatus.ASSIGNED;
    incident.assignedAt = new Date();

    await this.unitsService.updateStatus(unitId, UnitStatus.EN_ROUTE);
    const savedIncident = await this.incidentsService.saveIncident(incident);

    const event = this.eventRepo.create({
      incidentId,
      type: 'assigned',
      description: `Unidad ${unit.callSign} asignada al incidente`,
      actorId,
      metadata: { unitId, callSign: unit.callSign },
    });
    await this.eventRepo.save(event);

    return savedIncident;
  }
}
```

- [ ] **Step 7: Correr tests del dispatch — deben pasar**

```bash
~/.local/bin/pnpm test -- --testPathPattern=dispatch.service.spec 2>&1 | tail -10
```

Esperado: PASS — 3 tests passed.

- [ ] **Step 8: Crear `DispatchController`**

`apps/api/src/modules/dispatch/dispatch.controller.ts`:

```typescript
import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '../../shared/decorators/current-user.decorator';
import { UserRole, type AssignUnitDto } from '@velnari/shared-types';
import type { IncidentEntity } from '../../entities/incident.entity';

@Controller('incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Post(':id/assign')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPERVISOR)
  assignUnit(
    @Param('id', ParseUUIDPipe) incidentId: string,
    @Body() dto: AssignUnitDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<IncidentEntity> {
    return this.dispatchService.assignUnit(incidentId, dto.unitId, user.sub);
  }
}
```

- [ ] **Step 9: Crear `DispatchModule`**

`apps/api/src/modules/dispatch/dispatch.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';
import { IncidentsModule } from '../incidents/incidents.module';
import { UnitsModule } from '../units/units.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IncidentEventEntity]),
    IncidentsModule,
    UnitsModule,
  ],
  controllers: [DispatchController],
  providers: [DispatchService],
  exports: [DispatchService],
})
export class DispatchModule {}
```

- [ ] **Step 10: Registrar en AppModule**

En `apps/api/src/app.module.ts`:
```typescript
import { DispatchModule } from './modules/dispatch/dispatch.module';
// Agregar DispatchModule al array imports
```

- [ ] **Step 11: Typecheck + todos los tests**

```bash
~/.local/bin/pnpm typecheck 2>&1 | tail -3
~/.local/bin/pnpm test 2>&1 | tail -15
```

Esperado: todos los tests pasan (al menos 17: 4 guard + 5 auth + 3 interceptor + 4 sectors + 5 units + 5 incidents + 3 dispatch).

- [ ] **Step 12: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/api/src/modules/dispatch apps/api/src/modules/incidents/incidents.service.ts apps/api/src/app.module.ts
git commit -m "feat: add dispatch module with unit assignment and conflict validation"
```

---

## Task 6: WebSocket Realtime Gateway

**Files:**
- Create: `apps/api/src/modules/realtime/realtime.module.ts`
- Create: `apps/api/src/modules/realtime/realtime.gateway.ts`
- Create: `apps/api/src/modules/realtime/realtime.gateway.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Crear directorio**

```bash
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api/src/modules/realtime"
```

- [ ] **Step 2: Instalar dependencias de Socket.IO si no están**

Verificar que `@nestjs/websockets` y `@nestjs/platform-socket.io` están en `apps/api/package.json` (ya deben estar del Plan 1). Si no:

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
~/.local/bin/pnpm add socket.io
```

- [ ] **Step 3: Escribir tests del Gateway (TDD — fallan primero)**

`apps/api/src/modules/realtime/realtime.gateway.spec.ts`:

```typescript
import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  beforeEach(() => {
    gateway = new RealtimeGateway();
    // Inyectar server mock
    gateway['server'] = mockServer as never;
    jest.clearAllMocks();
  });

  it('emitUnitLocationChanged emite al room correcto', () => {
    gateway.emitUnitLocationChanged('sector-1', {
      unitId: 'unit-1',
      lat: 19.4,
      lng: -99.1,
      timestamp: new Date().toISOString(),
    });

    expect(mockServer.to).toHaveBeenCalledWith('sector:sector-1');
    expect(mockServer.emit).toHaveBeenCalledWith(
      'unit:location:changed',
      expect.objectContaining({ unitId: 'unit-1' }),
    );
  });

  it('emitUnitStatusChanged emite al room command', () => {
    gateway.emitUnitStatusChanged({
      unitId: 'unit-1',
      status: 'en_route',
      previousStatus: 'available',
    });

    expect(mockServer.to).toHaveBeenCalledWith('command');
    expect(mockServer.emit).toHaveBeenCalledWith(
      'unit:status:changed',
      expect.objectContaining({ unitId: 'unit-1', status: 'en_route' }),
    );
  });

  it('emitIncidentCreated emite al room command', () => {
    gateway.emitIncidentCreated({ id: 'inc-1', folio: 'IC-001' });

    expect(mockServer.to).toHaveBeenCalledWith('command');
    expect(mockServer.emit).toHaveBeenCalledWith(
      'incident:created',
      expect.objectContaining({ folio: 'IC-001' }),
    );
  });

  it('emitIncidentAssigned emite al room correcto', () => {
    gateway.emitIncidentAssigned('inc-1', 'unit-1');

    expect(mockServer.to).toHaveBeenCalledWith('incident:inc-1');
    expect(mockServer.emit).toHaveBeenCalledWith('incident:assigned', {
      incidentId: 'inc-1',
      unitId: 'unit-1',
    });
  });
});
```

- [ ] **Step 4: Verificar que los tests fallan**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
~/.local/bin/pnpm test -- --testPathPattern=realtime.gateway.spec 2>&1 | tail -8
```

Esperado: FAIL — "Cannot find module './realtime.gateway'"

- [ ] **Step 5: Implementar `RealtimeGateway`**

`apps/api/src/modules/realtime/realtime.gateway.ts`:

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';

// Rooms:
//   'command'           → todos los operadores y supervisores (vista Command)
//   'sector:{sectorId}' → unidades del sector específico
//   'incident:{id}'     → seguimiento de un incidente concreto

@WebSocketGateway({
  cors: {
    origin: process.env['ALLOWED_ORIGINS']?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  },
  namespace: '/',
})
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  // ─── Client events (recibidos del cliente) ───────────────────────────────

  @SubscribeMessage('join:command')
  handleJoinCommand(@ConnectedSocket() client: Socket): void {
    void client.join('command');
    this.logger.log(`Client ${client.id} joined room: command`);
  }

  @SubscribeMessage('join:sector')
  handleJoinSector(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sectorId: string },
  ): void {
    const room = `sector:${data.sectorId}`;
    void client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);
  }

  @SubscribeMessage('join:incident')
  handleJoinIncident(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { incidentId: string },
  ): void {
    const room = `incident:${data.incidentId}`;
    void client.join(room);
  }

  // ─── Server events (emitidos desde servicios) ────────────────────────────

  emitUnitLocationChanged(
    sectorId: string | undefined,
    payload: { unitId: string; lat: number; lng: number; timestamp: string },
  ): void {
    const room = sectorId ? `sector:${sectorId}` : 'command';
    this.server.to(room).emit('unit:location:changed', payload);
  }

  emitUnitStatusChanged(payload: {
    unitId: string;
    status: string;
    previousStatus: string;
  }): void {
    this.server.to('command').emit('unit:status:changed', payload);
  }

  emitIncidentCreated(incident: Record<string, unknown>): void {
    this.server.to('command').emit('incident:created', incident);
  }

  emitIncidentAssigned(incidentId: string, unitId: string): void {
    this.server
      .to(`incident:${incidentId}`)
      .emit('incident:assigned', { incidentId, unitId });
  }

  emitIncidentStatusChanged(incidentId: string, status: string): void {
    this.server
      .to(`incident:${incidentId}`)
      .emit('incident:status:changed', { incidentId, status });
  }

  emitIncidentClosed(incidentId: string, resolution: string): void {
    this.server
      .to('command')
      .emit('incident:closed', { incidentId, resolution });
  }
}
```

- [ ] **Step 6: Correr tests — deben pasar**

```bash
~/.local/bin/pnpm test -- --testPathPattern=realtime.gateway.spec 2>&1 | tail -10
```

Esperado: PASS — 4 tests passed.

- [ ] **Step 7: Crear `RealtimeModule`**

`apps/api/src/modules/realtime/realtime.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
```

- [ ] **Step 8: Registrar RealtimeModule en AppModule**

En `apps/api/src/app.module.ts`:
```typescript
import { RealtimeModule } from './modules/realtime/realtime.module';
// Agregar RealtimeModule al array imports
```

- [ ] **Step 9: Typecheck + todos los tests**

```bash
~/.local/bin/pnpm typecheck 2>&1 | tail -3
~/.local/bin/pnpm test 2>&1 | tail -15
```

Esperado: todos los tests pasan.

- [ ] **Step 10: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/api/src/modules/realtime apps/api/src/app.module.ts
git commit -m "feat: add socket.io realtime gateway with rooms for command, sectors and incidents"
```

---

## Task 7: Redis Position Cache Service

**Files:**
- Create: `apps/api/src/shared/services/redis-cache.service.ts`
- Create: `apps/api/src/shared/services/redis-cache.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Crear directorio**

```bash
mkdir -p "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api/src/shared/services"
```

- [ ] **Step 2: Instalar ioredis**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
~/.local/bin/pnpm add ioredis
~/.local/bin/pnpm add -D @types/ioredis
```

- [ ] **Step 3: Escribir tests del RedisCacheService (TDD — fallan primero)**

`apps/api/src/shared/services/redis-cache.service.spec.ts`:

```typescript
import { RedisCacheService } from './redis-cache.service';

describe('RedisCacheService', () => {
  let service: RedisCacheService;

  const mockRedis = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
  };

  beforeEach(() => {
    service = new RedisCacheService({ host: 'localhost', port: 6379 });
    // Reemplazar cliente real con mock
    service['client'] = mockRedis as never;
    jest.clearAllMocks();
  });

  it('setUnitPosition guarda posición con TTL', async () => {
    await service.setUnitPosition('unit-1', { lat: 19.4, lng: -99.1 });

    expect(mockRedis.set).toHaveBeenCalledWith(
      'unit:unit-1:position',
      JSON.stringify({ lat: 19.4, lng: -99.1 }),
      'EX',
      60,
    );
  });

  it('getUnitPosition retorna posición si existe', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ lat: 19.4, lng: -99.1 }));

    const result = await service.getUnitPosition('unit-1');

    expect(result).toEqual({ lat: 19.4, lng: -99.1 });
  });

  it('getUnitPosition retorna null si no existe', async () => {
    mockRedis.get.mockResolvedValue(null);

    const result = await service.getUnitPosition('unit-1');

    expect(result).toBeNull();
  });

  it('clearUnitPosition elimina la clave', async () => {
    await service.clearUnitPosition('unit-1');

    expect(mockRedis.del).toHaveBeenCalledWith('unit:unit-1:position');
  });
});
```

- [ ] **Step 4: Verificar que los tests fallan**

```bash
~/.local/bin/pnpm test -- --testPathPattern=redis-cache.service.spec 2>&1 | tail -8
```

Esperado: FAIL — "Cannot find module './redis-cache.service'"

- [ ] **Step 5: Implementar `RedisCacheService`**

`apps/api/src/shared/services/redis-cache.service.ts`:

```typescript
import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

interface UnitPosition {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  timestamp?: string;
}

const POSITION_TTL_SECONDS = 60;

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly client: Redis;

  constructor(config: { host: string; port: number }) {
    this.client = new Redis({
      host: config.host,
      port: config.port,
      lazyConnect: true,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
    });

    this.client.on('error', (err: Error) => {
      this.logger.error(`Redis error: ${err.message}`);
    });
  }

  async setUnitPosition(unitId: string, position: UnitPosition): Promise<void> {
    const key = `unit:${unitId}:position`;
    await this.client.set(key, JSON.stringify(position), 'EX', POSITION_TTL_SECONDS);
  }

  async getUnitPosition(unitId: string): Promise<UnitPosition | null> {
    const key = `unit:${unitId}:position`;
    const value = await this.client.get(key);
    if (!value) return null;
    return JSON.parse(value) as UnitPosition;
  }

  async clearUnitPosition(unitId: string): Promise<void> {
    const key = `unit:${unitId}:position`;
    await this.client.del(key);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
```

- [ ] **Step 6: Correr tests — deben pasar**

```bash
~/.local/bin/pnpm test -- --testPathPattern=redis-cache.service.spec 2>&1 | tail -10
```

Esperado: PASS — 4 tests passed.

- [ ] **Step 7: Registrar RedisCacheService en AppModule como provider global**

Modificar `apps/api/src/app.module.ts` — agregar en `providers`:

```typescript
import { RedisCacheService } from './shared/services/redis-cache.service';
import { ConfigService } from '@nestjs/config';
```

En el array `providers` existente (que ya tiene `APP_INTERCEPTOR`), agregar:

```typescript
{
  provide: RedisCacheService,
  useFactory: (config: ConfigService) =>
    new RedisCacheService({
      host: config.get<string>('redis.host') ?? 'localhost',
      port: config.get<number>('redis.port') ?? 6379,
    }),
  inject: [ConfigService],
},
```

Y exportarlo para que lo puedan usar otros módulos — agregar `exports: [RedisCacheService]` al módulo.

- [ ] **Step 8: Typecheck + todos los tests**

```bash
~/.local/bin/pnpm typecheck 2>&1 | tail -3
~/.local/bin/pnpm test 2>&1 | tail -15
```

Esperado: todos los tests pasan.

- [ ] **Step 9: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/api/src/shared/services apps/api/src/app.module.ts
git commit -m "feat: add redis position cache service for unit GPS tracking"
```

---

## Task 8: Migration para schema core

**Files:**
- Create: `apps/api/src/database/migrations/002_core_schema.ts`

- [ ] **Step 1: Crear `apps/api/src/database/migrations/002_core_schema.ts`**

```typescript
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CoreSchema1704153600000 implements MigrationInterface {
  name = 'CoreSchema1704153600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Enums ──────────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS unit_status AS ENUM (
        'available', 'en_route', 'on_scene', 'out_of_service'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS incident_priority AS ENUM (
        'critical', 'high', 'medium', 'low'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS incident_status AS ENUM (
        'open', 'assigned', 'en_route', 'on_scene', 'closed'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS incident_type AS ENUM (
        'robbery', 'assault', 'traffic', 'noise', 'domestic', 'missing_person', 'other'
      )
    `);

    // ─── Tabla: sectors ──────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "sectors" (
        "id"         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name"       VARCHAR NOT NULL UNIQUE,
        "boundary"   geometry(Polygon, 4326),
        "color"      VARCHAR NOT NULL DEFAULT '#3B82F6',
        "is_active"  BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_sectors_boundary" ON "sectors" USING GIST ("boundary")
    `);

    // ─── Tabla: units ─────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "units" (
        "id"               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "call_sign"        VARCHAR NOT NULL UNIQUE,
        "status"           unit_status NOT NULL DEFAULT 'available',
        "sector_id"        UUID REFERENCES "sectors"("id"),
        "shift"            VARCHAR,
        "assigned_user_id" UUID REFERENCES "users"("id"),
        "current_location" geometry(Point, 4326),
        "last_location_at" TIMESTAMPTZ,
        "is_active"        BOOLEAN NOT NULL DEFAULT true,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_units_status" ON "units" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_units_sector" ON "units" ("sector_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_units_location" ON "units" USING GIST ("current_location")
    `);

    // ─── Tabla: incidents ─────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "incidents" (
        "id"               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "folio"            VARCHAR NOT NULL UNIQUE,
        "type"             incident_type NOT NULL,
        "priority"         incident_priority NOT NULL,
        "status"           incident_status NOT NULL DEFAULT 'open',
        "address"          VARCHAR,
        "description"      TEXT,
        "location"         geometry(Point, 4326) NOT NULL,
        "lat"              DECIMAL(10,7) NOT NULL,
        "lng"              DECIMAL(10,7) NOT NULL,
        "sector_id"        UUID REFERENCES "sectors"("id"),
        "assigned_unit_id" UUID REFERENCES "units"("id"),
        "created_by"       UUID NOT NULL REFERENCES "users"("id"),
        "assigned_at"      TIMESTAMPTZ,
        "arrived_at"       TIMESTAMPTZ,
        "closed_at"        TIMESTAMPTZ,
        "resolution"       VARCHAR,
        "resolution_notes" TEXT,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_incidents_status" ON "incidents" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_incidents_sector" ON "incidents" ("sector_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_incidents_location" ON "incidents" USING GIST ("location")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_incidents_created_at" ON "incidents" ("created_at" DESC)
    `);

    // ─── Tabla: incident_events ───────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "incident_events" (
        "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "incident_id" UUID NOT NULL REFERENCES "incidents"("id") ON DELETE CASCADE,
        "type"        VARCHAR NOT NULL,
        "description" TEXT NOT NULL,
        "actor_id"    UUID NOT NULL REFERENCES "users"("id"),
        "metadata"    JSONB,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_events_incident" ON "incident_events" ("incident_id", "created_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "incident_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "incidents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "units"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sectors"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "incident_type"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "incident_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "incident_priority"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "unit_status"`);
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
~/.local/bin/pnpm typecheck 2>&1 | tail -3
```

Esperado: exit 0.

- [ ] **Step 3: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/api/src/database/migrations/002_core_schema.ts
git commit -m "feat: add migration 002 for sectors, units, incidents and events tables"
```

---

## Task 9: Auth Refresh Endpoint

**Files:**
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/modules/auth/auth.service.spec.ts`
- Modify: `apps/api/src/modules/auth/auth.controller.ts`

- [ ] **Step 1: Agregar test de refresh al spec existente**

En `apps/api/src/modules/auth/auth.service.spec.ts`, agregar dentro del `describe('AuthService')` un nuevo test:

```typescript
  describe('refreshToken', () => {
    it('retorna nuevo accessToken a partir del userId y role', async () => {
      mockJwtService.signAsync.mockResolvedValueOnce('new_access_token');
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        passwordHash: 'hashed',
      });

      const result = await service.refreshToken('user-uuid-1', UserRole.OPERATOR);

      expect(result.accessToken).toBe('new_access_token');
      expect(result.expiresIn).toBe(900);
    });
  });
```

- [ ] **Step 2: Correr solo el test de auth para verificar que falla**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
~/.local/bin/pnpm test -- --testPathPattern=auth.service.spec 2>&1 | tail -12
```

Esperado: FAIL — "service.refreshToken is not a function"

- [ ] **Step 3: Agregar `refreshToken` a `AuthService`**

En `apps/api/src/modules/auth/auth.service.ts`, agregar el método:

```typescript
  async refreshToken(
    userId: string,
    role: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    const payload = { sub: userId, email: user.email, role };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('jwt.secret'),
      expiresIn: this.config.get<string>('jwt.expiresIn'),
    });

    return { accessToken, expiresIn: 900 };
  }
```

Agregar también el import de `UnauthorizedException` si no está:
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
```

- [ ] **Step 4: Correr tests de auth — todos deben pasar**

```bash
~/.local/bin/pnpm test -- --testPathPattern=auth.service.spec 2>&1 | tail -12
```

Esperado: PASS — 6 tests passed.

- [ ] **Step 5: Agregar endpoint `/auth/refresh` al controller**

En `apps/api/src/modules/auth/auth.controller.ts`, reemplazar el método `refresh` existente (que actualmente lanza un error `Not implemented yet`) con:

```typescript
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body('refreshToken') refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token requerido.');
    }

    // Verificar el refresh token manualmente con JwtService
    let payload: { sub: string; role: string };
    try {
      payload = this.jwtService.verify<{ sub: string; role: string }>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret') ?? '',
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado.');
    }

    return this.authService.refreshToken(payload.sub, payload.role);
  }
```

Actualizar las importaciones del controller para incluir `JwtService` y `ConfigService`:

```typescript
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../shared/decorators/current-user.decorator';
import { LoginDto, type TokenResponseDto } from '@velnari/shared-types';
import type { UserEntity } from '../../entities/user.entity';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
```

Y actualizar el constructor:
```typescript
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}
```

- [ ] **Step 6: Typecheck + todos los tests**

```bash
~/.local/bin/pnpm typecheck 2>&1 | tail -3
~/.local/bin/pnpm test 2>&1 | tail -15
```

Esperado: todos los tests pasan, typecheck exit 0.

- [ ] **Step 7: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git add apps/api/src/modules/auth
git commit -m "feat: implement auth refresh token endpoint"
```

---

## Task 10: Push final y verificación

- [ ] **Step 1: Correr todos los tests una última vez**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api"
~/.local/bin/pnpm test 2>&1
```

Esperado: todos los suites pasan. Contar tests: deberían ser al menos 25+ entre todos los suites.

- [ ] **Step 2: Typecheck final**

```bash
~/.local/bin/pnpm typecheck 2>&1
```

Esperado: exit 0, sin errores.

- [ ] **Step 3: Push a GitHub**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari"
git push origin main
```

Esperado: push exitoso a `https://github.com/ivancancan/velnari-police`.

---

## Self-Review

### Cobertura del Blueprint (Plan 2)

| Requisito del Backend Core | Task |
|---------------------------|------|
| Modulo de Sectores con CRUD | Task 2 |
| Entidad Unit con GPS + status | Task 3 |
| Modulo de Incidents con timeline | Task 4 |
| Modulo de Dispatch (asignacion unidad) | Task 5 |
| WebSocket Gateway (Socket.IO) | Task 6 |
| Cache de posiciones Redis | Task 7 |
| Migration de schema core | Task 8 |
| Auth refresh endpoint | Task 9 |
| Shared DTOs nuevos | Task 1 |

### Pendiente para Plan 3 (Velnari Command Web — Next.js)

- Mapbox GL JS con unidades en tiempo real
- Panel de incidentes activos
- Modal crear incidente
- Modal asignar unidad
- Dashboard operativo con metricas
- Integracion Socket.IO client-side
