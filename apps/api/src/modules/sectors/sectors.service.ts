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
}
