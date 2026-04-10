# Phase 2 — Operationally Complete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cover the full operational police workflow — shift management, incident reassignment/merging, mobile situational awareness map, in-app chat, SLA compliance tracking, and data retention.

**Architecture:** Backend gets new shift management endpoints, incident reassignment/merge logic, SLA configuration, and a data cleanup cron. Mobile map gets enriched with other units + incidents via WebSocket. Mobile chat screen consumes existing backend chat module. Web dashboard gets SLA compliance cards.

**Tech Stack:** NestJS, TypeORM, PostGIS, Socket.IO, React Native Maps, Expo Router, Zustand

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/api/src/database/migrations/012_shifts_and_sla.ts` | DB schema: shifts table, SLA config columns |
| Create | `apps/api/src/entities/shift.entity.ts` | Shift entity (unit, start, end, sector, notes) |
| Create | `apps/api/src/modules/shifts/shifts.module.ts` | NestJS module |
| Create | `apps/api/src/modules/shifts/shifts.service.ts` | Shift CRUD + handoff logic |
| Create | `apps/api/src/modules/shifts/shifts.controller.ts` | REST endpoints for shifts |
| Modify | `apps/api/src/modules/incidents/incidents.service.ts` | Add reassign, merge, SLA stats |
| Modify | `apps/api/src/modules/incidents/incidents.controller.ts` | Add PATCH reassign, POST merge, GET sla-compliance |
| Modify | `apps/api/src/modules/dispatch/dispatch.service.ts` | Add reassignUnit method |
| Modify | `apps/api/src/app.module.ts` | Register ShiftsModule |
| Create | `apps/api/src/modules/cleanup/cleanup.service.ts` | Cron: purge old location history, archive audit logs |
| Create | `apps/api/src/modules/cleanup/cleanup.module.ts` | Module for data retention |
| Modify | `apps/mobile/app/(tabs)/map.tsx` | Show other units + incidents on map |
| Create | `apps/mobile/app/(tabs)/chat.tsx` | Chat screen consuming backend chat API |
| Modify | `apps/mobile/app/(tabs)/_layout.tsx` | Add chat tab |
| Modify | `apps/mobile/src/lib/api.ts` | Add chatApi, unitsApi.getNearby |
| Modify | `apps/mobile/src/providers/RealtimeProvider.tsx` | Handle chat:message events |
| Modify | `apps/web/src/app/dashboard/page.tsx` | Add SLA compliance section |
| Modify | `apps/web/src/lib/api.ts` | Add SLA compliance endpoint |

---

## Task 1: Database Migration — Shifts & SLA

**Files:**
- Create: `apps/api/src/database/migrations/012_shifts_and_sla.ts`

- [ ] **Step 1: Create the migration**

Create `apps/api/src/database/migrations/012_shifts_and_sla.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShiftsAndSla1712900000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        unit_id UUID NOT NULL REFERENCES units(id),
        user_id UUID REFERENCES users(id),
        sector_id UUID REFERENCES sectors(id),
        start_at TIMESTAMP WITH TIME ZONE NOT NULL,
        end_at TIMESTAMP WITH TIME ZONE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
        notes TEXT,
        handoff_notes TEXT,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_shifts_unit ON shifts(unit_id);
      CREATE INDEX idx_shifts_status ON shifts(status);
      CREATE INDEX idx_shifts_start ON shifts(start_at);

      -- SLA configuration per priority
      CREATE TABLE IF NOT EXISTS sla_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        priority VARCHAR(20) NOT NULL UNIQUE,
        target_response_minutes INTEGER NOT NULL,
        target_resolution_minutes INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Insert default SLA targets
      INSERT INTO sla_config (priority, target_response_minutes, target_resolution_minutes) VALUES
        ('critical', 3, 30),
        ('high', 5, 60),
        ('medium', 15, 120),
        ('low', 30, 240)
      ON CONFLICT (priority) DO NOTHING;

      -- Add merged_into column for incident merging
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES incidents(id);
      CREATE INDEX IF NOT EXISTS idx_incidents_merged ON incidents(merged_into) WHERE merged_into IS NOT NULL;

      -- Add index for chat performance
      CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id, created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_chat_messages_room;
      ALTER TABLE incidents DROP COLUMN IF EXISTS merged_into;
      DROP TABLE IF EXISTS sla_config;
      DROP TABLE IF EXISTS shifts;
    `);
  }
}
```

