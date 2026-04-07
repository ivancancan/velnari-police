// apps/api/src/modules/units/units.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { UnitEntity } from '../../entities/unit.entity';
import { UnitLocationHistoryEntity } from '../../entities/unit-location-history.entity';
import { IncidentEntity } from '../../entities/incident.entity';
import { UnitStatus, CreateUnitDto } from '@velnari/shared-types';

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
    @InjectRepository(UnitLocationHistoryEntity)
    private readonly historyRepo: Repository<UnitLocationHistoryEntity>,
    @InjectRepository(IncidentEntity)
    private readonly incidentRepo: Repository<IncidentEntity>,
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

  async updateLocation(id: string, lat: number, lng: number): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(UnitEntity)
      .set({
        currentLocation: () => `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`,
        lastLocationAt: new Date(),
      })
      .where('id = :id', { id })
      .execute();

    await this.historyRepo
      .createQueryBuilder()
      .insert()
      .into(UnitLocationHistoryEntity)
      .values({
        unitId: id,
        lat,
        lng,
        location: () => `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`,
      })
      .execute();
  }

  getHistory(id: string, from: Date, to: Date): Promise<UnitLocationHistoryEntity[]> {
    return this.historyRepo.find({
      where: { unitId: id, recordedAt: Between(from, to) },
      order: { recordedAt: 'ASC' },
      select: ['id', 'lat', 'lng', 'recordedAt'],
    });
  }

  getIncidentsByUnit(id: string, from: Date, to: Date): Promise<IncidentEntity[]> {
    return this.incidentRepo.find({
      where: {
        assignedUnitId: id,
        assignedAt: Between(from, to),
      },
      order: { assignedAt: 'DESC' },
    });
  }

  findAvailableNearby(point: NearbyPoint): Promise<UnitEntity[]> {
    void point;
    return this.repo.find({
      where: { status: UnitStatus.AVAILABLE, isActive: true },
    });
  }

  async getStats(): Promise<{
    total: number;
    available: number;
    enRoute: number;
    onScene: number;
    outOfService: number;
  }> {
    const units = await this.repo.find({ where: { isActive: true } });
    const stats = { total: units.length, available: 0, enRoute: 0, onScene: 0, outOfService: 0 };
    for (const unit of units) {
      if (unit.status === UnitStatus.AVAILABLE) stats.available++;
      else if (unit.status === UnitStatus.EN_ROUTE) stats.enRoute++;
      else if (unit.status === UnitStatus.ON_SCENE) stats.onScene++;
      else if (unit.status === UnitStatus.OUT_OF_SERVICE) stats.outOfService++;
    }
    return stats;
  }
}
