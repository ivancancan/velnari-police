import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentEntity } from '../../entities/incident.entity';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import {
  IncidentStatus,
  type CreateIncidentDto,
  type CloseIncidentDto,
  type AddIncidentNoteDto,
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
      location: `SRID=4326;POINT(${dto.lng} ${dto.lat})`,
    });

    const saved = await this.repo.save(incident);

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
}