- [ ] **Step 2: Run the migration**

```bash
cd /Users/Ivan/Desktop/velnari-police/apps/api && pnpm db:migrate
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/database/migrations/012_shifts_and_sla.ts
git commit -m "feat(db): migration 012 — shifts table, SLA config, incident merging, chat index"
```

---

## Task 2: Shift Management — Backend

**Files:**
- Create: `apps/api/src/entities/shift.entity.ts`
- Create: `apps/api/src/entities/sla-config.entity.ts`
- Create: `apps/api/src/modules/shifts/shifts.service.ts`
- Create: `apps/api/src/modules/shifts/shifts.controller.ts`
- Create: `apps/api/src/modules/shifts/shifts.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create Shift entity**

Create `apps/api/src/entities/shift.entity.ts`:

```typescript
import {
  Column, CreateDateColumn, Entity, JoinColumn,
  ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { UnitEntity } from './unit.entity';
import { UserEntity } from './user.entity';
import { SectorEntity } from './sector.entity';

export enum ShiftStatus {
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('shifts')
export class ShiftEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId!: string;

  @ManyToOne(() => UnitEntity)
  @JoinColumn({ name: 'unit_id' })
  unit?: UnitEntity;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @Column({ name: 'sector_id', type: 'uuid', nullable: true })
  sectorId?: string;

  @ManyToOne(() => SectorEntity, { nullable: true })
  @JoinColumn({ name: 'sector_id' })
  sector?: SectorEntity;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt!: Date;

  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt!: Date;

  @Column({ type: 'varchar', length: 20, default: ShiftStatus.SCHEDULED })
  status!: ShiftStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'handoff_notes', type: 'text', nullable: true })
  handoffNotes?: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'created_by' })
  creator?: UserEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

- [ ] **Step 2: Create SLA config entity**

Create `apps/api/src/entities/sla-config.entity.ts`:

```typescript
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sla_config')
export class SlaConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 20 })
  priority!: string;

  @Column({ name: 'target_response_minutes', type: 'integer' })
  targetResponseMinutes!: number;

  @Column({ name: 'target_resolution_minutes', type: 'integer', nullable: true })
  targetResolutionMinutes?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
```

- [ ] **Step 3: Create shifts service**

Create `apps/api/src/modules/shifts/shifts.service.ts`:

```typescript
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { ShiftEntity, ShiftStatus } from '../../entities/shift.entity';
import { IncidentEntity } from '../../entities/incident.entity';
import { IncidentStatus } from '@velnari/shared-types';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(ShiftEntity)
    private readonly repo: Repository<ShiftEntity>,
    @InjectRepository(IncidentEntity)
    private readonly incidentRepo: Repository<IncidentEntity>,
  ) {}

  findAll(filters: { unitId?: string; status?: string; from?: Date; to?: Date }): Promise<ShiftEntity[]> {
    const qb = this.repo.createQueryBuilder('s')
      .leftJoinAndSelect('s.unit', 'unit')
      .leftJoinAndSelect('s.user', 'user')
      .leftJoinAndSelect('s.sector', 'sector')
      .orderBy('s.start_at', 'ASC');

    if (filters.unitId) qb.andWhere('s.unit_id = :unitId', { unitId: filters.unitId });
    if (filters.status) qb.andWhere('s.status = :status', { status: filters.status });
    if (filters.from) qb.andWhere('s.start_at >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('s.end_at <= :to', { to: filters.to });

    return qb.getMany();
  }

  async create(dto: {
    unitId: string;
    userId?: string;
    sectorId?: string;
    startAt: string;
    endAt: string;
    notes?: string;
  }, createdBy: string): Promise<ShiftEntity> {
    const shift = this.repo.create({
      unitId: dto.unitId,
      userId: dto.userId,
      sectorId: dto.sectorId,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      notes: dto.notes,
      status: ShiftStatus.SCHEDULED,
      createdBy,
    });
    return this.repo.save(shift);
  }

  async activate(id: string): Promise<ShiftEntity> {
    const shift = await this.repo.findOne({ where: { id } });
    if (!shift) throw new NotFoundException(`Turno ${id} no encontrado`);
    shift.status = ShiftStatus.ACTIVE;
    return this.repo.save(shift);
  }

  async complete(id: string, handoffNotes?: string): Promise<ShiftEntity> {
    const shift = await this.repo.findOne({ where: { id } });
    if (!shift) throw new NotFoundException(`Turno ${id} no encontrado`);
    shift.status = ShiftStatus.COMPLETED;
    if (handoffNotes) shift.handoffNotes = handoffNotes;
    return this.repo.save(shift);
  }

  async cancel(id: string): Promise<void> {
    const shift = await this.repo.findOne({ where: { id } });
    if (!shift) throw new NotFoundException(`Turno ${id} no encontrado`);
    shift.status = ShiftStatus.CANCELLED;
    await this.repo.save(shift);
  }

  async getHandoff(unitId: string): Promise<{
    outgoingShift: ShiftEntity | null;
    openIncidents: IncidentEntity[];
    handoffNotes: string | null;
  }> {
    const activeShift = await this.repo.findOne({
      where: { unitId, status: ShiftStatus.ACTIVE },
      relations: ['unit', 'sector'],
    });

    const openIncidents = await this.incidentRepo.find({
      where: {
        assignedUnitId: unitId,
        status: In([IncidentStatus.OPEN, IncidentStatus.ASSIGNED]),
      },
      order: { createdAt: 'DESC' },
    });

    return {
      outgoingShift: activeShift,
      openIncidents,
      handoffNotes: activeShift?.handoffNotes ?? null,
    };
  }
}
```

