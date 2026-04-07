import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentsService } from '../incidents/incidents.service';
import { UnitsService } from '../units/units.service';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import { IncidentStatus, UnitStatus } from '@velnari/shared-types';
import type { IncidentEntity } from '../../entities/incident.entity';

@Injectable()
export class DispatchService {
  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly unitsService: UnitsService,
    @InjectRepository(IncidentEventEntity)
    private readonly eventRepo: Repository<IncidentEventEntity>,
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

    const event = this.eventRepo.create({
      incidentId,
      type: 'assigned',
      description: `Unidad ${unit.callSign} asignada al incidente`,
      actorId,
      metadata: { unitId, callSign: unit.callSign },
    });
    await this.eventRepo.save(event);

    return savedIncident;
  }
}
