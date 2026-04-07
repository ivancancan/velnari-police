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
  }

  findAvailableNearby(point: NearbyPoint): Promise<UnitEntity[]> {
    // MVP: returns all available units (PostGIS ST_DWithin to be added in P1)
    void point; // used in P1 for geospatial query
    return this.repo.find({
      where: { status: UnitStatus.AVAILABLE, isActive: true },
    });
  }
}
