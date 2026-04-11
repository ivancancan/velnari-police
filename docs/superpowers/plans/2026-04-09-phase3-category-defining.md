# Phase 3 — Category-Defining Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build features that no other police management solution in Mexico offers — smart auto-dispatch, digital chain of custody for evidence, predictive analytics, citizen portal with tracking, SESNSP-ready report exports, and multi-municipality tenancy foundation.

**Architecture:** Backend gets auto-dispatch cron, evidence hashing on upload, analytics trend/anomaly endpoints, citizen tracking endpoint, SESNSP export generator, and tenant_id column foundation. Web gets citizen portal page and SESNSP export UI. Mobile gets evidence metadata capture.

**Tech Stack:** NestJS, TypeORM, PostGIS, crypto (SHA-256), Socket.IO, Next.js, React Native

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/api/src/database/migrations/013_phase3_schema.ts` | evidence_hash, citizen tracking columns, tenant_id |
| Modify | `apps/api/src/modules/dispatch/dispatch.service.ts` | Auto-dispatch for low-priority incidents |
| Create | `apps/api/src/modules/dispatch/auto-dispatch.service.ts` | Cron-based auto-dispatch engine |
| Modify | `apps/api/src/modules/attachments/attachments.service.ts` | SHA-256 hash + GPS metadata on upload |
| Modify | `apps/api/src/modules/attachments/attachments.controller.ts` | Accept GPS metadata in upload |
| Modify | `apps/api/src/entities/incident-attachment.entity.ts` | Add hash, gpsLat, gpsLng, capturedAt columns |
| Modify | `apps/api/src/modules/incidents/incidents.service.ts` | Trend analysis, anomaly detection, SESNSP export |
| Modify | `apps/api/src/modules/incidents/incidents.controller.ts` | Trend, anomaly, SESNSP, citizen-track endpoints |
| Create | `apps/web/src/app/seguimiento/page.tsx` | Citizen incident tracking portal |
| Create | `apps/web/src/app/admin/sesnsp/page.tsx` | SESNSP report export UI |
| Modify | `apps/mobile/src/lib/api.ts` | Send GPS metadata with photo uploads |

---

## Task 1: Database Migration 013 — Phase 3 Schema

**Files:**
- Create: `apps/api/src/database/migrations/013_phase3_schema.ts`

- [ ] **Step 1: Create the migration**

Create `apps/api/src/database/migrations/013_phase3_schema.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase3Schema1712900000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- Evidence chain of custody columns
      ALTER TABLE incident_attachments ADD COLUMN IF NOT EXISTS sha256_hash VARCHAR(64);
      ALTER TABLE incident_attachments ADD COLUMN IF NOT EXISTS gps_lat DECIMAL(10,7);
      ALTER TABLE incident_attachments ADD COLUMN IF NOT EXISTS gps_lng DECIMAL(10,7);
      ALTER TABLE incident_attachments ADD COLUMN IF NOT EXISTS captured_at TIMESTAMP WITH TIME ZONE;

      -- Citizen tracking: add tracking_token to incidents for anonymous status checks
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(12);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_tracking ON incidents(tracking_token) WHERE tracking_token IS NOT NULL;

      -- Auto-dispatch flag: mark incidents that were auto-dispatched
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS auto_dispatched BOOLEAN DEFAULT FALSE;

      -- Multi-tenancy foundation: tenant_id on core tables
      ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE units ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE sectors ADD COLUMN IF NOT EXISTS tenant_id UUID;
      CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id) WHERE tenant_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_units_tenant ON units(tenant_id) WHERE tenant_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_incidents_tenant ON incidents(tenant_id) WHERE tenant_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_sectors_tenant ON sectors(tenant_id) WHERE tenant_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_sectors_tenant;
      DROP INDEX IF EXISTS idx_incidents_tenant;
      DROP INDEX IF EXISTS idx_units_tenant;
      DROP INDEX IF EXISTS idx_users_tenant;
      ALTER TABLE sectors DROP COLUMN IF EXISTS tenant_id;
      ALTER TABLE incidents DROP COLUMN IF EXISTS tenant_id;
      ALTER TABLE units DROP COLUMN IF EXISTS tenant_id;
      ALTER TABLE users DROP COLUMN IF EXISTS tenant_id;
      ALTER TABLE incidents DROP COLUMN IF EXISTS auto_dispatched;
      DROP INDEX IF EXISTS idx_incidents_tracking;
      ALTER TABLE incidents DROP COLUMN IF EXISTS tracking_token;
      ALTER TABLE incident_attachments DROP COLUMN IF EXISTS captured_at;
      ALTER TABLE incident_attachments DROP COLUMN IF EXISTS gps_lng;
      ALTER TABLE incident_attachments DROP COLUMN IF EXISTS gps_lat;
      ALTER TABLE incident_attachments DROP COLUMN IF EXISTS sha256_hash;
    `);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/database/migrations/013_phase3_schema.ts
git commit -m "feat(db): migration 013 — evidence hashing, citizen tracking, auto-dispatch, tenant_id"
```