- [ ] **Step 4: Create shifts controller**

Create `apps/api/src/modules/shifts/shifts.controller.ts`:

```typescript
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import type { JwtPayload } from '../../shared/decorators/current-user.decorator';
import { UserRole } from '@velnari/shared-types';

@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftsController {
  constructor(private readonly service: ShiftsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER, UserRole.OPERATOR)
  findAll(
    @Query('unitId') unitId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.findAll({
      unitId,
      status,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER)
  create(
    @Body() dto: { unitId: string; userId?: string; sectorId?: string; startAt: string; endAt: string; notes?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(dto, user.sub);
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER)
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.activate(id);
  }

  @Patch(':id/complete')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER, UserRole.FIELD_UNIT)
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { handoffNotes?: string },
  ) {
    return this.service.complete(id, body.handoffNotes);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER)
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancel(id);
  }

  @Get('handoff/:unitId')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER, UserRole.FIELD_UNIT)
  getHandoff(@Param('unitId', ParseUUIDPipe) unitId: string) {
    return this.service.getHandoff(unitId);
  }
}
```

- [ ] **Step 5: Create shifts module**

Create `apps/api/src/modules/shifts/shifts.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftEntity } from '../../entities/shift.entity';
import { IncidentEntity } from '../../entities/incident.entity';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ShiftEntity, IncidentEntity])],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
```

- [ ] **Step 6: Register ShiftsModule in AppModule**

In `apps/api/src/app.module.ts`, add the import and register:

```typescript
import { ShiftsModule } from './modules/shifts/shifts.module';
```

Add `ShiftsModule` to the `imports` array.

- [ ] **Step 7: Verify compilation**

```bash
cd /Users/Ivan/Desktop/velnari-police/apps/api && ../../node_modules/.bin/tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/entities/shift.entity.ts apps/api/src/entities/sla-config.entity.ts apps/api/src/modules/shifts/ apps/api/src/app.module.ts
git commit -m "feat(shifts): shift management CRUD with handoff + SLA config entity"
```

---

## Task 3: Incident Reassignment & Merging — Backend

**Files:**
- Modify: `apps/api/src/modules/dispatch/dispatch.service.ts`
- Modify: `apps/api/src/modules/incidents/incidents.service.ts`
- Modify: `apps/api/src/modules/incidents/incidents.controller.ts`
- Modify: `apps/api/src/entities/incident.entity.ts`

- [ ] **Step 1: Add mergedInto column to incident entity**

In `apps/api/src/entities/incident.entity.ts`, add after the `patrolId` field (around line 96):

```typescript
  @Column({ name: 'merged_into', nullable: true, type: 'uuid' })
  mergedInto?: string;

  @ManyToOne(() => IncidentEntity, { nullable: true })
  @JoinColumn({ name: 'merged_into' })
  mergedIntoIncident?: IncidentEntity;
```

Also add self-reference import — add `IncidentEntity` to the entity's own type (it's already the class name, TypeORM handles this).

- [ ] **Step 2: Add reassignUnit to dispatch service**

