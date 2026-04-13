import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyEntity } from '../../entities/api-key.entity';
import { UserEntity } from '../../entities/user.entity';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { IngestController } from './ingest.controller';
import { IncidentsModule } from '../incidents/incidents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKeyEntity, UserEntity]),
    forwardRef(() => IncidentsModule),
  ],
  controllers: [ApiKeysController, IngestController],
  providers: [ApiKeysService],
  exports: [ApiKeysService],
})
export class IngestModule {}
