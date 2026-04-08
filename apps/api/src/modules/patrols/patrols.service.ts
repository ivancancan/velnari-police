// apps/api/src/modules/patrols/patrols.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PatrolEntity, PatrolStatus } from '../../entities/patrol.entity';
import { UnitLocationHistoryEntity } from '../../entities/unit-location-history.entity';
import type { CreatePatrolDto } from '@velnari/shared-types';

@Injectable()
export class PatrolsService {
  constructor(
    @InjectRepository(PatrolEntity)
    private readonly repo: Repository<PatrolEntity>,
    @InjectRepository(UnitLocationHistoryEntity)
    private readonly historyRepo: Repository<UnitLocationHistoryEntity>,
  ) {}

  findActive(): Promise<PatrolEntity[]> {
    return this.repo.find({
      where: { status: In([PatrolStatus.ACTIVE, PatrolStatus.SCHEDULED]) },
      order: { startAt: 'ASC' },
      relations: ['unit', 'sector'],
    });
  }

  findByUnit(unitId: string): Promise<PatrolEntity[]> {
    return this.repo.find({
      where: { unitId },
      order: { startAt: 'DESC' },
    });
  }

  create(dto: CreatePatrolDto, createdBy: string): Promise<PatrolEntity> {
    const patrol = this.repo.create({
      unitId: dto.unitId,
      sectorId: dto.sectorId,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      status: PatrolStatus.SCHEDULED,
      createdBy,
    });
    return this.repo.save(patrol);
  }

  async cancel(id: string): Promise<PatrolEntity> {
    const patrol = await this.repo.findOne({ where: { id } });
    if (!patrol) throw new NotFoundException(`Patrullaje ${id} no encontrado`);
    patrol.status = PatrolStatus.CANCELLED;
    return this.repo.save(patrol);
  }

  async getCoverage(id: string): Promise<{ patrolId: string; pings: number; startAt: Date; endAt: Date }> {
    const patrol = await this.repo.findOne({ where: { id } });
    if (!patrol) throw new NotFoundException(`Patrullaje ${id} no encontrado`);

    const pings = await this.historyRepo
      .createQueryBuilder('h')
      .where('h.unitId = :unitId', { unitId: patrol.unitId })
      .andWhere('h.recordedAt >= :start', { start: patrol.startAt })
      .andWhere('h.recordedAt <= :end', { end: patrol.endAt })
      .getCount();

    return { patrolId: id, pings, startAt: patrol.startAt, endAt: patrol.endAt };
  }
}
