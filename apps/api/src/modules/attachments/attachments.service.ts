// apps/api/src/modules/attachments/attachments.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentAttachmentEntity } from '../../entities/incident-attachment.entity';

interface CreateAttachmentInput {
  incidentId: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
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

  create(input: CreateAttachmentInput): Promise<IncidentAttachmentEntity> {
    const attachment = this.repo.create(input);
    return this.repo.save(attachment);
  }

  delete(id: string): Promise<void> {
    return this.repo.delete(id).then(() => undefined);
  }
}
