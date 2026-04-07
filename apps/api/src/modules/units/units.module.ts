import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitEntity } from '../../entities/unit.entity';
import { UnitLocationHistoryEntity } from '../../entities/unit-location-history.entity';
import { IncidentEntity } from '../../entities/incident.entity';
import { UnitsService } from './units.service';
import { UnitsController } from './units.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [TypeOrmModule.forFeature([UnitEntity, UnitLocationHistoryEntity, IncidentEntity]), RealtimeModule],
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService],
})
export class UnitsModule {}
