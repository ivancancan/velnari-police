// apps/api/src/modules/attachments/attachments.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentAttachmentEntity } from '../../entities/incident-attachment.entity';
import * as crypto from 'crypto';
import * as fs from 'fs';

interface CreateAttachmentInput {
  incidentId: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  uploadedBy: string;
  filePath: string;
  gpsLat?: number;
  gpsLng?: number;
  capturedAt?: string;
}

interface CreateFromPresignedInput {
  incidentId: string;
  s3Key: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
}

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(IncidentAttachmentEntity)
    private readonly repo: Repository<IncidentAttachmentEntity>,
  ) {}

  findByIncident(incidentId: string): Promise<IncidentAttachmentEntity[]> {
    return this.repo.find({
      where: { incidentId },
      order: { createdAt: 'ASC' },
    });
  }

  private async computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async create(input: CreateAttachmentInput): Promise<IncidentAttachmentEntity> {
    const sha256Hash = await this.computeFileHash(input.filePath);
    const attachment = this.repo.create({
      incidentId: input.incidentId,
      filename: input.filename,
      originalName: input.originalName,
      mimetype: input.mimetype,
      size: input.size,
      url: input.url,
      uploadedBy: input.uploadedBy,
      sha256Hash,
      gpsLat: input.gpsLat,
      gpsLng: input.gpsLng,
      capturedAt: input.capturedAt ? new Date(input.capturedAt) : undefined,
    });
    return this.repo.save(attachment);
  }

  async createFromPresigned(input: CreateFromPresignedInput): Promise<IncidentAttachmentEntity> {
    const filename = input.s3Key.split('/').pop() ?? input.s3Key;
    const attachment = this.repo.create({
      incidentId: input.incidentId,
      filename,
      originalName: filename,
      mimetype: input.mimeType,
      size: input.size,
      url: input.url,
      uploadedBy: input.uploadedBy,
      // sha256Hash is nullable — not computed for presigned uploads
    });
    return this.repo.save(attachment);
  }

  delete(id: string): Promise<void> {
    return this.repo.delete(id).then(() => undefined);
  }
}
