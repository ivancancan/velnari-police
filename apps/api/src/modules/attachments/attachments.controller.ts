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
import { randomUUID } from 'crypto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { AttachmentsService } from './attachments.service';
import { S3Service } from './s3.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import type { Request } from 'express';
import type { IncidentAttachmentEntity } from '../../entities/incident-attachment.entity';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.txt']);

const UPLOADS_DIR = process.env['UPLOADS_DIR'] ?? join(__dirname, '..', '..', '..', 'uploads');

const storage = diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

function mimeTypeFilter(
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, accept: boolean) => void,
) {
  const ext = extname(file.originalname).toLowerCase();
  if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
  }
}

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
  @UseInterceptors(FileInterceptor('file', { storage, fileFilter: mimeTypeFilter, limits: { fileSize: 10 * 1024 * 1024 } }))
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

  @Post('presign')
  async presign(
    @Param('incidentId', ParseUUIDPipe) _incidentId: string,
    @Body() body: { filename: string; mimeType: string },
  ): Promise<{ presignedUrl: string | null; s3Key?: string }> {
    const ext = body.filename.includes('.') ? `.${body.filename.split('.').pop()}` : '';
    const s3Key = `incidents/${randomUUID()}${ext}`;
    const result = await this.s3.createPresignedUrl(s3Key, body.mimeType);
    if (!result) {
      return { presignedUrl: null };
    }
    return { presignedUrl: result.presignedUrl, s3Key: result.s3Key };
  }

  @Post('confirm')
  async confirm(
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @Req() req: Request & { user: { sub: string } },
    @Body() body: { s3Key: string; mimeType: string; size: number },
  ): Promise<{ id: string; url: string }> {
    const url = this.s3.getPublicUrl(body.s3Key);
    const attachment = await this.service.createFromPresigned({
      incidentId,
      s3Key: body.s3Key,
      url,
      mimeType: body.mimeType,
      size: body.size,
      uploadedBy: req.user.sub,
    });
    return { id: attachment.id, url: attachment.url };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.delete(id);
  }
}
