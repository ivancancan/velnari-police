// apps/api/src/modules/attachments/attachments.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule } from '@nestjs/config';
import { IncidentAttachmentEntity } from '../../entities/incident-attachment.entity';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';
import { S3Service } from './s3.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IncidentAttachmentEntity]),
    MulterModule.register({}),
    ConfigModule,
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, S3Service],
})
export class AttachmentsModule {}