In `apps/api/src/modules/dispatch/dispatch.service.ts`, add this method after `assignUnit`:

```typescript
  async reassignUnit(
    incidentId: string,
    newUnitId: string,
    actorId: string,
  ): Promise<IncidentEntity> {
    const [incident, newUnit] = await Promise.all([
      this.incidentsService.findOne(incidentId),
      this.unitsService.findOne(newUnitId),
    ]);

    if (incident.status === IncidentStatus.CLOSED) {
      throw new BadRequestException('No se puede reasignar un incidente cerrado.');
    }

    if (newUnit.status !== UnitStatus.AVAILABLE) {
      throw new BadRequestException(
        `La unidad ${newUnit.callSign} no está disponible (estado: ${newUnit.status}).`,
      );
    }

    // Release previous unit if assigned
    const previousUnitId = incident.assignedUnitId;
    if (previousUnitId) {
      await this.unitsService.updateStatus(previousUnitId, UnitStatus.AVAILABLE);
    }

    // Assign new unit
    incident.assignedUnitId = newUnitId;
    incident.status = IncidentStatus.ASSIGNED;
    incident.assignedAt = new Date();

    await this.unitsService.updateStatus(newUnitId, UnitStatus.EN_ROUTE);
    const saved = await this.incidentsService.saveIncident(incident);

    await this.assignmentRepo.upsert(
      { incidentId, unitId: newUnitId, assignedBy: actorId, assignedAt: new Date() },
      ['incidentId', 'unitId'],
    );

    // Calculate ETA
    let etaMinutes: number | null = null;
    if (newUnit.currentLocation) {
      const distResult = await this.unitRepo
        .createQueryBuilder('u')
        .select('ST_Distance(u.current_location::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) / 1000', 'distance_km')
        .where('u.id = :id', { id: newUnitId })
        .setParameters({ lat: Number(incident.lat), lng: Number(incident.lng) })
        .getRawOne();

      if (distResult?.distance_km) {
        etaMinutes = Math.max(1, Math.round((Number(distResult.distance_km) / 30) * 60));
      }
    }

    const previousUnit = previousUnitId
      ? await this.unitsService.findOne(previousUnitId)
      : null;

    const event = this.eventRepo.create({
      incidentId,
      type: 'reassigned',
      description: `Reasignado: ${previousUnit?.callSign ?? 'sin unidad'} → ${newUnit.callSign}${etaMinutes ? ` · ETA: ~${etaMinutes} min` : ''}`,
      actorId,
      metadata: { previousUnitId, newUnitId, callSign: newUnit.callSign },
    });
    await this.eventRepo.save(event);

    this.realtime.emitIncidentAssigned(incidentId, newUnitId, etaMinutes);

    return saved;
  }
```

- [ ] **Step 3: Add merge method to incidents service**

In `apps/api/src/modules/incidents/incidents.service.ts`, add this method:

```typescript
  async merge(
    sourceId: string,
    targetId: string,
    actorId: string,
  ): Promise<IncidentEntity> {
    const [source, target] = await Promise.all([
      this.findOne(sourceId),
      this.findOne(targetId),
    ]);

    if (source.status === IncidentStatus.CLOSED) {
      throw new BadRequestException('El incidente origen ya está cerrado.');
    }
    if (target.status === IncidentStatus.CLOSED) {
      throw new BadRequestException('El incidente destino está cerrado.');
    }
    if (sourceId === targetId) {
      throw new BadRequestException('No se puede fusionar un incidente consigo mismo.');
    }

    // Mark source as merged
    source.mergedInto = targetId;
    source.status = IncidentStatus.CLOSED;
    source.closedAt = new Date();
    source.resolution = `Fusionado con ${target.folio}`;
    await this.repo.save(source);

    // Release source's unit if assigned
    if (source.assignedUnitId) {
      const unitRepo = this.unitRepo;
      await unitRepo.update(source.assignedUnitId, { status: 'available' as any });
    }

    // Create events on both incidents
    const sourceEvent = this.eventRepo.create({
      incidentId: sourceId,
      type: 'merged',
      description: `Fusionado con ${target.folio}`,
      actorId,
      metadata: { targetId, targetFolio: target.folio },
    });
    const targetEvent = this.eventRepo.create({
      incidentId: targetId,
      type: 'merged',
      description: `Se fusionó ${source.folio} en este incidente`,
      actorId,
      metadata: { sourceId, sourceFolio: source.folio },
    });
    await this.eventRepo.save([sourceEvent, targetEvent]);

    return target;
  }
```