---

## Task 2: Smart Auto-Dispatch for Low-Priority Incidents

**Files:**
- Create: `apps/api/src/modules/dispatch/auto-dispatch.service.ts`
- Modify: `apps/api/src/modules/dispatch/dispatch.module.ts`
- Modify: `apps/api/src/entities/incident.entity.ts`

- [ ] **Step 1: Add autoDispatched column to incident entity**

In `apps/api/src/entities/incident.entity.ts`, add after `mergedInto` (around line 103):

```typescript
  @Column({ name: 'auto_dispatched', default: false })
  autoDispatched!: boolean;
```

- [ ] **Step 2: Create auto-dispatch cron service**

Create `apps/api/src/modules/dispatch/auto-dispatch.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentEntity } from '../../entities/incident.entity';
import { IncidentStatus, IncidentPriority } from '@velnari/shared-types';
import { DispatchService } from './dispatch.service';

const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class AutoDispatchService {
  private readonly logger = new Logger(AutoDispatchService.name);

  constructor(
    @InjectRepository(IncidentEntity)
    private readonly incidentRepo: Repository<IncidentEntity>,
    private readonly dispatchService: DispatchService,
  ) {}

  // Run every 2 minutes — auto-dispatch unassigned low/medium priority incidents older than 3 minutes
  @Cron('*/2 * * * *')
  async autoDispatchUnassigned(): Promise<void> {
    const cutoff = new Date(Date.now() - 3 * 60_000); // 3 minutes ago

    const unassigned = await this.incidentRepo
      .createQueryBuilder('i')
      .where('i.status = :status', { status: IncidentStatus.OPEN })
      .andWhere('i.priority IN (:...priorities)', {
        priorities: [IncidentPriority.LOW, IncidentPriority.MEDIUM],
      })
      .andWhere('i.created_at <= :cutoff', { cutoff })
      .andWhere('i.auto_dispatched = false')
      .orderBy('i.created_at', 'ASC')
      .limit(5) // Process max 5 per cycle to avoid overload
      .getMany();

    for (const incident of unassigned) {
      try {
        const suggestions = await this.dispatchService.suggestUnits(incident.id);
        if (suggestions.length === 0) {
          this.logger.warn(`Auto-dispatch: no available units for ${incident.folio}`);
          continue;
        }

        const bestUnit = suggestions[0]!;
        await this.dispatchService.assignUnit(incident.id, bestUnit.unitId, SYSTEM_ACTOR_ID);

        // Mark as auto-dispatched
        await this.incidentRepo.update(incident.id, { autoDispatched: true });

        this.logger.log(
          `Auto-dispatched ${incident.folio} → ${bestUnit.callSign} (${bestUnit.distanceKm}km, score ${bestUnit.score})`,
        );
      } catch (err) {
        this.logger.error(`Auto-dispatch failed for ${incident.folio}: ${(err as Error).message}`);
      }
    }
  }
}
```

- [ ] **Step 3: Register in dispatch module**

In `apps/api/src/modules/dispatch/dispatch.module.ts`, add `AutoDispatchService` to the providers array and import it.

- [ ] **Step 4: Verify and commit**

```bash
cd /Users/Ivan/Desktop/velnari-police/apps/api && ../../node_modules/.bin/tsc --noEmit
git add apps/api/src/modules/dispatch/ apps/api/src/entities/incident.entity.ts
git commit -m "feat(dispatch): auto-dispatch cron for unassigned low/medium incidents after 3 min"
```

---

## Task 3: Digital Chain of Custody — Evidence Hashing

