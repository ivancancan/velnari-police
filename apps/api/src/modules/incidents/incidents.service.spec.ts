import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { IncidentsService } from './incidents.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IncidentEntity } from '../../entities/incident.entity';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import { NotFoundException } from '@nestjs/common';
import { IncidentPriority, IncidentStatus, IncidentType } from '@velnari/shared-types';

describe('IncidentsService', () => {
  let service: IncidentsService;

  const mockIncident: IncidentEntity = {
    id: 'incident-uuid-1',
    folio: 'IC-001',
    type: IncidentType.ROBBERY,
    priority: IncidentPriority.HIGH,
    status: IncidentStatus.OPEN,
    lat: 19.4326,
    lng: -99.1332,
    location: '',
    createdBy: 'user-uuid-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockIncidentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
  };

  const mockEventRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        { provide: getRepositoryToken(IncidentEntity), useValue: mockIncidentRepo },
        { provide: getRepositoryToken(IncidentEventEntity), useValue: mockEventRepo },
      ],
    }).compile();

    service = module.get<IncidentsService>(IncidentsService);
    jest.clearAllMocks();
  });

  it('findAll retorna incidentes activos', async () => {
    mockIncidentRepo.find.mockResolvedValue([mockIncident]);
    const result = await service.findAll({});
    expect(result).toHaveLength(1);
  });

  it('findOne retorna incidente por id', async () => {
    mockIncidentRepo.findOne.mockResolvedValue(mockIncident);
    const result = await service.findOne('incident-uuid-1');
    expect(result.folio).toBe('IC-001');
  });

  it('findOne lanza NotFoundException si no existe', async () => {
    mockIncidentRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
  });

  it('create genera folio y guarda incidente', async () => {
    mockIncidentRepo.count.mockResolvedValue(0);
    mockIncidentRepo.create.mockReturnValue({ ...mockIncident, folio: 'IC-001' });
    mockIncidentRepo.save.mockResolvedValue(mockIncident);
    mockEventRepo.create.mockReturnValue({});
    mockEventRepo.save.mockResolvedValue({});

    const result = await service.create(
      {
        type: IncidentType.ROBBERY,
        priority: IncidentPriority.HIGH,
        lat: 19.4326,
        lng: -99.1332,
      },
      'user-uuid-1',
    );

    expect(mockIncidentRepo.save).toHaveBeenCalled();
    expect(result.folio).toBe('IC-001');
  });

  it('close actualiza estado y timestamps', async () => {
    const closedIncident = {
      ...mockIncident,
      status: IncidentStatus.CLOSED,
      closedAt: new Date(),
      resolution: 'no_action',
    };
    mockIncidentRepo.findOne.mockResolvedValue({ ...mockIncident });
    mockIncidentRepo.save.mockResolvedValue(closedIncident);
    mockEventRepo.create.mockReturnValue({});
    mockEventRepo.save.mockResolvedValue({});

    const result = await service.close('incident-uuid-1', { resolution: 'no_action' }, 'user-uuid-1');
    expect(result.status).toBe(IncidentStatus.CLOSED);
  });
});
