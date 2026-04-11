// apps/api/src/modules/attachments/attachments.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { AttachmentsService } from './attachments.service';
import { S3Service } from './s3.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import type { Request } from 'express';
import type { IncidentAttachmentEntity } from '../../entities/incident-attachment.entity';

const storage = diskStorage({
  destination: './uploads',
  filename: (_req, file, cb) => {
    cb(null, `${randomUUID()}${extname(file.originalname)}`);
  },
});

@Controller('incidents/:incidentId/attachments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttachmentsController {
  constructor(
    private readonly service: AttachmentsService,
    private readonly s3: S3Service,
  ) {}

  @Get()
  findAll(
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
  ): Promise<IncidentAttachmentEntity[]> {
    return this.service.findByIncident(incidentId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage, limits: { fileSize: 10 * 1024 * 1024 } }))
  async upload(
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { user: { sub: string } },
    @Body() body: { gpsLat?: string; gpsLng?: string; capturedAt?: string },
  ): Promise<IncidentAttachmentEntity> {
    // Upload to S3 (or get local disk URL in dev)
    const url = await this.s3.upload(file.path, file.mimetype);

    const result = await this.service.create({
      incidentId,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url,
      uploadedBy: req.user.sub,
      filePath: file.path, // needed for SHA-256 computation in service
      gpsLat: body.gpsLat != null && isFinite(parseFloat(body.gpsLat)) ? parseFloat(body.gpsLat) : undefined,
      gpsLng: body.gpsLng != null && isFinite(parseFloat(body.gpsLng)) ? parseFloat(body.gpsLng) : undefined,
      capturedAt: body.capturedAt,
    });

    // In S3 mode: temp file is no longer needed after SHA-256 was computed by service
    if (this.s3.isStoringInS3()) {
      fs.unlink(file.path, () => {}); // fire and forget
    }

    return result;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.delete(id);
  }
}