**Files:**
- Modify: `apps/api/src/entities/incident-attachment.entity.ts`
- Modify: `apps/api/src/modules/attachments/attachments.service.ts`
- Modify: `apps/api/src/modules/attachments/attachments.controller.ts`
- Modify: `apps/mobile/src/lib/api.ts`

- [ ] **Step 1: Add hash + GPS columns to attachment entity**

In `apps/api/src/entities/incident-attachment.entity.ts`, add columns:

```typescript
  @Column({ name: 'sha256_hash', nullable: true, length: 64 })
  sha256Hash?: string;

  @Column({ name: 'gps_lat', type: 'decimal', precision: 10, scale: 7, nullable: true })
  gpsLat?: number;

  @Column({ name: 'gps_lng', type: 'decimal', precision: 10, scale: 7, nullable: true })
  gpsLng?: number;

  @Column({ name: 'captured_at', type: 'timestamptz', nullable: true })
  capturedAt?: Date;
```

- [ ] **Step 2: Add SHA-256 hashing to attachments service**

In `apps/api/src/modules/attachments/attachments.service.ts`, add:

```typescript
import * as crypto from 'crypto';
import * as fs from 'fs';
```

Add a method to compute file hash:

```typescript
  private async computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
```

Update the `create` method to accept and store GPS metadata + compute hash:

```typescript
  async create(input: {
    incidentId: string;
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    url: string;
    uploadedBy: string;
    filePath: string;
    gpsLat?: number;
    gpsLng?: number;
    capturedAt?: string;
  }): Promise<IncidentAttachmentEntity> {
    const sha256Hash = await this.computeFileHash(input.filePath);

    const attachment = this.repo.create({
      incidentId: input.incidentId,
      filename: input.filename,
      originalName: input.originalName,
      mimetype: input.mimetype,
      size: input.size,
      url: input.url,
      uploadedBy: input.uploadedBy,
      sha256Hash,
      gpsLat: input.gpsLat,
      gpsLng: input.gpsLng,
      capturedAt: input.capturedAt ? new Date(input.capturedAt) : undefined,
    });
    return this.repo.save(attachment);
  }
```

- [ ] **Step 3: Update controller to pass GPS metadata + file path**

In `apps/api/src/modules/attachments/attachments.controller.ts`, update the upload endpoint to read GPS fields from the request body and pass the file path:

```typescript
  @Post()
  async upload(
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { user: { sub: string } },
    @Body() body: { gpsLat?: string; gpsLng?: string; capturedAt?: string },
  ) {
    const apiUrl = process.env['API_URL'] ?? 'http://localhost:3001';
    return this.service.create({
      incidentId,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `${apiUrl}/uploads/${file.filename}`,
      uploadedBy: req.user.sub,
      filePath: file.path,
      gpsLat: body.gpsLat ? parseFloat(body.gpsLat) : undefined,
      gpsLng: body.gpsLng ? parseFloat(body.gpsLng) : undefined,
      capturedAt: body.capturedAt,
    });
  }
```

- [ ] **Step 4: Update mobile app to send GPS metadata with photos**

In `apps/mobile/src/lib/api.ts`, update `incidentsApi.uploadPhoto` to include GPS:

