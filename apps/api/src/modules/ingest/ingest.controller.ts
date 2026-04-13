import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKeysService } from './api-keys.service';
import { IncidentsService } from '../incidents/incidents.service';
import { UserEntity } from '../../entities/user.entity';
import { IncidentPriority, IncidentType } from '@velnari/shared-types';

// External integration endpoint for 3rd-party dispatch systems
// (C5 Jalisco, 911 city, legacy CAD). Auth via API key in
// `Authorization: Bearer vnrk_...` header. No JWT, no user session.
//
// Example request:
//   POST /api/ingest/incidents
//   Authorization: Bearer vnrk_xxxxxxxx...
//   Content-Type: application/json
//   {
//     "externalId": "C5-2026-00123",
//     "type": "assault",
//     "priority": "high",
//     "lat": 20.6597, "lng": -103.3496,
//     "address": "Av Vallarta y Pavo",
//     "description": "Reporte ciudadano al 911",
//     "reportedAt": "2026-04-13T14:22:00-06:00"
//   }

interface IngestPayload {
  externalId?: string;
  type: string;
  priority?: string;
  lat: number;
  lng: number;
  address?: string;
  description?: string;
  reportedAt?: string;
}

@Controller('ingest')
export class IngestController {
  private readonly logger = new Logger(IngestController.name);

  constructor(
    private readonly apiKeys: ApiKeysService,
    private readonly incidents: IncidentsService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  @Post('incidents')
  @HttpCode(HttpStatus.CREATED)
  // Liberal throttle for integrations — tune per customer SLA.
  @Throttle({ default: { ttl: 60_000, limit: 200 } })
  async ingestIncident(
    @Headers('authorization') authHeader: string | undefined,
    @Body() payload: IngestPayload,
  ): Promise<{ id: string; folio: string; accepted: true }> {
    const rawKey = (authHeader ?? '').replace(/^Bearer\s+/i, '').trim();
    const key = await this.apiKeys.verifyAndTouch(rawKey, 'incident.ingest');

    // Basic payload validation — untrusted source, be strict.
    if (
      typeof payload?.lat !== 'number' ||
      typeof payload?.lng !== 'number' ||
      Math.abs(payload.lat) > 90 ||
      Math.abs(payload.lng) > 180
    ) {
      throw new BadRequestException('Coordenadas inválidas');
    }
    const validTypes = Object.values(IncidentType) as string[];
    if (!payload.type || !validTypes.includes(payload.type)) {
      throw new BadRequestException(
        `Tipo inválido. Permitidos: ${validTypes.join(', ')}`,
      );
    }
    const validPriorities = Object.values(IncidentPriority) as string[];
    const priority = (payload.priority ?? IncidentPriority.MEDIUM).toString();
    if (!validPriorities.includes(priority)) {
      throw new BadRequestException(
        `Prioridad inválida. Permitidas: ${validPriorities.join(', ')}`,
      );
    }

    // Attribute the ingested incident to a system user. Falls back to the
    // first admin on the tenant if no dedicated system user exists.
    const systemUser = await this.userRepo.findOne({
      where: { role: 'admin' as never, isActive: true, tenantId: key.tenantId ?? undefined },
    });
    const createdBy = systemUser?.id ?? '00000000-0000-0000-0000-000000000000';

    const descriptionPrefix = payload.externalId
      ? `[Ingestado · ${key.name} · ext:${payload.externalId}] `
      : `[Ingestado · ${key.name}] `;

    const incident = await this.incidents.create(
      {
        type: payload.type as IncidentType,
        priority: priority as IncidentPriority,
        lat: payload.lat,
        lng: payload.lng,
        address: payload.address,
        description: `${descriptionPrefix}${payload.description ?? 'Sin descripción adicional.'}`,
      },
      createdBy,
    );

    this.logger.log(
      `Ingested incident ${incident.folio} via API key "${key.name}" (ext:${payload.externalId ?? 'n/a'})`,
    );

    return { id: incident.id, folio: incident.folio, accepted: true };
  }
}
