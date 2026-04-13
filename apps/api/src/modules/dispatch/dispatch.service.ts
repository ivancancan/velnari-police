import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async assignUnit(
    incidentId: string,
    unitId: string,
    actorId: string,
  ): Promise<IncidentEntity> {
    // All writes in ONE transaction — if any fails, the whole assignment rolls back.
    const { savedIncident, unit, etaMinutes } = await this.dataSource.transaction(
      async (manager) => {
        const incident = await manager.findOne(IncidentEntity, { where: { id: incidentId } });
        if (!incident) throw new BadRequestException('Incidente no encontrado.');
        const unit = await manager.findOne(UnitEntity, { where: { id: unitId } });
        if (!unit) throw new BadRequestException('Unidad no encontrada.');

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
        unit.status = UnitStatus.EN_ROUTE;

        const savedIncident = await manager.save(IncidentEntity, incident);
        await manager.save(UnitEntity, unit);

        await manager
          .createQueryBuilder()
          .insert()
          .into(IncidentUnitAssignmentEntity)
          .values({ incidentId, unitId, assignedBy: actorId, assignedAt: new Date() })
          .orUpdate(['assigned_by', 'assigned_at'], ['incident_id', 'unit_id'])
          .execute();

        // ETA calc inside the transaction (read-only, safe)
        let etaMinutes: number | null = null;
        if (unit.currentLocation) {
          const distResult = await manager.query(
            `SELECT ST_Distance(u.current_location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 AS distance_km
             FROM units u WHERE u.id = $3 LIMIT 1`,
            [Number(incident.lng), Number(incident.lat), unitId],
          );
          const distKm = distResult?.[0]?.distance_km;
          if (distKm) {
            etaMinutes = Math.max(1, Math.round((Number(distKm) / 30) * 60));
          }
        }

        await manager.save(IncidentEventEntity, manager.create(IncidentEventEntity, {
          incidentId,
          type: 'assigned',
          description: `Unidad ${unit.callSign} asignada al incidente${etaMinutes ? ` · ETA: ~${etaMinutes} min` : ''}`,
          actorId,
          metadata: { unitId, callSign: unit.callSign },
        }));

        return { savedIncident, unit, etaMinutes };
      },
    );

    // Side effects AFTER commit (if realtime/notifications fail, DB state is still consistent)
    this.realtime.emitIncidentAssigned(incidentId, unitId, etaMinutes);
    void this.sendAssignmentNotification(unitId, savedIncident.folio ?? incidentId, etaMinutes);
    // Emit unit status change so command map reflects EN_ROUTE
    this.realtime.emitUnitStatusChanged({
      unitId,
      status: UnitStatus.EN_ROUTE,
      previousStatus: UnitStatus.AVAILABLE,
    });

    return savedIncident;
  }

  async reassignUnit(
    incidentId: string,
    newUnitId: string,
    actorId: string,
  ): Promise<IncidentEntity> {
    const { saved, newUnit, previousUnitId, etaMinutes } = await this.dataSource.transaction(
      async (manager) => {
        const incident = await manager.findOne(IncidentEntity, { where: { id: incidentId } });
        if (!incident) throw new BadRequestException('Incidente no encontrado.');
        const newUnit = await manager.findOne(UnitEntity, { where: { id: newUnitId } });
        if (!newUnit) throw new BadRequestException('Unidad no encontrada.');

        if (incident.status === IncidentStatus.CLOSED) {
          throw new BadRequestException('No se puede reasignar un incidente cerrado.');
        }
        if (newUnit.status !== UnitStatus.AVAILABLE) {
          throw new BadRequestException(
            `La unidad ${newUnit.callSign} no está disponible (estado: ${newUnit.status}).`,
          );
        }

        const previousUnitId = incident.assignedUnitId;
        if (previousUnitId) {
          await manager.update(UnitEntity, { id: previousUnitId }, { status: UnitStatus.AVAILABLE });
        }

        incident.assignedUnitId = newUnitId;
        incident.status = IncidentStatus.ASSIGNED;
        incident.assignedAt = new Date();
        newUnit.status = UnitStatus.EN_ROUTE;

        const saved = await manager.save(IncidentEntity, incident);
        await manager.save(UnitEntity, newUnit);

        await manager
          .createQueryBuilder()
          .insert()
          .into(IncidentUnitAssignmentEntity)
          .values({ incidentId, unitId: newUnitId, assignedBy: actorId, assignedAt: new Date() })
          .orUpdate(['assigned_by', 'assigned_at'], ['incident_id', 'unit_id'])
          .execute();

        let etaMinutes: number | null = null;
        if (newUnit.currentLocation) {
          const distResult = await manager.query(
            `SELECT ST_Distance(u.current_location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 AS distance_km
             FROM units u WHERE u.id = $3 LIMIT 1`,
            [Number(incident.lng), Number(incident.lat), newUnitId],
          );
          const distKm = distResult?.[0]?.distance_km;
          if (distKm) etaMinutes = Math.max(1, Math.round((Number(distKm) / 30) * 60));
        }

        const prevCallSign = previousUnitId
          ? (await manager.findOne(UnitEntity, { where: { id: previousUnitId } }))?.callSign ?? 'sin unidad'
          : 'sin unidad';

        await manager.save(IncidentEventEntity, manager.create(IncidentEventEntity, {
          incidentId,
          type: 'reassigned',
          description: `Reasignado: ${prevCallSign} → ${newUnit.callSign}${etaMinutes ? ` · ETA: ~${etaMinutes} min` : ''}`,
          actorId,
          metadata: { previousUnitId, newUnitId, callSign: newUnit.callSign },
        }));

        return { saved, newUnit, previousUnitId, etaMinutes };
      },
    );

    this.realtime.emitIncidentAssigned(incidentId, newUnitId, etaMinutes);
    this.realtime.emitUnitStatusChanged({
      unitId: newUnitId,
      status: UnitStatus.EN_ROUTE,
      previousStatus: UnitStatus.AVAILABLE,
    });
    if (previousUnitId) {
      this.realtime.emitUnitStatusChanged({
        unitId: previousUnitId,
        status: UnitStatus.AVAILABLE,
        previousStatus: UnitStatus.EN_ROUTE,
      });
    }
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
