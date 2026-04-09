import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { IncidentEntity } from '../../entities/incident.entity';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import { IncidentStatus, IncidentPriority } from '@velnari/shared-types';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const ESCALATION_MINUTES = 5;

const PRIORITY_UP: Record<string, string> = {
  [IncidentPriority.LOW]: IncidentPriority.MEDIUM,
  [IncidentPriority.MEDIUM]: IncidentPriority.HIGH,
  [IncidentPriority.HIGH]: IncidentPriority.CRITICAL,
};

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    @InjectRepository(IncidentEntity)
    private readonly incidentRepo: Repository<IncidentEntity>,
    @InjectRepository(IncidentEventEntity)
    private readonly eventRepo: Repository<IncidentEventEntity>,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkEscalations(): Promise<void> {
    const threshold = new Date(Date.now() - ESCALATION_MINUTES * 60_000);

    // Find open incidents that were created more than X minutes ago and haven't been assigned
    const staleIncidents = await this.incidentRepo.find({
      where: {
        status: IncidentStatus.OPEN,
        createdAt: LessThan(threshold),
      },
    });

    for (const incident of staleIncidents) {
      const newPriority = PRIORITY_UP[incident.priority];
      if (!newPriority) continue; // already critical

      this.logger.warn(`Escalating ${incident.folio} from ${incident.priority} to ${newPriority} — unattended for ${ESCALATION_MINUTES}+ min`);

      incident.priority = newPriority as IncidentPriority;
      await this.incidentRepo.save(incident);

      const event = this.eventRepo.create({
        incidentId: incident.id,
        type: 'escalated',
        description: `Prioridad escalada automáticamente a ${newPriority} — sin atender por ${ESCALATION_MINUTES}+ minutos`,
        actorId: '00000000-0000-0000-0000-000000000000', // system
      });
      await this.eventRepo.save(event);

      // Emit to command
      this.realtime.emitIncidentStatusChanged(incident.id, incident.status);
    }
  }
}
