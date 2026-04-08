// apps/api/src/modules/units/units.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { UnitEntity } from '../../entities/unit.entity';
import { UnitLocationHistoryEntity } from '../../entities/unit-location-history.entity';
import { IncidentEntity } from '../../entities/incident.entity';
import { UnitStatus, CreateUnitDto } from '@velnari/shared-types';
import { SectorsService } from '../sectors/sectors.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

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
  private readonly unitSectorCache = new Map<string, string[]>();

  constructor(
    @InjectRepository(UnitEntity)
    private readonly repo: Repository<UnitEntity>,
    @InjectRepository(UnitLocationHistoryEntity)
    private readonly historyRepo: Repository<UnitLocationHistoryEntity>,
    @InjectRepository(IncidentEntity)
    private readonly incidentRepo: Repository<IncidentEntity>,
    private readonly sectorsService: SectorsService,
    private readonly realtime: RealtimeGateway,
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

    // Geofence check
    const unit = await this.repo.findOne({
      where: { id },
      select: ['id', 'callSign', 'sectorId'],
    });
    if (!unit) return;

    const previous = this.unitSectorCache.get(id) ?? [];
    const { entered, exited } = await this.sectorsService.checkGeofences(
      id,
      unit.callSign,
      lat,
      lng,
      previous,
    );

    const nowInside = [
      ...previous.filter((sid) => !exited.map((s) => s.id).includes(sid)),
      ...entered.map((s) => s.id),
    ];
    this.unitSectorCache.set(id, nowInside);

    for (const sector of entered) {
      this.realtime.emitGeofenceEntered({
        unitId: id,
        callSign: unit.callSign,
        sectorId: sector.id,
        sectorName: sector.name,
      });
    }
    for (const sector of exited) {
      this.realtime.emitGeofenceExited({
        unitId: id,
        callSign: unit.callSign,
        sectorId: sector.id,
        sectorName: sector.name,
      });
    }
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

  async findAvailableNearby(point: NearbyPoint): Promise<(UnitEntity & { distanceKm: number })[]> {
    const radiusKm = point.radiusKm ?? 10;
    const { raw, entities } = await this.repo
      .createQueryBuilder('unit')
      .select('unit')
      .addSelect(
        `ST_Distance(
          unit.current_location::geography,
          ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography
        ) / 1000`,
        'distance_km',
      )
      .where('unit.is_active = true')
      .andWhere('unit.status = :status', { status: UnitStatus.AVAILABLE })
      .andWhere(
        `ST_DWithin(
          unit.current_location::geography,
          ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography,
          :radiusMeters
        )`,
        { radiusMeters: radiusKm * 1000 },
      )
      .orderBy('distance_km', 'ASC')
      .limit(20)
      .getRawAndEntities();

    return entities.map((entity, i) => ({
      ...entity,
      distanceKm: parseFloat(raw[i]?.distance_km ?? '0'),
    }));
  }

  async getUnitReport(
    unitId: string,
    from: Date,
    to: Date,
  ): Promise<{
    unit: { id: string; callSign: string; status: UnitStatus };
    period: { from: Date; to: Date };
    stats: {
      totalIncidents: number;
      closedIncidents: number;
      avgResponseMinutes: number | null;
      gpsPointsRecorded: number;
    };
    incidents: IncidentEntity[];
  }> {
    const unit = await this.repo.findOne({ where: { id: unitId } });
    if (!unit) throw new NotFoundException(`Unidad ${unitId} no encontrada`);

    const [incidents, historyPoints] = await Promise.all([
      this.incidentRepo.find({
        where: { assignedUnitId: unitId, assignedAt: Between(from, to) },
        order: { assignedAt: 'ASC' },
      }),
      this.historyRepo.find({
        where: { unitId, recordedAt: Between(from, to) },
        select: ['id'],
      }),
    ]);

    const closed = incidents.filter((i) => i.closedAt);
    const responseTimes = closed
      .filter((i) => i.assignedAt && i.arrivedAt)
      .map(
        (i) =>
          (i.arrivedAt!.getTime() - i.assignedAt!.getTime()) / 60000,
      );

    const avgResponseMinutes =
      responseTimes.length > 0
        ? Math.round(
            responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
          )
        : null;

    return {
      unit: { id: unit.id, callSign: unit.callSign, status: unit.status },
      period: { from, to },
      stats: {
        totalIncidents: incidents.length,
        closedIncidents: closed.length,
        avgResponseMinutes,
        gpsPointsRecorded: historyPoints.length,
      },
      incidents,
    };
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
