import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentEntity } from '../../entities/incident.entity';
import { IncidentStatus, IncidentPriority } from '@velnari/shared-types';
import { DispatchService } from './dispatch.service';

const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class AutoDispatchService {
  private readonly logger = new Logger(AutoDispatchService.name);

  constructor(
    @InjectRepository(IncidentEntity)
    private readonly incidentRepo: Repository<IncidentEntity>,
    private readonly dispatchService: DispatchService,
  ) {}

  // Run every 2 minutes — auto-dispatch unassigned low/medium priority incidents older than 3 minutes
  @Cron('*/2 * * * *')
  async autoDispatchUnassigned(): Promise<void> {
    const cutoff = new Date(Date.now() - 3 * 60_000); // 3 minutes ago

    const unassigned = await this.incidentRepo
      .createQueryBuilder('i')
      .where('i.status = :status', { status: IncidentStatus.OPEN })
      .andWhere('i.priority IN (:...priorities)', {
        priorities: [IncidentPriority.LOW, IncidentPriority.MEDIUM],
      })
      .andWhere('i.created_at <= :cutoff', { cutoff })
      .andWhere('i.auto_dispatched = false')
      .orderBy('i.created_at', 'ASC')
      .limit(5) // Process max 5 per cycle to avoid overload
      .getMany();

    for (const incident of unassigned) {
      try {
        const suggestions = await this.dispatchService.suggestUnits(incident.id);
        if (suggestions.length === 0) {
          this.logger.warn(`Auto-dispatch: no available units for ${incident.folio}`);
          continue;
        }

        const bestUnit = suggestions[0]!;
        await this.dispatchService.assignUnit(incident.id, bestUnit.unitId, SYSTEM_ACTOR_ID);

        // Mark as auto-dispatched
        await this.incidentRepo.update(incident.id, { autoDispatched: true });

        this.logger.log(
          `Auto-dispatched ${incident.folio} → ${bestUnit.callSign} (${bestUnit.distanceKm}km, score ${bestUnit.score})`,
        );
      } catch (err) {
        this.logger.error(`Auto-dispatch failed for ${incident.folio}: ${(err as Error).message}`);
      }
    }
  }
}
