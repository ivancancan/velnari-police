import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentsService } from '../incidents/incidents.service';
import { UnitsService } from '../units/units.service';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import { IncidentEntity } from '../../entities/incident.entity';
import { IncidentUnitAssignmentEntity } from '../../entities/incident-unit-assignment.entity';
import { UnitEntity } from '../../entities/unit.entity';
import { UserEntity } from '../../entities/user.entity';
import { IncidentStatus, UnitStatus } from '@velnari/shared-types';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';

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
    @Inject(forwardRef(() => IncidentsService))
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
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly notifications: NotificationsService,
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
    void this.sendAssignmentNotification(unitId, savedIncident.folio ?? incidentId, etaMinutes);

    return savedIncident;
  }

  async reassignUnit(
    incidentId: string,
    newUnitId: string,
    actorId: string,
  ): Promise<IncidentEntity> {
    const [incident, newUnit] = await Promise.all([
      this.incidentsService.findOne(incidentId),
      this.unitsService.findOne(newUnitId),
    ]);

    if (incident.status === IncidentStatus.CLOSED) {
      throw new BadRequestException('No se puede reasignar un incidente cerrado.');
    }

    if (newUnit.status !== UnitStatus.AVAILABLE) {
      throw new BadRequestException(
        `La unidad ${newUnit.callSign} no está disponible (estado: ${newUnit.status}).`,
      );
    }

    // Release previous unit if assigned
    const previousUnitId = incident.assignedUnitId;
    if (previousUnitId) {
      await this.unitsService.updateStatus(previousUnitId, UnitStatus.AVAILABLE);
    }

    incident.assignedUnitId = newUnitId;
    incident.status = IncidentStatus.ASSIGNED;
    incident.assignedAt = new Date();

    await this.unitsService.updateStatus(newUnitId, UnitStatus.EN_ROUTE);
    const saved = await this.incidentsService.saveIncident(incident);

    await this.assignmentRepo.upsert(
      { incidentId, unitId: newUnitId, assignedBy: actorId, assignedAt: new Date() },
      ['incidentId', 'unitId'],
    );

    let etaMinutes: number | null = null;
    if (newUnit.currentLocation) {
      const distResult = await this.unitRepo
        .createQueryBuilder('u')
        .select('ST_Distance(u.current_location::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) / 1000', 'distance_km')
        .where('u.id = :id', { id: newUnitId })
        .setParameters({ lat: Number(incident.lat), lng: Number(incident.lng) })
        .getRawOne();
      if (distResult?.distance_km) {
        etaMinutes = Math.max(1, Math.round((Number(distResult.distance_km) / 30) * 60));
      }
    }

    const previousUnit = previousUnitId ? await this.unitsService.findOne(previousUnitId) : null;

    const event = this.eventRepo.create({
      incidentId,
      type: 'reassigned',
      description: `Reasignado: ${previousUnit?.callSign ?? 'sin unidad'} → ${newUnit.callSign}${etaMinutes ? ` · ETA: ~${etaMinutes} min` : ''}`,
      actorId,
      metadata: { previousUnitId, newUnitId, callSign: newUnit.callSign },
    });
    await this.eventRepo.save(event);

    this.realtime.emitIncidentAssigned(incidentId, newUnitId, etaMinutes);
    void this.sendAssignmentNotification(newUnitId, saved.folio ?? incidentId, etaMinutes);

    return saved;
  }

  private async sendAssignmentNotification(unitId: string, incidentFolio: string, etaMinutes: number | null): Promise<void> {
    const unit = await this.unitRepo.findOne({ where: { id: unitId } });
    if (!unit?.assignedUserId) return;
    const user = await this.userRepo.findOne({ where: { id: unit.assignedUserId } });
    if (!user?.expoPushToken) return;

    const eta = etaMinutes ? ` · ETA: ~${etaMinutes} min` : '';
    await this.notifications.sendPush(user.expoPushToken, {
      title: 'Incidente asignado',
      body: `Se te asignó ${incidentFolio}${eta}`,
      sound: 'default',
      priority: 'high',
      channelId: 'dispatch',
      data: { incidentFolio },
    });
  }

  async suggestUnits(incidentId: string): Promise<SuggestedUnit[]> {
    const incident = await this.incidentsService.findOne(incidentId);
    if (!incident.lat || !incident.lng) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Single query: get nearby available units + their incident count for today
    const rows: {
      u_id: string;
      u_call_sign: string;
      distance_km: string;
      incidents_today: string;
    }[] = await this.unitRepo.query(
      `SELECT
         u.id AS u_id,
         u.call_sign AS u_call_sign,
         ST_Distance(
           u.current_location::geography,
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
         ) / 1000 AS distance_km,
         COALESCE(ic.cnt, 0) AS incidents_today
       FROM units u
       LEFT JOIN (
         SELECT assigned_unit_id, COUNT(*) AS cnt
         FROM incidents
         WHERE created_at >= $3
         GROUP BY assigned_unit_id
       ) ic ON ic.assigned_unit_id = u.id
       WHERE u.is_active = true
         AND u.status = $4
         AND u.current_location IS NOT NULL
       ORDER BY distance_km ASC
       LIMIT 10`,
      [Number(incident.lng), Number(incident.lat), today.toISOString(), UnitStatus.AVAILABLE],
    );

    return rows
      .map((row) => {
        const distanceKm = Number(row.distance_km) || 0;
        const incidentsToday = Number(row.incidents_today) || 0;
        const score = distanceKm * 0.7 + incidentsToday * 2 * 0.3;
        return {
          unitId: row.u_id,
          callSign: row.u_call_sign,
          distanceKm: Math.round(distanceKm * 100) / 100,
          incidentsToday,
          score: Math.round(score * 100) / 100,
        };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
  }
}
