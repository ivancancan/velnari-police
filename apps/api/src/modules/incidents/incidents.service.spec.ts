import 'reflect-metadata';
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

  const mockQb = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ raw: [{ id: 'incident-uuid-1' }] }),
  };

  const mockIncidentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(mockQb),
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
    // create uses createQueryBuilder + findOne (with relations)
    mockIncidentRepo.findOne.mockResolvedValue({ ...mockIncident, folio: 'IC-001', events: [] });
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

    expect(mockIncidentRepo.createQueryBuilder).toHaveBeenCalled();
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

describe('IncidentsService.getStats', () => {
  let service: IncidentsService;

  const mockRepo = {
    find: jest.fn(),
    count: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    save: jest.fn(),
  };
  const mockEventRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        { provide: getRepositoryToken(IncidentEntity), useValue: mockRepo },
        { provide: getRepositoryToken(IncidentEventEntity), useValue: mockEventRepo },
      ],
    }).compile();
    service = module.get<IncidentsService>(IncidentsService);
    jest.clearAllMocks();
  });

  it('cuenta totales por estado', async () => {
    const now = new Date('2026-04-07T10:00:00Z');
    mockRepo.find.mockResolvedValue([
      { status: IncidentStatus.OPEN, priority: IncidentPriority.HIGH, type: IncidentType.ROBBERY, createdAt: now, assignedAt: null },
      { status: IncidentStatus.ASSIGNED, priority: IncidentPriority.CRITICAL, type: IncidentType.ASSAULT, createdAt: now, assignedAt: null },
      { status: IncidentStatus.CLOSED, priority: IncidentPriority.LOW, type: IncidentType.TRAFFIC, createdAt: now, assignedAt: null },
    ]);
    const stats = await service.getStats(new Date('2026-04-07'));
    expect(stats.total).toBe(3);
    expect(stats.open).toBe(1);
    expect(stats.assigned).toBe(1);
    expect(stats.closed).toBe(1);
  });

  it('cuenta incidentes por prioridad', async () => {
    const now = new Date('2026-04-07T10:00:00Z');
    mockRepo.find.mockResolvedValue([
      { status: IncidentStatus.OPEN, priority: IncidentPriority.CRITICAL, type: IncidentType.ROBBERY, createdAt: now, assignedAt: null },
      { status: IncidentStatus.OPEN, priority: IncidentPriority.CRITICAL, type: IncidentType.ASSAULT, createdAt: now, assignedAt: null },
      { status: IncidentStatus.OPEN, priority: IncidentPriority.HIGH, type: IncidentType.TRAFFIC, createdAt: now, assignedAt: null },
    ]);
    const stats = await service.getStats(new Date('2026-04-07'));
    expect(stats.byPriority['critical']).toBe(2);
    expect(stats.byPriority['high']).toBe(1);
  });

  it('calcula avgResponseMinutes cuando hay assignedAt', async () => {
    const createdAt = new Date('2026-04-07T10:00:00Z');
    const assignedAt = new Date('2026-04-07T10:05:00Z');
    mockRepo.find.mockResolvedValue([
      { status: IncidentStatus.ASSIGNED, priority: IncidentPriority.HIGH, type: IncidentType.ROBBERY, createdAt, assignedAt },
    ]);
    const stats = await service.getStats(new Date('2026-04-07'));
    expect(stats.avgResponseMinutes).toBe(5);
  });

  it('retorna null para avgResponseMinutes si no hay asignaciones', async () => {
    mockRepo.find.mockResolvedValue([
      { status: IncidentStatus.OPEN, priority: IncidentPriority.HIGH, type: IncidentType.ROBBERY, createdAt: new Date(), assignedAt: null },
    ]);
    const stats = await service.getStats(new Date('2026-04-07'));
    expect(stats.avgResponseMinutes).toBeNull();
  });
});
