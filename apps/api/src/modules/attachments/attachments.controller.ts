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
import { AttachmentsService } from './attachments.service';
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
  constructor(private readonly service: AttachmentsService) {}

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
    const API_URL = process.env['API_URL'] ?? 'http://localhost:3001';
    return this.service.create({
      incidentId,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `${API_URL}/uploads/${file.filename}`,
      uploadedBy: req.user.sub,
      filePath: file.path,
      gpsLat: body.gpsLat != null && isFinite(parseFloat(body.gpsLat)) ? parseFloat(body.gpsLat) : undefined,
      gpsLng: body.gpsLng != null && isFinite(parseFloat(body.gpsLng)) ? parseFloat(body.gpsLng) : undefined,
      capturedAt: body.capturedAt,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.delete(id);
  }
}
