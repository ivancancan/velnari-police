// apps/api/src/modules/attachments/attachments.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { IncidentAttachmentEntity } from '../../entities/incident-attachment.entity';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([IncidentAttachmentEntity]),
    MulterModule.register({}),
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
})
export class AttachmentsModule {}
