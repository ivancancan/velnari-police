// apps/api/src/modules/users/users.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../../entities/user.entity';
import { BCRYPT_ROUNDS } from '../auth/auth.service';
import type { CreateUserDto, UpdateUserDto } from '@velnari/shared-types';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  findAll(limit = 50, offset = 0): Promise<UserEntity[]> {
    return this.repo.find({
      where: { isActive: true },
      take: Math.min(limit, 200),
      skip: offset,
    });
  }

  async findOne(id: string): Promise<UserEntity> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return user;
  }

  async create(dto: CreateUserDto): Promise<UserEntity> {
    const existing = await this.repo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException(`El email ${dto.email} ya está registrado`);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.repo.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: dto.role,
      badgeNumber: dto.badgeNumber,
      sectorId: dto.sectorId,
    });
    return this.repo.save(user);
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.repo.update(userId, { passwordHash: hash });
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.findOne(id);
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.badgeNumber !== undefined) user.badgeNumber = dto.badgeNumber;
    if (dto.sectorId !== undefined) user.sectorId = dto.sectorId;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.customPermissions !== undefined) user.customPermissions = dto.customPermissions;
    if (dto.shift !== undefined) user.shift = dto.shift;
    if (dto.password) user.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    return this.repo.save(user);
  }
}
