import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitLocationHistoryEntity } from '../../entities/unit-location-history.entity';
import { AuditLogEntity } from '../../entities/audit-log.entity';
import { CleanupService } from './cleanup.service';

@Module({
  imports: [TypeOrmModule.forFeature([UnitLocationHistoryEntity, AuditLogEntity])],
  providers: [CleanupService],
})
export class CleanupModule {}