Also add `BadRequestException` to the `@nestjs/common` import if not already there (it was added in Phase 1 Task 2).

- [ ] **Step 4: Add controller endpoints**

In `apps/api/src/modules/incidents/incidents.controller.ts`, add the dispatch service injection. First update the constructor and imports:

Add to the imports at the top:

```typescript
import { DispatchService } from '../dispatch/dispatch.service';
```

Update the constructor:

```typescript
  constructor(
    private readonly service: IncidentsService,
    private readonly dispatchService: DispatchService,
  ) {}
```

Then add these endpoints:

```typescript
  @Post(':id/reassign')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.COMMANDER)
  reassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { unitId: string },
    @CurrentUser() user: JwtPayload,
  ): Promise<IncidentEntity> {
    return this.dispatchService.reassignUnit(id, body.unitId, user.sub);
  }

  @Post(':id/merge')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPERVISOR)
  merge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { targetIncidentId: string },
    @CurrentUser() user: JwtPayload,
  ): Promise<IncidentEntity> {
    return this.service.merge(id, body.targetIncidentId, user.sub);
  }
```

- [ ] **Step 5: Handle circular dependency**

The IncidentsController now depends on DispatchService. Check if DispatchModule already exports DispatchService and if IncidentsModule imports DispatchModule. If not, use `forwardRef`:

In `apps/api/src/modules/incidents/incidents.module.ts`, add DispatchModule to imports (check actual file structure first).

- [ ] **Step 6: Verify compilation and commit**

```bash
cd /Users/Ivan/Desktop/velnari-police/apps/api && ../../node_modules/.bin/tsc --noEmit
git add apps/api/src/entities/incident.entity.ts apps/api/src/modules/dispatch/dispatch.service.ts apps/api/src/modules/incidents/
git commit -m "feat(incidents): add reassignment + merge endpoints with timeline events"
```

---

## Task 4: SLA Compliance — Backend & Web Dashboard

**Files:**
- Modify: `apps/api/src/modules/incidents/incidents.service.ts`
- Modify: `apps/api/src/modules/incidents/incidents.controller.ts`
- Modify: `apps/web/src/app/dashboard/page.tsx`
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add SLA compliance method to incidents service**

In `apps/api/src/modules/incidents/incidents.service.ts`, add import for SlaConfigEntity and add this method:

```typescript
  async getSlaCompliance(from: Date, to: Date): Promise<{
    byPriority: {
      priority: string;
      targetMinutes: number;
      totalIncidents: number;
      withinSla: number;
      complianceRate: number;
      avgResponseMinutes: number | null;
    }[];
    overall: { total: number; withinSla: number; complianceRate: number };
  }> {
    // Get SLA targets
    const slaConfigs = await this.slaConfigRepo.find();
    const targets = new Map(slaConfigs.map(c => [c.priority, c.targetResponseMinutes]));

    // Get all incidents with response times in period
    const incidents = await this.repo.find({
      where: { createdAt: Between(from, to) },
      select: ['id', 'priority', 'createdAt', 'assignedAt'],
    });

    const byPriority: Record<string, { total: number; withinSla: number; responseTimes: number[] }> = {};
    for (const inc of incidents) {
      if (!byPriority[inc.priority]) {
        byPriority[inc.priority] = { total: 0, withinSla: 0, responseTimes: [] };
      }
      byPriority[inc.priority].total++;

      if (inc.assignedAt) {
        const responseMin = (inc.assignedAt.getTime() - inc.createdAt.getTime()) / 60000;
        byPriority[inc.priority].responseTimes.push(responseMin);
        const target = targets.get(inc.priority) ?? 15;
        if (responseMin <= target) {
          byPriority[inc.priority].withinSla++;
        }
      }
    }

    let totalAll = 0;
    let withinAll = 0;
    const result = Object.entries(byPriority).map(([priority, data]) => {
      totalAll += data.total;
      withinAll += data.withinSla;
      const avg = data.responseTimes.length > 0
        ? data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length
        : null;
      return {
        priority,
        targetMinutes: targets.get(priority) ?? 15,
        totalIncidents: data.total,
        withinSla: data.withinSla,
        complianceRate: data.total > 0 ? Math.round((data.withinSla / data.total) * 100) : 100,
        avgResponseMinutes: avg ? Math.round(avg * 10) / 10 : null,
      };
    });

    return {
      byPriority: result,
      overall: {
        total: totalAll,
        withinSla: withinAll,
        complianceRate: totalAll > 0 ? Math.round((withinAll / totalAll) * 100) : 100,
      },
    };
  }
```

