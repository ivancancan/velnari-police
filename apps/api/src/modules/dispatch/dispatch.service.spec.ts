import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { DispatchService } from './dispatch.service';
import { IncidentsService } from '../incidents/incidents.service';
import { UnitsService } from '../units/units.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IncidentEventEntity } from '../../entities/incident-event.entity';
import { BadRequestException } from '@nestjs/common';
import { IncidentPriority, IncidentStatus, IncidentType, UnitStatus } from '@velnari/shared-types';

describe('DispatchService', () => {
  let service: DispatchService;

  const mockIncident = {
    id: 'incident-uuid-1',
    folio: 'IC-001',
    type: IncidentType.ROBBERY,
    priority: IncidentPriority.HIGH,
    status: IncidentStatus.OPEN,
    assignedUnitId: undefined,
    lat: 19.4,
    lng: -99.1,
    location: '',
    createdBy: 'user-uuid-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUnit = {
    id: 'unit-uuid-1',
    callSign: 'P-14',
    status: UnitStatus.AVAILABLE,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockIncidentsService = {
    findOne: jest.fn(),
    saveIncident: jest.fn(),
  };

  const mockUnitsService = {
    findOne: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockEventRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchService,
        { provide: IncidentsService, useValue: mockIncidentsService },
        { provide: UnitsService, useValue: mockUnitsService },
        { provide: getRepositoryToken(IncidentEventEntity), useValue: mockEventRepo },
      ],
    }).compile();

    service = module.get<DispatchService>(DispatchService);
    jest.clearAllMocks();
  });

  it('assignUnit asigna unidad disponible al incidente', async () => {
    mockIncidentsService.findOne.mockResolvedValue({ ...mockIncident });
    mockUnitsService.findOne.mockResolvedValue({ ...mockUnit });
    mockUnitsService.updateStatus.mockResolvedValue({ ...mockUnit, status: UnitStatus.EN_ROUTE });
    mockIncidentsService.saveIncident.mockResolvedValue({
      ...mockIncident,
      assignedUnitId: 'unit-uuid-1',
      status: IncidentStatus.ASSIGNED,
    });
    mockEventRepo.create.mockReturnValue({});
    mockEventRepo.save.mockResolvedValue({});

    const result = await service.assignUnit('incident-uuid-1', 'unit-uuid-1', 'operator-uuid-1');

    expect(mockUnitsService.updateStatus).toHaveBeenCalledWith('unit-uuid-1', UnitStatus.EN_ROUTE);
    expect(result.status).toBe(IncidentStatus.ASSIGNED);
  });

  it('assignUnit lanza BadRequestException si la unidad no está disponible', async () => {
    mockIncidentsService.findOne.mockResolvedValue({ ...mockIncident });
    mockUnitsService.findOne.mockResolvedValue({ ...mockUnit, status: UnitStatus.ON_SCENE });

    await expect(
      service.assignUnit('incident-uuid-1', 'unit-uuid-1', 'operator-uuid-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('assignUnit lanza BadRequestException si el incidente ya está cerrado', async () => {
    mockIncidentsService.findOne.mockResolvedValue({
      ...mockIncident,
      status: IncidentStatus.CLOSED,
    });
    mockUnitsService.findOne.mockResolvedValue({ ...mockUnit });

    await expect(
      service.assignUnit('incident-uuid-1', 'unit-uuid-1', 'operator-uuid-1'),
    ).rejects.toThrow(BadRequestException);
  });
});
