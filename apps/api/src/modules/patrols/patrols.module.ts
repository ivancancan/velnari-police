// apps/api/src/modules/patrols/patrols.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatrolEntity } from '../../entities/patrol.entity';
import { UnitLocationHistoryEntity } from '../../entities/unit-location-history.entity';
import { PatrolsService } from './patrols.service';
import { PatrolsController } from './patrols.controller';
import { IncidentsModule } from '../incidents/incidents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PatrolEntity, UnitLocationHistoryEntity]),
    IncidentsModule,
  ],
  controllers: [PatrolsController],
  providers: [PatrolsService],
})
export class PatrolsModule {}
