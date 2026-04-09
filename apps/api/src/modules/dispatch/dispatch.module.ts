import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import { IncidentEntity } from '../../entities/incident.entity';
import { IncidentUnitAssignmentEntity } from '../../entities/incident-unit-assignment.entity';
import { UnitEntity } from '../../entities/unit.entity';
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';
import { IncidentsModule } from '../incidents/incidents.module';
import { UnitsModule } from '../units/units.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IncidentEventEntity, IncidentEntity, IncidentUnitAssignmentEntity, UnitEntity]),
    IncidentsModule,
    UnitsModule,
    RealtimeModule,
  ],
  controllers: [DispatchController],
  providers: [DispatchService],
  exports: [DispatchService],
})
export class DispatchModule {}