Also add the SlaConfigEntity repository injection in the constructor:

```typescript
    @InjectRepository(SlaConfigEntity)
    private readonly slaConfigRepo: Repository<SlaConfigEntity>,
```

And add the import at the top:

```typescript
import { SlaConfigEntity } from '../../entities/sla-config.entity';
```

And add `SlaConfigEntity` to the TypeOrmModule.forFeature array in `incidents.module.ts`.

- [ ] **Step 2: Add SLA endpoint to controller**

In `incidents.controller.ts`, add:

```typescript
  @Get('sla-compliance')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER, UserRole.OPERATOR)
  getSlaCompliance(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const now = new Date();
    const fromDate = from && !isNaN(Date.parse(from)) ? new Date(from) : startOfDay(now);
    const toDate = to && !isNaN(Date.parse(to)) ? new Date(to) : endOfDay(now);
    return this.service.getSlaCompliance(fromDate, toDate);
  }
```

Note: Place this BEFORE the `:id` routes to avoid route conflict.

- [ ] **Step 3: Add SLA API call to web frontend**

In `apps/web/src/lib/api.ts`, add to the `incidentsApi` object:

```typescript
  getSlaCompliance: (from?: string, to?: string) =>
    api.get<{
      byPriority: { priority: string; targetMinutes: number; totalIncidents: number; withinSla: number; complianceRate: number; avgResponseMinutes: number | null }[];
      overall: { total: number; withinSla: number; complianceRate: number };
    }>('/incidents/sla-compliance', { params: { from, to } }),
```

- [ ] **Step 4: Add SLA section to web dashboard**

In `apps/web/src/app/dashboard/page.tsx`, add state for SLA data and fetch it alongside other data. Then add a new section after the incident stats cards showing:

- Overall compliance rate (large number with color: green >= 80%, amber >= 60%, red < 60%)
- Per-priority breakdown: priority label, target, actual avg, compliance %, total incidents
- Use the existing card styling pattern from the dashboard

- [ ] **Step 5: Verify and commit**

```bash
cd /Users/Ivan/Desktop/velnari-police/apps/api && ../../node_modules/.bin/tsc --noEmit
cd /Users/Ivan/Desktop/velnari-police/apps/web && ../../node_modules/.bin/tsc --noEmit
git add apps/api/src/modules/incidents/ apps/api/src/entities/sla-config.entity.ts apps/web/src/app/dashboard/page.tsx apps/web/src/lib/api.ts
git commit -m "feat(sla): SLA compliance tracking with per-priority targets + dashboard section"
```

---

## Task 5: Mobile Map — Show Other Units & Incidents

**Files:**
- Modify: `apps/mobile/app/(tabs)/map.tsx`
- Modify: `apps/mobile/src/lib/api.ts`
- Modify: `apps/mobile/src/providers/RealtimeProvider.tsx`

- [ ] **Step 1: Add units store for all units positions**

In `apps/mobile/src/store/unit.store.ts`, add a `nearbyUnits` array and actions:

Add to the interface:

```typescript
  nearbyUnits: { id: string; callSign: string; status: string; lat: number; lng: number }[];
  setNearbyUnits: (units: { id: string; callSign: string; status: string; lat: number; lng: number }[]) => void;
  updateNearbyUnitPosition: (unitId: string, lat: number, lng: number) => void;
```

Add to the store:

```typescript
  nearbyUnits: [],
  setNearbyUnits: (units) => set({ nearbyUnits: units }),
  updateNearbyUnitPosition: (unitId, lat, lng) =>
    set((state) => ({
      nearbyUnits: state.nearbyUnits.map((u) =>
        u.id === unitId ? { ...u, lat, lng } : u,
      ),
    })),
```

- [ ] **Step 2: Update RealtimeProvider to track unit positions**

In `apps/mobile/src/providers/RealtimeProvider.tsx`, add a listener for `unit:location:changed`:

```typescript
    // Track all unit positions for map
    socket.on('unit:location:changed', (payload: { unitId: string; lat: number; lng: number }) => {
      const { useUnitStore } = require('@/store/unit.store');
      useUnitStore.getState().updateNearbyUnitPosition(payload.unitId, payload.lat, payload.lng);
    });
```

