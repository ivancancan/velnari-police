import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentEntity } from '../../entities/incident.entity';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import { IncidentUnitAssignmentEntity } from '../../entities/incident-unit-assignment.entity';
import { SectorEntity } from '../../entities/sector.entity';
import { UnitEntity } from '../../entities/unit.entity';
import { UserEntity } from '../../entities/user.entity';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { PublicReportController } from './public-report.controller';
import { EscalationService } from './escalation.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IncidentEntity, IncidentEventEntity, IncidentUnitAssignmentEntity, SectorEntity, UnitEntity, UserEntity]),
    RealtimeModule,
  ],
  controllers: [IncidentsController, PublicReportController],
  providers: [IncidentsService, EscalationService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
