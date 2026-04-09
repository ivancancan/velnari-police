import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, MoreThanOrEqual, Repository } from 'typeorm';
import { IncidentEntity } from '../../entities/incident.entity';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import { IncidentUnitAssignmentEntity } from '../../entities/incident-unit-assignment.entity';
import { SectorEntity } from '../../entities/sector.entity';
import { UnitEntity } from '../../entities/unit.entity';
import { PatrolEntity, PatrolStatus } from '../../entities/patrol.entity';
import {
  IncidentStatus,
  CreateIncidentDto,
  CloseIncidentDto,
  AddIncidentNoteDto,
} from '@velnari/shared-types';

export interface DailySummary {
  date: string;
  totalIncidents: number;
  closedIncidents: number;
  openIncidents: number;
  avgResponseMinutes: number | null;
  busiestSector: { name: string; count: number } | null;
  bestUnit: { callSign: string; avgResponseMin: number } | null;
  worstHour: { hour: number; count: number } | null;
  comparedToYesterday: { incidents: number; responseTime: number | null };
}

export interface ShiftHandoff {
  generatedAt: string;
  openIncidents: IncidentEntity[];
  assignedIncidents: IncidentEntity[];
  recentlyClosed: IncidentEntity[];
  notes: string[];
}

export interface AnalyticsResult {
  period: { from: string; to: string };
  summary: {
    totalIncidents: number;
    closedIncidents: number;
    openIncidents: number;
    avgResponseMinutes: number | null;
    avgCloseMinutes: number | null;
  };
  byPriority: Record<string, number>;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byHour: { hour: number; count: number }[];
  byDay: { date: string; count: number }[];
  bySector: { sectorId: string; sectorName: string; count: number }[];
  byUnit: { unitId: string; callSign: string; count: number; avgResponseMin: number | null }[];
  incidents: { id: string; folio: string; type: string; priority: string; status: string; createdAt: string; address?: string; patrolId?: string }[];
}

export interface PatrolReport {
  patrol: PatrolEntity;
  incidents: IncidentEntity[];
  stats: { total: number; byType: Record<string, number>; avgResponseMin: number | null };
}

