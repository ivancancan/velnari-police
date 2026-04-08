// apps/api/src/modules/sectors/sectors.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SectorEntity } from '../../entities/sector.entity';
import type { CreateSectorDto, UpdateSectorDto } from '@velnari/shared-types';

interface SectorGeofenceRow {
  id: string;
  name: string;
  color: string;
}

@Injectable()
export class SectorsService {
  constructor(
    @InjectRepository(SectorEntity)
    private readonly repo: Repository<SectorEntity>,
  ) {}

  findAll(): Promise<SectorEntity[]> {
    return this.repo.find({ where: { isActive: true } });
  }

  findAllWithBoundary(): Promise<(SectorEntity & { boundaryGeoJson: unknown })[]> {
    return this.repo
      .createQueryBuilder('sector')
      .select([
        'sector.id',
        'sector.name',
        'sector.color',
        'sector.isActive',
        'sector.createdAt',
        'sector.updatedAt',
      ])
      .addSelect('ST_AsGeoJSON(sector.boundary)::json', 'geojson')
      .where('sector.is_active = true')
      .andWhere('sector.boundary IS NOT NULL')
      .getRawAndEntities()
      .then(({ raw, entities }) =>
        entities.map((e, i) => ({
          ...e,
          boundaryGeoJson: raw[i]?.geojson ?? null,
        })),
      );
  }

  async findOne(id: string): Promise<SectorEntity> {
    const sector = await this.repo.findOne({ where: { id } });
    if (!sector) throw new NotFoundException(`Sector ${id} no encontrado`);
    return sector;
  }

  create(dto: CreateSectorDto): Promise<SectorEntity> {
    const sector = this.repo.create({
      name: dto.name,
      color: dto.color ?? '#3B82F6',
    });
    return this.repo.save(sector);
  }

  async update(id: string, dto: UpdateSectorDto): Promise<SectorEntity> {
    const sector = await this.findOne(id);
    Object.assign(sector, dto);
    return this.repo.save(sector);
  }

  async setBoundary(
    id: string,
    coordinates: [number, number][],
  ): Promise<SectorEntity> {
    await this.findOne(id); // throws 404 if not found
    const wkt = coordinatesToWkt(coordinates);
    await this.repo
      .createQueryBuilder()
      .update(SectorEntity)
      .set({
        boundary: () => `ST_SetSRID(ST_GeomFromText('${wkt}'), 4326)`,
      })
      .where('id = :id', { id })
      .execute();
    return this.findOne(id);
  }

  async checkGeofences(
    unitId: string,
    callSign: string,
    lat: number,
    lng: number,
    previousInsideSectorIds: string[],
  ): Promise<{ entered: SectorGeofenceRow[]; exited: SectorGeofenceRow[] }> {
    const rows: SectorGeofenceRow[] = await this.repo.query(
      `
      SELECT id, name, color
      FROM sectors
      WHERE is_active = true
        AND boundary IS NOT NULL
        AND ST_Contains(boundary, ST_SetSRID(ST_MakePoint($1, $2), 4326))
      `,
      [lng, lat],
    );

    const nowInside: string[] = rows.map((r: SectorGeofenceRow) => r.id);
    const entered = rows.filter(
      (r: SectorGeofenceRow) => !previousInsideSectorIds.includes(r.id),
    );
    const exitedIds = previousInsideSectorIds.filter((id) => !nowInside.includes(id));
    const exited: SectorGeofenceRow[] =
      exitedIds.length > 0
        ? await this.repo.query(
            `SELECT id, name, color FROM sectors WHERE id = ANY($1)`,
            [exitedIds],
          )
        : [];

    return { entered, exited };
  }
}

function coordinatesToWkt(coords: [number, number][]): string {
  const points = coords
    .map(([lng, lat]) => {
      const x = Number(lng);
      const y = Number(lat);
      if (!isFinite(x) || !isFinite(y)) throw new Error('Invalid coordinate');
      return `${x} ${y}`;
    })
    .join(', ');
  return `POLYGON((${points}))`;
}