```typescript
  uploadPhoto: async (incidentId: string, uri: string) => {
    const formData = new FormData();
    const filename = uri.split('/').pop() ?? 'photo.jpg';
    formData.append('file', { uri, name: filename, type: 'image/jpeg' } as unknown as Blob);

    // Capture current GPS position for chain of custody
    try {
      const Location = require('expo-location');
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      formData.append('gpsLat', String(loc.coords.latitude));
      formData.append('gpsLng', String(loc.coords.longitude));
      formData.append('capturedAt', new Date().toISOString());
    } catch {
      // GPS unavailable — upload without metadata
      formData.append('capturedAt', new Date().toISOString());
    }

    return api.post(`/incidents/${incidentId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
```

- [ ] **Step 5: Verify and commit**

```bash
cd /Users/Ivan/Desktop/velnari-police/apps/api && ../../node_modules/.bin/tsc --noEmit
git add apps/api/src/entities/incident-attachment.entity.ts apps/api/src/modules/attachments/ apps/mobile/src/lib/api.ts
git commit -m "feat(evidence): SHA-256 hashing + GPS chain of custody on all attachments"
```

---

## Task 4: Predictive Analytics — Trends & Anomaly Detection

**Files:**
- Modify: `apps/api/src/modules/incidents/incidents.service.ts`
- Modify: `apps/api/src/modules/incidents/incidents.controller.ts`

- [ ] **Step 1: Add trend analysis method to service**

In `apps/api/src/modules/incidents/incidents.service.ts`, add:

```typescript
  async getTrends(weeks: number = 4): Promise<{
    weeklyTrend: { week: string; count: number; avgResponseMin: number | null }[];
    changePercent: number | null;
    byType: { type: string; thisWeek: number; lastWeek: number; change: number }[];
    byHour: { hour: number; avgCount: number }[];
  }> {
    const now = new Date();
    const from = new Date(now.getTime() - weeks * 7 * 86400000);

    const incidents = await this.repo.find({
      where: { createdAt: MoreThanOrEqual(from) },
      select: ['id', 'type', 'priority', 'createdAt', 'assignedAt'],
    });

    // Group by ISO week
    const weekMap: Record<string, { count: number; responseTimes: number[] }> = {};
    const typeThisWeek: Record<string, number> = {};
    const typeLastWeek: Record<string, number> = {};
    const hourCounts: Record<number, number[]> = {};

    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(lastWeekStart.getDate() - 14);

    for (const inc of incidents) {
      const weekKey = this.getISOWeek(inc.createdAt);
      if (!weekMap[weekKey]) weekMap[weekKey] = { count: 0, responseTimes: [] };
      weekMap[weekKey]!.count++;
      if (inc.assignedAt) {
        const responseMin = (inc.assignedAt.getTime() - inc.createdAt.getTime()) / 60000;
        weekMap[weekKey]!.responseTimes.push(responseMin);
      }

      // Type trends (this week vs last week)
      if (inc.createdAt >= thisWeekStart) {
        typeThisWeek[inc.type] = (typeThisWeek[inc.type] ?? 0) + 1;
      } else if (inc.createdAt >= lastWeekStart) {
        typeLastWeek[inc.type] = (typeLastWeek[inc.type] ?? 0) + 1;
      }

      // Hourly pattern
      const hour = inc.createdAt.getHours();
      if (!hourCounts[hour]) hourCounts[hour] = [];
      hourCounts[hour]!.push(1);
    }

    const weeklyTrend = Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, data]) => ({
        week,
        count: data.count,
        avgResponseMin: data.responseTimes.length > 0
          ? Math.round((data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length) * 10) / 10
          : null,
      }));

    const lastTwo = weeklyTrend.slice(-2);
    const changePercent = lastTwo.length === 2 && lastTwo[0]!.count > 0
      ? Math.round(((lastTwo[1]!.count - lastTwo[0]!.count) / lastTwo[0]!.count) * 100)
      : null;

    const allTypes = new Set([...Object.keys(typeThisWeek), ...Object.keys(typeLastWeek)]);
    const byType = Array.from(allTypes).map((type) => {
      const tw = typeThisWeek[type] ?? 0;
      const lw = typeLastWeek[type] ?? 0;
      return { type, thisWeek: tw, lastWeek: lw, change: lw > 0 ? Math.round(((tw - lw) / lw) * 100) : 0 };
    });

    const totalDays = Math.ceil((now.getTime() - from.getTime()) / 86400000);
    const byHour = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      avgCount: Math.round(((hourCounts[h]?.length ?? 0) / totalDays) * 100) / 100,
    }));

    return { weeklyTrend, changePercent, byType, byHour };
  }

  private getISOWeek(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }
```

- [ ] **Step 2: Add anomaly detection method**

```typescript
  async getAnomalies(): Promise<{
    sectorAnomalies: { sectorId: string; sectorName: string; currentCount: number; avgCount: number; multiplier: number }[];
    hourlyAnomalies: { hour: number; currentCount: number; avgCount: number; multiplier: number }[];
  }> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentHour = now.getHours();

    // Last 30 days baseline
    const baselineStart = new Date(now.getTime() - 30 * 86400000);

    // Today's incidents by sector
    const todayBySector = await this.repo
      .createQueryBuilder('i')
      .select('i.sector_id', 'sectorId')
      .addSelect('s.name', 'sectorName')
      .addSelect('COUNT(*)', 'count')
      .innerJoin('sectors', 's', 's.id = i.sector_id')
      .where('i.created_at >= :todayStart', { todayStart })
      .groupBy('i.sector_id')
      .addGroupBy('s.name')
      .getRawMany();

    // 30-day average by sector
    const baselineBySector = await this.repo
      .createQueryBuilder('i')
      .select('i.sector_id', 'sectorId')
      .addSelect('COUNT(*) / 30.0', 'avgDaily')
      .where('i.created_at >= :baselineStart', { baselineStart })
      .andWhere('i.created_at < :todayStart', { todayStart })
      .groupBy('i.sector_id')
      .getRawMany();

    const sectorAvgMap = new Map(baselineBySector.map((r: any) => [r.sectorId, Number(r.avgDaily)]));

    const sectorAnomalies = todayBySector
      .map((r: any) => {
        const avg = sectorAvgMap.get(r.sectorId) ?? 1;
        const current = Number(r.count);
        return {
          sectorId: r.sectorId,
          sectorName: r.sectorName,
          currentCount: current,
          avgCount: Math.round(avg * 10) / 10,
          multiplier: Math.round((current / avg) * 10) / 10,
        };
      })
      .filter((a) => a.multiplier >= 2.0) // Flag sectors with 2x+ normal activity
      .sort((a, b) => b.multiplier - a.multiplier);

    // Hourly anomalies — compare current hour's count to 30-day average for same hour
    const todayByHour = await this.repo
      .createQueryBuilder('i')
      .select('EXTRACT(HOUR FROM i.created_at)', 'hour')
      .addSelect('COUNT(*)', 'count')
      .where('i.created_at >= :todayStart', { todayStart })
      .groupBy('EXTRACT(HOUR FROM i.created_at)')
      .getRawMany();

    const baselineByHour = await this.repo
      .createQueryBuilder('i')
      .select('EXTRACT(HOUR FROM i.created_at)', 'hour')
      .addSelect('COUNT(*) / 30.0', 'avgCount')
      .where('i.created_at >= :baselineStart', { baselineStart })
      .andWhere('i.created_at < :todayStart', { todayStart })
      .groupBy('EXTRACT(HOUR FROM i.created_at)')
      .getRawMany();

    const hourAvgMap = new Map(baselineByHour.map((r: any) => [Number(r.hour), Number(r.avgCount)]));

    const hourlyAnomalies = todayByHour
      .map((r: any) => {
        const hour = Number(r.hour);
        const avg = hourAvgMap.get(hour) ?? 1;
        const current = Number(r.count);
        return {
          hour,
          currentCount: current,
          avgCount: Math.round(avg * 10) / 10,
          multiplier: Math.round((current / avg) * 10) / 10,
        };
      })
      .filter((a) => a.multiplier >= 2.0)
      .sort((a, b) => b.multiplier - a.multiplier);

    return { sectorAnomalies, hourlyAnomalies };
  }
```

- [ ] **Step 3: Add controller endpoints**

In `apps/api/src/modules/incidents/incidents.controller.ts`, add BEFORE the `:id` routes:

```typescript
  @Get('trends')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER)
  getTrends(@Query('weeks') weeks?: string) {
    return this.service.getTrends(weeks ? parseInt(weeks) : 4);
  }

  @Get('anomalies')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.COMMANDER)
  getAnomalies() {
    return this.service.getAnomalies();
  }
```

- [ ] **Step 4: Verify and commit**

```bash
cd /Users/Ivan/Desktop/velnari-police/apps/api && ../../node_modules/.bin/tsc --noEmit
git add apps/api/src/modules/incidents/
git commit -m "feat(analytics): trend analysis (weekly + by-type + by-hour) + anomaly detection (2x threshold)"
```

---

## Task 5: Citizen Portal — Incident Tracking

**Files:**
- Modify: `apps/api/src/modules/incidents/incidents.service.ts`
- Modify: `apps/api/src/modules/incidents/public-report.controller.ts` (or incidents.controller.ts)
- Modify: `apps/api/src/entities/incident.entity.ts`
- Create: `apps/web/src/app/seguimiento/page.tsx`

- [ ] **Step 1: Add trackingToken to incident entity**

In `apps/api/src/entities/incident.entity.ts`, add after `autoDispatched`:

```typescript
  @Column({ name: 'tracking_token', nullable: true, length: 12 })
  trackingToken?: string;