Add cleanup in the return function:

```typescript
      socket.off('unit:location:changed');
```

- [ ] **Step 3: Fetch initial unit positions on map mount**

In `apps/mobile/src/lib/api.ts`, the `unitsApi.getAll()` already returns units with lat/lng. No changes needed.

- [ ] **Step 4: Enhance map screen to show other units and incidents**

Replace the map screen `apps/mobile/app/(tabs)/map.tsx` with an enhanced version that:

1. Fetches all units on mount via `unitsApi.getAll()` and stores in `setNearbyUnits`
2. Fetches open incidents via `incidentsApi.getAll()` and stores locally
3. Renders each nearby unit as a Marker with callSign label and status color
4. Renders each open incident as a Marker with priority color
5. Keeps the existing trail/speed/stats functionality for the current user
6. Updates unit positions in real-time via the RealtimeProvider's `unit:location:changed` subscription

Key implementation details:
- Unit markers: Circle with status color (green=available, blue=en_route, orange=on_scene, red=out_of_service), callSign label below
- Incident markers: Triangle/pin with priority color (red=critical, orange=high, amber=medium, green=low), folio label
- Current user's marker stays as-is (blue circle with callSign)
- Add a legend/toggle at bottom to show/hide layers

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(tabs)/map.tsx apps/mobile/src/store/unit.store.ts apps/mobile/src/providers/RealtimeProvider.tsx
git commit -m "feat(mobile): map shows all units with real-time positions + open incidents"
```

---

## Task 6: Mobile Chat Screen

**Files:**
- Create: `apps/mobile/app/(tabs)/chat.tsx`
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`
- Modify: `apps/mobile/src/lib/api.ts`
- Modify: `apps/mobile/src/providers/RealtimeProvider.tsx`

- [ ] **Step 1: Add chatApi to api.ts**

In `apps/mobile/src/lib/api.ts`, add:

```typescript
export const chatApi = {
  getMessages: (roomId: string, limit = 50) =>
    api.get<{
      id: string; roomId: string; senderId: string;
      senderName: string; senderRole: string;
      content: string; createdAt: string;
    }[]>(`/chat/${roomId}`, { params: { limit } }),
  sendMessage: (roomId: string, content: string) =>
    api.post<{
      id: string; roomId: string; senderId: string;
      senderName: string; senderRole: string;
      content: string; createdAt: string;
    }>(`/chat/${roomId}`, { content }),
};
```

- [ ] **Step 2: Create chat screen**

Create `apps/mobile/app/(tabs)/chat.tsx` with:

- Room selector at top: "Comando" (command room) is default, option to switch to incident-specific room if assigned
- Message list (FlatList, inverted for newest at bottom)
- Message bubbles: own messages right-aligned (blue), others left-aligned (gray)
- Sender name + role badge on each message
- Text input + send button at bottom
- Real-time incoming messages via `chat:message` socket event
- Load history on mount via `chatApi.getMessages(roomId)`
- Pull-to-refresh for older messages
- Keyboard-aware layout (KeyboardAvoidingView)

