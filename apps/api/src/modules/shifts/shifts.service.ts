import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
    unitId: string; userId?: string; sectorId?: string;
    startAt: string; endAt: string; notes?: string;
  }, createdBy: string): Promise<ShiftEntity> {
    const shift = this.repo.create({
      unitId: dto.unitId, userId: dto.userId, sectorId: dto.sectorId,
      startAt: new Date(dto.startAt), endAt: new Date(dto.endAt),
      notes: dto.notes, status: ShiftStatus.SCHEDULED, createdBy,
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
      where: { assignedUnitId: unitId, status: In([IncidentStatus.OPEN, IncidentStatus.ASSIGNED]) },
      order: { createdAt: 'DESC' },
    });
    return { outgoingShift: activeShift, openIncidents, handoffNotes: activeShift?.handoffNotes ?? null };
  }
}