interface FindAllFilters {
  status?: IncidentStatus;
  sectorId?: string;
  priority?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(IncidentEntity)
    private readonly repo: Repository<IncidentEntity>,
    @InjectRepository(IncidentEventEntity)
    private readonly eventRepo: Repository<IncidentEventEntity>,
    @InjectRepository(SectorEntity)
    private readonly sectorRepo: Repository<SectorEntity>,
    @InjectRepository(UnitEntity)
    private readonly unitRepo: Repository<UnitEntity>,
    @InjectRepository(IncidentUnitAssignmentEntity)
    private readonly assignmentRepo: Repository<IncidentUnitAssignmentEntity>,
    @InjectRepository(PatrolEntity)
    private readonly patrolRepo: Repository<PatrolEntity>,
  ) {}

  findAll(filters: FindAllFilters): Promise<IncidentEntity[]> {
    const where: Record<string, unknown> = {};
    if (filters.status) where['status'] = filters.status;
    if (filters.sectorId) where['sectorId'] = filters.sectorId;
    if (filters.priority) where['priority'] = filters.priority;
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    return this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 200),
      skip: offset,
    });
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
    const count = await this.repo.count();
    const folio = `IC-${String(count + 1).padStart(3, '0')}`;

    const result = await this.repo
      .createQueryBuilder()
      .insert()
      .into(IncidentEntity)
      .values({
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
        location: () => `ST_SetSRID(ST_MakePoint(${dto.lng}, ${dto.lat}), 4326)`,
      })
      .returning('id')
      .execute();

    const savedId = result.raw[0]?.id as string;

    // Auto-link to active patrol if the creator has an assigned unit
    const units = await this.unitRepo.find({ where: { assignedUserId: actorId } });
    if (units.length > 0) {
      const activePatrol = await this.patrolRepo.findOne({
        where: { unitId: units[0]!.id, status: PatrolStatus.ACTIVE },
      });
      if (activePatrol) {
        await this.repo.update(savedId, { patrolId: activePatrol.id });
      }
    }

    const saved = await this.findOne(savedId);

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

  getAssignments(incidentId: string): Promise<IncidentUnitAssignmentEntity[]> {
    return this.assignmentRepo.find({
      where: { incidentId },
      relations: ['unit'],
      order: { assignedAt: 'DESC' },
    });
  }

  saveIncident(incident: IncidentEntity): Promise<IncidentEntity> {
    return this.repo.save(incident);
  }

  async getHeatmapPoints(
    from: Date,
    to: Date,
  ): Promise<{ lat: number; lng: number; weight: number }[]> {
    const rows = await this.repo.find({
      where: { createdAt: Between(from, to) },
      select: ['lat', 'lng', 'priority'],
    });

    const PRIORITY_WEIGHT: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    return rows.map((r) => ({
      lat: Number(r.lat),
      lng: Number(r.lng),
      weight: PRIORITY_WEIGHT[r.priority] ?? 1,
    }));
  }

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

  async getDailySummary(date: Date): Promise<DailySummary> {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    const dateStr = dayStart.toISOString().slice(0, 10);

    // Yesterday range
    const yesterdayStart = new Date(dayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(dayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    // Today's incidents
    const todayIncidents = await this.repo.find({
      where: { createdAt: Between(dayStart, dayEnd) },
      select: ['id', 'status', 'sectorId', 'assignedUnitId', 'createdAt', 'assignedAt'],
    });

    // Yesterday's incidents (for comparison)
    const yesterdayIncidents = await this.repo.find({
      where: { createdAt: Between(yesterdayStart, yesterdayEnd) },
      select: ['id', 'createdAt', 'assignedAt'],
    });

    const totalIncidents = todayIncidents.length;
    let closedIncidents = 0;
    let openIncidents = 0;
    let totalResponseMs = 0;
    let responseCount = 0;

    // Per-sector counts
    const sectorCounts: Record<string, number> = {};
    // Per-unit response times
    const unitResponses: Record<string, { totalMs: number; count: number }> = {};
    // Per-hour counts
    const hourCounts: Record<number, number> = {};

    for (const inc of todayIncidents) {
      if (inc.status === IncidentStatus.CLOSED) closedIncidents++;
      if (inc.status === IncidentStatus.OPEN) openIncidents++;

      if (inc.sectorId) {
        sectorCounts[inc.sectorId] = (sectorCounts[inc.sectorId] ?? 0) + 1;
      }

      const hour = new Date(inc.createdAt).getHours();
      hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;

      if (inc.assignedAt && inc.createdAt) {
        const ms = new Date(inc.assignedAt).getTime() - new Date(inc.createdAt).getTime();
        totalResponseMs += ms;
        responseCount++;

        if (inc.assignedUnitId) {
          if (!unitResponses[inc.assignedUnitId]) {
            unitResponses[inc.assignedUnitId] = { totalMs: 0, count: 0 };
          }
          unitResponses[inc.assignedUnitId]!.totalMs += ms;
          unitResponses[inc.assignedUnitId]!.count++;
        }
      }
    }

    const avgResponseMinutes = responseCount > 0
      ? Math.round(totalResponseMs / responseCount / 60000 * 10) / 10
      : null;

    // Busiest sector
    let busiestSector: DailySummary['busiestSector'] = null;
    const sectorEntries = Object.entries(sectorCounts);
    if (sectorEntries.length > 0) {
      sectorEntries.sort((a, b) => b[1] - a[1]);
      const [sectorId, count] = sectorEntries[0]!;
      const sector = await this.sectorRepo.findOne({ where: { id: sectorId } });
      busiestSector = { name: sector?.name ?? sectorId, count };
    }

    // Best unit (lowest avg response time)
    let bestUnit: DailySummary['bestUnit'] = null;
    const unitEntries = Object.entries(unitResponses).filter(([, v]) => v.count > 0);
    if (unitEntries.length > 0) {
      unitEntries.sort((a, b) => (a[1].totalMs / a[1].count) - (b[1].totalMs / b[1].count));
      const [unitId, data] = unitEntries[0]!;
      const unit = await this.unitRepo.findOne({ where: { id: unitId } });
      bestUnit = {
        callSign: unit?.callSign ?? unitId,
        avgResponseMin: Math.round(data.totalMs / data.count / 60000 * 10) / 10,
      };
    }

    // Worst hour (most incidents)
    let worstHour: DailySummary['worstHour'] = null;
    const hourEntries = Object.entries(hourCounts).map(([h, c]) => ({ hour: Number(h), count: c }));
    if (hourEntries.length > 0) {
      hourEntries.sort((a, b) => b.count - a.count);
      worstHour = hourEntries[0] ?? null;
    }

    // Compared to yesterday
    const yesterdayTotal = yesterdayIncidents.length;
    const incidentsChange = yesterdayTotal > 0
      ? Math.round(((totalIncidents - yesterdayTotal) / yesterdayTotal) * 100)
      : totalIncidents > 0 ? 100 : 0;

    let yesterdayResponseMs = 0;
    let yesterdayResponseCount = 0;
    for (const inc of yesterdayIncidents) {
      if (inc.assignedAt && inc.createdAt) {
        yesterdayResponseMs += new Date(inc.assignedAt).getTime() - new Date(inc.createdAt).getTime();
        yesterdayResponseCount++;
      }
    }
    const yesterdayAvgResponse = yesterdayResponseCount > 0
      ? yesterdayResponseMs / yesterdayResponseCount / 60000
      : null;
    let responseTimeChange: number | null = null;
    if (avgResponseMinutes != null && yesterdayAvgResponse != null && yesterdayAvgResponse > 0) {
      responseTimeChange = Math.round(((avgResponseMinutes - yesterdayAvgResponse) / yesterdayAvgResponse) * 100);
    }

    return {
      date: dateStr,
      totalIncidents,
      closedIncidents,
      openIncidents,
      avgResponseMinutes,
      busiestSector,
      bestUnit,
      worstHour,
      comparedToYesterday: {
        incidents: incidentsChange,
        responseTime: responseTimeChange,
      },
    };
  }

  async getShiftHandoff(): Promise<ShiftHandoff> {
    const eightHoursAgo = new Date(Date.now() - 8 * 3600_000);

    const [openIncidents, assignedIncidents, recentlyClosed] = await Promise.all([
      this.repo.find({ where: { status: IncidentStatus.OPEN }, order: { createdAt: 'DESC' } }),
      this.repo.find({
        where: [
          { status: IncidentStatus.ASSIGNED },
          { status: IncidentStatus.EN_ROUTE },
          { status: IncidentStatus.ON_SCENE },
        ],
        order: { createdAt: 'DESC' },
      }),
      this.repo.find({
        where: { status: IncidentStatus.CLOSED, closedAt: MoreThanOrEqual(eightHoursAgo) },
        order: { closedAt: 'DESC' },
      }),
    ]);

    const recentNotes = await this.eventRepo.find({
      where: { type: 'note', createdAt: MoreThanOrEqual(eightHoursAgo) },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return {
      generatedAt: new Date().toISOString(),
      openIncidents,
      assignedIncidents,
      recentlyClosed,
      notes: recentNotes.map((n) => n.description),
    };
  }

  async getAnalytics(filters: {
    from: Date;
    to: Date;
    unitId?: string;
    sectorId?: string;
    patrolId?: string;
    userId?: string;
  }): Promise<AnalyticsResult> {
    const qb = this.repo.createQueryBuilder('i')
      .where('i.created_at >= :from', { from: filters.from })
      .andWhere('i.created_at <= :to', { to: filters.to });

    if (filters.unitId) qb.andWhere('i.assigned_unit_id = :unitId', { unitId: filters.unitId });
    if (filters.sectorId) qb.andWhere('i.sector_id = :sectorId', { sectorId: filters.sectorId });
    if (filters.patrolId) qb.andWhere('i.patrol_id = :patrolId', { patrolId: filters.patrolId });
    if (filters.userId) qb.andWhere('i.created_by = :userId', { userId: filters.userId });

    const incidents = await qb.orderBy('i.created_at', 'DESC').getMany();

    // Aggregation
    const byPriority: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byHourMap: Record<number, number> = {};
    const byDayMap: Record<string, number> = {};
    const sectorCountMap: Record<string, number> = {};
    const unitCountMap: Record<string, { count: number; totalMs: number; responseCount: number }> = {};

    let closedCount = 0;
    let openCount = 0;
    let totalResponseMs = 0;
    let responseCount = 0;
    let totalCloseMs = 0;
    let closeCount = 0;

    for (const inc of incidents) {
      // By priority
      byPriority[inc.priority] = (byPriority[inc.priority] ?? 0) + 1;
      // By type
      byType[inc.type] = (byType[inc.type] ?? 0) + 1;
      // By status
      byStatus[inc.status] = (byStatus[inc.status] ?? 0) + 1;

      // By hour
      const hour = new Date(inc.createdAt).getHours();
      byHourMap[hour] = (byHourMap[hour] ?? 0) + 1;

      // By day
      const day = new Date(inc.createdAt).toISOString().slice(0, 10);
      byDayMap[day] = (byDayMap[day] ?? 0) + 1;

      // By sector
      if (inc.sectorId) {
        sectorCountMap[inc.sectorId] = (sectorCountMap[inc.sectorId] ?? 0) + 1;
      }

      // By unit
      if (inc.assignedUnitId) {
        if (!unitCountMap[inc.assignedUnitId]) {
          unitCountMap[inc.assignedUnitId] = { count: 0, totalMs: 0, responseCount: 0 };
        }
        unitCountMap[inc.assignedUnitId]!.count++;

        if (inc.assignedAt && inc.createdAt) {
          const ms = new Date(inc.assignedAt).getTime() - new Date(inc.createdAt).getTime();
          unitCountMap[inc.assignedUnitId]!.totalMs += ms;
          unitCountMap[inc.assignedUnitId]!.responseCount++;
        }
      }

      // Summary counts
      if (inc.status === IncidentStatus.CLOSED) closedCount++;
      if (inc.status === IncidentStatus.OPEN) openCount++;

      if (inc.assignedAt && inc.createdAt) {
        const ms = new Date(inc.assignedAt).getTime() - new Date(inc.createdAt).getTime();
        totalResponseMs += ms;
        responseCount++;
      }

      if (inc.closedAt && inc.createdAt) {
        const ms = new Date(inc.closedAt).getTime() - new Date(inc.createdAt).getTime();
        totalCloseMs += ms;
        closeCount++;
      }
    }

    // Build byHour (0-23)
    const byHour: { hour: number; count: number }[] = [];
    for (let h = 0; h < 24; h++) {
      byHour.push({ hour: h, count: byHourMap[h] ?? 0 });
    }

    // Build byDay sorted
    const byDay = Object.entries(byDayMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Build bySector with names
    const sectorIds = Object.keys(sectorCountMap);
    const sectors = sectorIds.length > 0
      ? await this.sectorRepo.find({ where: { id: In(sectorIds) } })
      : [];
    const sectorNameMap: Record<string, string> = {};
    for (const s of sectors) sectorNameMap[s.id] = s.name;

    const bySector = sectorIds
      .map((sectorId) => ({
        sectorId,
        sectorName: sectorNameMap[sectorId] ?? sectorId,
        count: sectorCountMap[sectorId] ?? 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Build byUnit with callSigns
    const unitIds = Object.keys(unitCountMap);
    const units = unitIds.length > 0
      ? await this.unitRepo.find({ where: { id: In(unitIds) } })
      : [];
    const unitCallSignMap: Record<string, string> = {};
    for (const u of units) unitCallSignMap[u.id] = u.callSign;

    const byUnit = unitIds
      .map((unitId) => {
        const data = unitCountMap[unitId]!;
        return {
          unitId,
          callSign: unitCallSignMap[unitId] ?? unitId,
          count: data.count,
          avgResponseMin: data.responseCount > 0
            ? Math.round(data.totalMs / data.responseCount / 60000 * 10) / 10
            : null,
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      period: { from: filters.from.toISOString(), to: filters.to.toISOString() },
      summary: {
        totalIncidents: incidents.length,
        closedIncidents: closedCount,
        openIncidents: openCount,
        avgResponseMinutes: responseCount > 0
          ? Math.round(totalResponseMs / responseCount / 60000 * 10) / 10
          : null,
        avgCloseMinutes: closeCount > 0
          ? Math.round(totalCloseMs / closeCount / 60000 * 10) / 10
          : null,
      },
      byPriority,
      byType,
      byStatus,
      byHour,
      byDay,
      bySector,
      byUnit,
      incidents: incidents.map((inc) => ({
        id: inc.id,
        folio: inc.folio,
        type: inc.type,
        priority: inc.priority,
        status: inc.status,
        createdAt: inc.createdAt.toISOString ? inc.createdAt.toISOString() : String(inc.createdAt),
        address: inc.address,
        patrolId: inc.patrolId,
      })),
    };
  }

  async getPatrolReport(id: string): Promise<PatrolReport> {
    const patrol = await this.patrolRepo.findOne({
      where: { id },
      relations: ['unit', 'sector'],
    });
    if (!patrol) throw new NotFoundException(`Patrullaje ${id} no encontrado`);

    const incidents = await this.repo.find({
      where: { patrolId: id },
      order: { createdAt: 'ASC' },
    });

    const byType: Record<string, number> = {};
    let totalMs = 0;
    let rCount = 0;
    for (const inc of incidents) {
      byType[inc.type] = (byType[inc.type] ?? 0) + 1;
      if (inc.assignedAt && inc.createdAt) {
        totalMs += new Date(inc.assignedAt).getTime() - new Date(inc.createdAt).getTime();
        rCount++;
      }
    }

    return {
      patrol,
      incidents,
      stats: {
        total: incidents.length,
        byType,
        avgResponseMin: rCount > 0
          ? Math.round(totalMs / rCount / 60000 * 10) / 10
          : null,
      },
    };
  }
}
