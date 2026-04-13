import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentsService } from './incidents.service';
import { IncidentEntity } from '../../entities/incident.entity';
import { UserEntity } from '../../entities/user.entity';
import { IncidentPriority, IncidentType } from '@velnari/shared-types';

@Controller('incidents')
export class PublicReportController {
  constructor(
    private readonly service: IncidentsService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(IncidentEntity)
    private readonly incidentRepo: Repository<IncidentEntity>,
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
    if (!/^[A-Z2-9]{8}$/.test(token)) {
      throw new BadRequestException('Código de seguimiento inválido.');
    }
    return this.service.getByTrackingToken(token);
  }

  // ─── Public transparency endpoint ─────────────────────────────────────
  // Returns anonymized aggregate data for the public-facing transparency
  // portal. No auth — rate-limited separately. Rows exclude actor ID,
  // description (which may contain citizen PII), and exact coordinates
  // (rounded to 3 decimals ≈ 100m grid) to protect reporter privacy.
  @Get('transparency')
  @SkipThrottle({ default: false })
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async transparency(
    @Query('days') daysRaw?: string,
  ): Promise<{
    windowDays: number;
    totals: { incidents: number; closed: number; inProgress: number };
    byPriority: Record<string, number>;
    byType: Record<string, number>;
    avgResponseMinutes: number | null;
    points: { lat: number; lng: number; type: string; priority: string; createdAt: string; status: string }[];
  }> {
    const days = Math.min(90, Math.max(1, parseInt(daysRaw ?? '30', 10) || 30));
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const rows = await this.incidentRepo
      .createQueryBuilder('i')
      .select([
        'i.lat AS lat',
        'i.lng AS lng',
        'i.type AS type',
        'i.priority AS priority',
        'i.status AS status',
        'i.createdAt AS created_at',
        'i.assignedAt AS assigned_at',
      ])
      .where('i.createdAt >= :from', { from })
      .andWhere('i.lat IS NOT NULL')
      .andWhere('i.lng IS NOT NULL')
      .orderBy('i.createdAt', 'DESC')
      .limit(500)
      .getRawMany<{
        lat: number;
        lng: number;
        type: string;
        priority: string;
        status: string;
        created_at: string;
        assigned_at: string | null;
      }>();

    const byPriority: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let responseSum = 0;
    let responseCount = 0;
    let closed = 0;
    let inProgress = 0;

    for (const r of rows) {
      byPriority[r.priority] = (byPriority[r.priority] ?? 0) + 1;
      byType[r.type] = (byType[r.type] ?? 0) + 1;
      if (r.status === 'closed') closed++;
      else inProgress++;
      if (r.assigned_at && r.created_at) {
        const mins =
          (new Date(r.assigned_at).getTime() - new Date(r.created_at).getTime()) / 60_000;
        if (mins >= 0 && mins < 720) {
          responseSum += mins;
          responseCount++;
        }
      }
    }

    // Round coordinates to ~100m grid to prevent de-anonymization.
    const points = rows.map((r) => ({
      lat: Math.round(Number(r.lat) * 1000) / 1000,
      lng: Math.round(Number(r.lng) * 1000) / 1000,
      type: r.type,
      priority: r.priority,
      createdAt: r.created_at,
      status: r.status,
    }));

    return {
      windowDays: days,
      totals: { incidents: rows.length, closed, inProgress },
      byPriority,
      byType,
      avgResponseMinutes: responseCount > 0 ? Math.round((responseSum / responseCount) * 10) / 10 : null,
      points,
    };
  }
}
