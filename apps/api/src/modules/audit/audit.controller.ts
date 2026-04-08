import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../../entities/audit-log.entity';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@velnari/shared-types';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
  ) {}

  @Get()
  async findAll(
    @Query('entityType') entityType?: string,
    @Query('actorId') actorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    const qb = this.repo
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .limit(Math.min(parseInt(limit), 200))
      .offset(parseInt(offset));

    if (entityType) qb.andWhere('a.entityType = :entityType', { entityType });
    if (actorId) qb.andWhere('a.actorId = :actorId', { actorId });
    if (from) qb.andWhere('a.createdAt >= :from', { from: new Date(from) });
    if (to) qb.andWhere('a.createdAt <= :to', { to: new Date(to) });

    const [logs, total] = await qb.getManyAndCount();
    return { logs, total };
  }
}
