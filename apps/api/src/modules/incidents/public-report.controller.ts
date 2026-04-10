import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentsService } from './incidents.service';
import { UserEntity } from '../../entities/user.entity';
import { IncidentPriority, IncidentType } from '@velnari/shared-types';

@Controller('incidents')
export class PublicReportController {
  constructor(
    private readonly service: IncidentsService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  @Post('public-report')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  async report(
    @Body()
    body: {
      type: string;
      description: string;
      address?: string;
      lat: number;
      lng: number;
    },
  ) {
    // Use the first admin as the creator for citizen reports
    const admin = await this.userRepo.findOne({ where: { role: 'admin' as never, isActive: true } });
    const createdBy = admin?.id ?? '00000000-0000-0000-0000-000000000000';

    return this.service.create(
      {
        type: body.type as IncidentType,
        priority: IncidentPriority.MEDIUM,
        description: `[Reporte ciudadano] ${body.description}`,
        address: body.address,
        lat: body.lat,
        lng: body.lng,
      },
      createdBy,
    );
  }

  @Get('track/:token')
  async trackReport(@Param('token') token: string) {
    return this.service.getByTrackingToken(token);
  }
}
