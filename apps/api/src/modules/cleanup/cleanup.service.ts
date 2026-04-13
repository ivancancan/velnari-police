import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnitLocationHistoryEntity } from '../../entities/unit-location-history.entity';
import { AuditLogEntity } from '../../entities/audit-log.entity';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    @InjectRepository(UnitLocationHistoryEntity)
    private readonly locationHistoryRepo: Repository<UnitLocationHistoryEntity>,
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepo: Repository<AuditLogEntity>,
  ) {}

  // Run daily at 3 AM — purge location history older than 30 days
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeOldLocationHistory(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const result = await this.locationHistoryRepo
      .createQueryBuilder()
      .delete()
      .where('recorded_at < :cutoff', { cutoff })
      .execute();

    this.logger.log(`Purged ${result.affected ?? 0} location history records older than 30 days`);
  }

  // Run weekly on Sunday at 4 AM — purge audit logs older than retention window.
  // LFPDPPP (Mexico privacy law) requires retention proportional to purpose;
  // we keep 365 days so a yearly audit can review all operational actions.
  // Configurable via AUDIT_RETENTION_DAYS env; defaults to 365.
  @Cron('0 4 * * 0')
  async purgeOldAuditLogs(): Promise<void> {
    const retentionDays = parseInt(process.env['AUDIT_RETENTION_DAYS'] ?? '365', 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await this.auditLogRepo
      .createQueryBuilder()
      .delete()
      .where('created_at < :cutoff', { cutoff })
      .execute();

    this.logger.log(
      `Purged ${result.affected ?? 0} audit logs older than ${retentionDays} days`,
    );
  }
}
