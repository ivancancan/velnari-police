import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, MoreThanOrEqual, Repository } from 'typeorm';
import { IncidentEntity } from '../../entities/incident.entity';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import { IncidentUnitAssignmentEntity } from '../../entities/incident-unit-assignment.entity';
import { SectorEntity } from '../../entities/sector.entity';
import { UnitEntity } from '../../entities/unit.entity';
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
    @InjectRepository(SectorEntity)
    private readonly sectorRepo: Repository<SectorEntity>,
    @InjectRepository(UnitEntity)
    private readonly unitRepo: Repository<UnitEntity>,
    @InjectRepository(IncidentUnitAssignmentEntity)
    private readonly assignmentRepo: Repository<IncidentUnitAssignmentEntity>,
  ) {}

  findAll(filters: FindAllFilters): Promise<IncidentEntity[]> {
    const where: Record<string, unknown> = {};
    if (filters.status) where['status'] = filters.status;
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
}
