// apps/api/src/modules/sectors/sectors.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SectorEntity } from '../../entities/sector.entity';
import type { CreateSectorDto, UpdateSectorDto } from '@velnari/shared-types';

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
  ): Promise<{ entered: SectorEntity[]; exited: SectorEntity[] }> {
    const rows = await this.repo.query(
      `
      SELECT id, name, color
      FROM sectors
      WHERE is_active = true
        AND boundary IS NOT NULL
        AND ST_Contains(boundary, ST_SetSRID(ST_MakePoint($1, $2), 4326))
      `,
      [lng, lat],
    );

    const nowInside: string[] = rows.map((r: { id: string }) => r.id);
    const entered = rows.filter(
      (r: { id: string }) => !previousInsideSectorIds.includes(r.id),
    ) as SectorEntity[];
    const exitedIds = previousInsideSectorIds.filter((id) => !nowInside.includes(id));
    const exited: SectorEntity[] =
      exitedIds.length > 0
        ? await this.repo
            .createQueryBuilder('s')
            .select(['s.id', 's.name', 's.color'])
            .where('s.id IN (:...ids)', { ids: exitedIds })
            .getMany()
        : [];

    return { entered, exited };
  }
}

function coordinatesToWkt(coords: [number, number][]): string {
  const points = coords.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
  return `POLYGON((${points}))`;
}