```

- [ ] **Step 2: Generate tracking token on public report creation**

In `apps/api/src/modules/incidents/incidents.service.ts`, update the `create` method to generate a tracking token when description contains "[Reporte ciudadano]":

After the line `const saved = await this.findOne(savedId);`, add:

```typescript
    // Generate tracking token for citizen reports
    if (dto.description?.includes('[Reporte ciudadano]')) {
      const token = this.generateTrackingToken();
      await this.repo.update(savedId, { trackingToken: token });
      (saved as any).trackingToken = token;
    }
```

Add the helper method:

```typescript
  private generateTrackingToken(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
    let token = '';
    for (let i = 0; i < 8; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
  }
```

- [ ] **Step 3: Add public tracking endpoint**

In `apps/api/src/modules/incidents/public-report.controller.ts`, add a GET endpoint (no auth required):

```typescript
  @Get('track/:token')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async trackReport(@Param('token') token: string) {
    const incident = await this.incidentRepo.findOne({
      where: { trackingToken: token },
      select: ['id', 'folio', 'status', 'type', 'priority', 'createdAt', 'assignedAt', 'closedAt', 'resolution'],
    });
    if (!incident) {
      throw new NotFoundException('Reporte no encontrado. Verifica tu código de seguimiento.');
    }
    return {
      folio: incident.folio,
      status: incident.status,
      type: incident.type,
      priority: incident.priority,
      createdAt: incident.createdAt,
      assignedAt: incident.assignedAt,
      closedAt: incident.closedAt,
      resolution: incident.resolution,
    };
  }
```

Add the necessary imports: `NotFoundException`, `Get`, `Param`, and inject `IncidentEntity` repository.

- [ ] **Step 4: Create citizen tracking web page**

Create `apps/web/src/app/seguimiento/page.tsx`:

A public page (no auth required) where citizens can enter their tracking token and see their report status. Features:

- Input field for 8-character tracking code
- "Buscar" button
- Results show: folio, status (with Spanish label + color), type, priority, creation date, assignment date (if any), closure date + resolution (if any)
- Status progression indicator: Reportado → Asignado → En atención → Resuelto
- Velnari branding, dark mode, clean design
- Error handling for invalid tokens
- Rate-limited by the backend (10 req/min)

- [ ] **Step 5: Update public report page to show tracking token**

In `apps/web/src/app/reportar/page.tsx`, update the success state to prominently display the tracking token returned by the API, with a message like "Guarda este código para dar seguimiento: XXXX-XXXX" and a link to `/seguimiento`.

- [ ] **Step 6: Verify and commit**

```bash
git add apps/api/src/entities/incident.entity.ts apps/api/src/modules/incidents/ apps/web/src/app/seguimiento/ apps/web/src/app/reportar/
git commit -m "feat(citizen): tracking portal — citizens can check report status with tracking token"
```

---

## Task 6: SESNSP Report Export

**Files:**
- Modify: `apps/api/src/modules/incidents/incidents.service.ts`
- Modify: `apps/api/src/modules/incidents/incidents.controller.ts`
- Create: `apps/web/src/app/admin/sesnsp/page.tsx`

- [ ] **Step 1: Add SESNSP export method to service**

In `apps/api/src/modules/incidents/incidents.service.ts`, add:

```typescript
  async getSesnspExport(from: Date, to: Date): Promise<{
    periodo: { inicio: string; fin: string };
    resumen: {
      totalIncidentes: number;
      porTipo: Record<string, number>;
      porPrioridad: Record<string, number>;
      porEstatus: Record<string, number>;
      tiempoPromedioRespuestaMin: number | null;
      tiempoPromedioCierreMin: number | null;
    };
    incidentes: {
      folio: string;
      tipo: string;
      prioridad: string;
      estatus: string;
      direccion: string;
      latitud: number;
      longitud: number;
      fechaCreacion: string;
      fechaAsignacion: string | null;
      fechaCierre: string | null;
      resolucion: string | null;
      unidadAsignada: string | null;
    }[];
  }> {
    const incidents = await this.repo.find({
      where: { createdAt: Between(from, to) },
      relations: ['assignedUnit'],
      order: { createdAt: 'ASC' },
    });

    const porTipo: Record<string, number> = {};
    const porPrioridad: Record<string, number> = {};
    const porEstatus: Record<string, number> = {};
    const responseTimes: number[] = [];
    const closeTimes: number[] = [];

    for (const inc of incidents) {
      porTipo[inc.type] = (porTipo[inc.type] ?? 0) + 1;
      porPrioridad[inc.priority] = (porPrioridad[inc.priority] ?? 0) + 1;
      porEstatus[inc.status] = (porEstatus[inc.status] ?? 0) + 1;

      if (inc.assignedAt) {
        responseTimes.push((inc.assignedAt.getTime() - inc.createdAt.getTime()) / 60000);
      }
      if (inc.closedAt) {
        closeTimes.push((inc.closedAt.getTime() - inc.createdAt.getTime()) / 60000);
      }
    }

    const avgResponse = responseTimes.length > 0
      ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10
      : null;
    const avgClose = closeTimes.length > 0
      ? Math.round((closeTimes.reduce((a, b) => a + b, 0) / closeTimes.length) * 10) / 10
      : null;

    return {
      periodo: { inicio: from.toISOString(), fin: to.toISOString() },
      resumen: {
        totalIncidentes: incidents.length,
        porTipo,
        porPrioridad,
        porEstatus,
        tiempoPromedioRespuestaMin: avgResponse,
        tiempoPromedioCierreMin: avgClose,
      },
      incidentes: incidents.map((inc) => ({
        folio: inc.folio,
        tipo: inc.type,
        prioridad: inc.priority,
        estatus: inc.status,
        direccion: inc.address ?? '',
        latitud: Number(inc.lat),
        longitud: Number(inc.lng),
        fechaCreacion: inc.createdAt.toISOString(),
        fechaAsignacion: inc.assignedAt?.toISOString() ?? null,
        fechaCierre: inc.closedAt?.toISOString() ?? null,
        resolucion: inc.resolution ?? null,
        unidadAsignada: inc.assignedUnit?.callSign ?? null,
      })),
    };
  }
```

- [ ] **Step 2: Add controller endpoint**

In `incidents.controller.ts`, add before `:id` routes:

```typescript
  @Get('sesnsp-export')
  @Roles(UserRole.ADMIN, UserRole.COMMANDER)
  getSesnspExport(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const fromDate = from && !isNaN(Date.parse(from)) ? new Date(from) : firstOfMonth;
    const toDate = to && !isNaN(Date.parse(to)) ? new Date(to) : now;
    return this.service.getSesnspExport(fromDate, toDate);
  }
```

- [ ] **Step 3: Create SESNSP export page in web admin**

Create `apps/web/src/app/admin/sesnsp/page.tsx`:

Admin page (ADMIN/COMMANDER only) with:
- Date range selector (default: current month)
- "Generar Reporte" button
- Summary cards: total incidents, by type, by priority, avg response time, avg resolution time
- Full incident table below with all SESNSP fields
- "Descargar CSV" button that generates CSV from the data
- "Descargar JSON" button for machine-readable format
- Dark mode, consistent with admin design

- [ ] **Step 4: Verify and commit**

```bash
git add apps/api/src/modules/incidents/ apps/web/src/app/admin/sesnsp/
git commit -m "feat(sesnsp): SESNSP-format report export with CSV/JSON download"
```

---

## Task 7: Integration Verification

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

---

## Summary of Changes

| Area | What Changed | Impact |
|------|-------------|--------|
| **Auto-Dispatch** | Cron every 2 min assigns low/medium incidents unattended >3min to nearest available unit | Reduces dispatcher workload, faster response to routine incidents |
| **Evidence Hashing** | SHA-256 hash + GPS + timestamp on every attachment | Legally defensible chain of custody for evidence |
| **Trend Analysis** | Weekly trends, type comparison, hourly patterns | Commanders see "robbery up 40% this week" |
| **Anomaly Detection** | Flags sectors/hours with 2x+ normal activity | "Sector B has 3x normal incidents right now" |
| **Citizen Portal** | Public tracking with 8-char code at /seguimiento | Citizens can check "is my report being handled?" |
| **SESNSP Export** | Formatted report with CSV/JSON download | Required for Mexican government compliance reporting |
| **Multi-tenancy** | tenant_id columns + indexes on core tables | Foundation for multi-municipality deployment |
