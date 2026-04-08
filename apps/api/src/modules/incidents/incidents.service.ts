import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { IncidentEntity } from '../../entities/incident.entity';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import {
  IncidentStatus,
  CreateIncidentDto,
  CloseIncidentDto,
  AddIncidentNoteDto,
} from '@velnari/shared-types';

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
}
