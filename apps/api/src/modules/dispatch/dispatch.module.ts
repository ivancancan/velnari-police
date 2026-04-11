import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import { IncidentEntity } from '../../entities/incident.entity';
import { IncidentUnitAssignmentEntity } from '../../entities/incident-unit-assignment.entity';
import { UnitEntity } from '../../entities/unit.entity';
import { UserEntity } from '../../entities/user.entity';
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';
import { AutoDispatchService } from './auto-dispatch.service';
import { IncidentsModule } from '../incidents/incidents.module';
import { UnitsModule } from '../units/units.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IncidentEventEntity, IncidentEntity, IncidentUnitAssignmentEntity, UnitEntity, UserEntity]),
    forwardRef(() => IncidentsModule),
    UnitsModule,
    RealtimeModule,
    NotificationsModule,
  ],
  controllers: [DispatchController],
  providers: [DispatchService, AutoDispatchService],
  exports: [DispatchService],
})
export class DispatchModule {}
