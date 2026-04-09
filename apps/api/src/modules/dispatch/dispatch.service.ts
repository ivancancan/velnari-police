import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { IncidentsService } from '../incidents/incidents.service';
import { UnitsService } from '../units/units.service';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import { IncidentEntity } from '../../entities/incident.entity';
import { IncidentUnitAssignmentEntity } from '../../entities/incident-unit-assignment.entity';
import { UnitEntity } from '../../entities/unit.entity';
import { IncidentStatus, UnitStatus } from '@velnari/shared-types';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface SuggestedUnit {
  unitId: string;
  callSign: string;
  distanceKm: number;
  incidentsToday: number;
  score: number;
}

@Injectable()
export class DispatchService {
  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly unitsService: UnitsService,
    @InjectRepository(IncidentEventEntity)
    private readonly eventRepo: Repository<IncidentEventEntity>,
    @InjectRepository(IncidentEntity)
    private readonly incidentRepo: Repository<IncidentEntity>,
    @InjectRepository(UnitEntity)
    private readonly unitRepo: Repository<UnitEntity>,
    @InjectRepository(IncidentUnitAssignmentEntity)
    private readonly assignmentRepo: Repository<IncidentUnitAssignmentEntity>,
    private readonly realtime: RealtimeGateway,
  ) {}

  async assignUnit(
    incidentId: string,
    unitId: string,
    actorId: string,
  ): Promise<IncidentEntity> {
    const [incident, unit] = await Promise.all([
      this.incidentsService.findOne(incidentId),
      this.unitsService.findOne(unitId),
    ]);

    if (incident.status === IncidentStatus.CLOSED) {
      throw new BadRequestException('No se puede asignar una unidad a un incidente cerrado.');
    }

    if (unit.status !== UnitStatus.AVAILABLE) {
      throw new BadRequestException(
        `La unidad ${unit.callSign} no está disponible (estado: ${unit.status}).`,
      );
    }

    incident.assignedUnitId = unitId;
    incident.status = IncidentStatus.ASSIGNED;
    incident.assignedAt = new Date();

    await this.unitsService.updateStatus(unitId, UnitStatus.EN_ROUTE);
    const savedIncident = await this.incidentsService.saveIncident(incident);

    // Record in assignments table
    await this.assignmentRepo.upsert(
      { incidentId, unitId, assignedBy: actorId, assignedAt: new Date() },
      ['incidentId', 'unitId'],
    );

    // Calculate ETA based on distance
    let etaMinutes: number | null = null;
    if (unit.currentLocation) {
      const distResult = await this.unitRepo
        .createQueryBuilder('u')
        .select('ST_Distance(u.current_location::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) / 1000', 'distance_km')
        .where('u.id = :id', { id: unitId })
        .setParameters({ lat: Number(incident.lat), lng: Number(incident.lng) })
        .getRawOne();

      if (distResult?.distance_km) {
        // Assume avg speed 30 km/h in urban area
        etaMinutes = Math.round((Number(distResult.distance_km) / 30) * 60);
        if (etaMinutes < 1) etaMinutes = 1;
      }
    }

    const event = this.eventRepo.create({
      incidentId,
      type: 'assigned',
      description: `Unidad ${unit.callSign} asignada al incidente${etaMinutes ? ` · ETA: ~${etaMinutes} min` : ''}`,
      actorId,
      metadata: { unitId, callSign: unit.callSign },
    });
    await this.eventRepo.save(event);

    this.realtime.emitIncidentAssigned(incidentId, unitId, etaMinutes);

    return savedIncident;
  }

  async suggestUnits(incidentId: string): Promise<SuggestedUnit[]> {
    const incident = await this.incidentsService.findOne(incidentId);
    if (!incident.lat || !incident.lng) return [];

    const { raw, entities } = await this.unitRepo
      .createQueryBuilder('u')
      .addSelect(
        `ST_Distance(
          u.current_location::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
        ) / 1000`,
        'distance_km',
      )
      .where('u.is_active = true')
      .andWhere('u.status = :status', { status: UnitStatus.AVAILABLE })
      .andWhere('u.current_location IS NOT NULL')
      .setParameters({ lat: Number(incident.lat), lng: Number(incident.lng) })
      .orderBy('distance_km', 'ASC')
      .limit(10)
      .getRawAndEntities();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results: SuggestedUnit[] = [];
    for (let i = 0; i < entities.length; i++) {
      const unit = entities[i]!;
      const distanceKm = Number(raw[i]?.distance_km) || 0;

      const incidentsToday = await this.incidentRepo.count({
        where: { assignedUnitId: unit.id, createdAt: MoreThanOrEqual(today) },
      });

      // Score: lower is better. Distance weighted 0.7, workload weighted 0.3
      const score = distanceKm * 0.7 + incidentsToday * 2 * 0.3;

      results.push({
        unitId: unit.id,
        callSign: unit.callSign,
        distanceKm: Math.round(distanceKm * 100) / 100,
        incidentsToday,
        score: Math.round(score * 100) / 100,
      });
    }

    return results.sort((a, b) => a.score - b.score).slice(0, 3);
  }
}