Styling: dark mode (#0F172A background), message bubbles with rounded corners, timestamps in gray, sender names in tactical-blue. Minimum 48px touch targets for send button.

- [ ] **Step 3: Add chat:message listener to RealtimeProvider**

In `apps/mobile/src/providers/RealtimeProvider.tsx`, add a state store or event emitter for chat messages. The simplest approach: create a chat store or use an event-based pattern. Add:

```typescript
    socket.on('chat:message', (message: { id: string; roomId: string; senderId: string; senderName: string; content: string; createdAt: string }) => {
      // Emit to any subscribers — chat screen will listen
      chatEventEmitter.emit('newMessage', message);
    });
```

Create a simple event emitter in `apps/mobile/src/lib/chat-events.ts`:

```typescript
type Listener = (message: any) => void;
const listeners: Set<Listener> = new Set();

export const chatEventEmitter = {
  on: (event: string, listener: Listener) => { listeners.add(listener); },
  off: (event: string, listener: Listener) => { listeners.delete(listener); },
  emit: (event: string, data: any) => { listeners.forEach(l => l(data)); },
};
```

- [ ] **Step 4: Update tab layout**

In `apps/mobile/app/(tabs)/_layout.tsx`, add a Chat tab. Change from 5 tabs to 6, or replace one. Recommended: add chat between Map and Report:

```typescript
<Tabs.Screen
  name="chat"
  options={{
    title: 'Chat',
    tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>💬</Text>,
  }}
/>
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(tabs)/chat.tsx apps/mobile/app/(tabs)/_layout.tsx apps/mobile/src/lib/api.ts apps/mobile/src/lib/chat-events.ts apps/mobile/src/providers/RealtimeProvider.tsx
git commit -m "feat(mobile): in-app chat with command room + incident rooms"
```

---

## Task 7: Data Retention & Cleanup — Backend

**Files:**
- Create: `apps/api/src/modules/cleanup/cleanup.service.ts`
- Create: `apps/api/src/modules/cleanup/cleanup.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create cleanup service with cron jobs**

Create `apps/api/src/modules/cleanup/cleanup.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { UnitLocationHistoryEntity } from '../../entities/unit-location-history.entity';
import { AuditLogEntity } from '../../entities/audit-log.entity';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    @InjectRepository(UnitLocationHistoryEntity)
    private readonly locationHistoryRepo: Repository<UnitLocationHistoryEntity>,
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepo: Repository<AuditLogEntity>,
  ) {}

  // Run daily at 3 AM — purge location history older than 30 days
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeOldLocationHistory(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const result = await this.locationHistoryRepo
      .createQueryBuilder()
      .delete()
      .where('recorded_at < :cutoff', { cutoff })
      .execute();

    this.logger.log(`Purged ${result.affected ?? 0} location history records older than 30 days`);
  }

  // Run weekly on Sunday at 4 AM — purge audit logs older than 90 days
  @Cron('0 4 * * 0')
  async purgeOldAuditLogs(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const result = await this.auditLogRepo
      .createQueryBuilder()
      .delete()
      .where('created_at < :cutoff', { cutoff })
      .execute();

    this.logger.log(`Purged ${result.affected ?? 0} audit logs older than 90 days`);
  }
}
```

- [ ] **Step 2: Create cleanup module**

Create `apps/api/src/modules/cleanup/cleanup.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitLocationHistoryEntity } from '../../entities/unit-location-history.entity';
import { AuditLogEntity } from '../../entities/audit-log.entity';
import { CleanupService } from './cleanup.service';

@Module({
  imports: [TypeOrmModule.forFeature([UnitLocationHistoryEntity, AuditLogEntity])],
  providers: [CleanupService],
})
export class CleanupModule {}
```

- [ ] **Step 3: Register in AppModule**

Add `CleanupModule` to `app.module.ts` imports.

- [ ] **Step 4: Verify and commit**

```bash
cd /Users/Ivan/Desktop/velnari-police/apps/api && ../../node_modules/.bin/tsc --noEmit
git add apps/api/src/modules/cleanup/ apps/api/src/app.module.ts
git commit -m "feat(cleanup): data retention cron — 30d location history, 90d audit logs"
```

---

## Task 8: Integration Verification

- [ ] **Step 1: Verify API compiles**

```bash
cd /Users/Ivan/Desktop/velnari-police/apps/api && ../../node_modules/.bin/tsc --noEmit
```

- [ ] **Step 2: Verify web compiles**

```bash
cd /Users/Ivan/Desktop/velnari-police/apps/web && ../../node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Review git log**

```bash
git log --oneline -10
```

- [ ] **Step 4: Final commit if needed**

```bash
git status
```

---

## Summary of Changes

| Area | What Changed | Impact |
|------|-------------|--------|
| **Shifts** | Full CRUD + handoff with open incidents transfer | Supervisors can plan rotations, field officers get context on handoff |
| **Incident Reassign** | POST /:id/reassign — releases old unit, assigns new one | Dispatchers can swap units without close+recreate |
| **Incident Merge** | POST /:id/merge — closes source, links to target | Duplicate 911 calls consolidated into single incident |
| **SLA Compliance** | GET /incidents/sla-compliance + dashboard section | Accountability: "72% of critical incidents met <3min target" |
| **Mobile Map** | Shows all units + incidents with real-time positions | Officers have full situational awareness, not just own position |
| **Mobile Chat** | Chat screen consuming backend chat module | Officers can communicate with command center digitally |
| **Data Retention** | Cron: 30d location history, 90d audit logs | Database doesn't grow unbounded |
