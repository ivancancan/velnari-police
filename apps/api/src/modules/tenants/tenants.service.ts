import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MunicipioEntity } from '../../entities/municipio.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(MunicipioEntity)
    private readonly repo: Repository<MunicipioEntity>,
  ) {}

  findAll(): Promise<MunicipioEntity[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<MunicipioEntity> {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException(`Municipio ${id} no encontrado`);
    return m;
  }

  create(dto: { name: string; state?: string; slug?: string; contactEmail?: string }): Promise<MunicipioEntity> {
    const m = this.repo.create({
      name: dto.name,
      state: dto.state,
      slug: dto.slug ?? dto.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      contactEmail: dto.contactEmail,
    });
    return this.repo.save(m);
  }

  async update(id: string, dto: { name?: string; state?: string; contactEmail?: string; isActive?: boolean }): Promise<MunicipioEntity> {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }
}
