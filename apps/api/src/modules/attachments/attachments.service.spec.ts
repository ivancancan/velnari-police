import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { AttachmentsService } from './attachments.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IncidentAttachmentEntity } from '../../entities/incident-attachment.entity';

describe('AttachmentsService', () => {
  let service: AttachmentsService;

  const mockAttachment = {
    id: 'att-uuid-1',
    incidentId: 'inc-uuid-1',
    filename: 'abc123.jpg',
    originalName: 'photo.jpg',
    mimetype: 'image/jpeg',
    size: 204800,
    url: '/uploads/abc123.jpg',
    uploadedBy: 'user-uuid-1',
    createdAt: new Date(),
  };

  const mockRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: getRepositoryToken(IncidentAttachmentEntity), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<AttachmentsService>(AttachmentsService);
    jest.clearAllMocks();
  });

  it('findByIncident returns attachments for incident', async () => {
    mockRepo.find.mockResolvedValue([mockAttachment]);
    const result = await service.findByIncident('inc-uuid-1');
    expect(result).toHaveLength(1);
    expect(mockRepo.find).toHaveBeenCalledWith({
      where: { incidentId: 'inc-uuid-1' },
      order: { createdAt: 'ASC' },
    });
  });

  it('create saves attachment metadata', async () => {
    mockRepo.create.mockReturnValue(mockAttachment);
    mockRepo.save.mockResolvedValue(mockAttachment);
    const result = await service.create({
      incidentId: 'inc-uuid-1',
      filename: 'abc123.jpg',
      originalName: 'photo.jpg',
      mimetype: 'image/jpeg',
      size: 204800,
      url: '/uploads/abc123.jpg',
      uploadedBy: 'user-uuid-1',
    });
    expect(result.filename).toBe('abc123.jpg');
  });
});
