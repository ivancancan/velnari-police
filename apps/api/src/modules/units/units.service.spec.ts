import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { UnitsService } from './units.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnitEntity } from '../../entities/unit.entity';
import { NotFoundException } from '@nestjs/common';
import { UnitStatus } from '@velnari/shared-types';

describe('UnitsService', () => {
  let service: UnitsService;

  const mockUnit: UnitEntity = {
    id: 'unit-uuid-1',
    callSign: 'P-14',
    status: UnitStatus.AVAILABLE,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnitsService,
        { provide: getRepositoryToken(UnitEntity), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<UnitsService>(UnitsService);
    jest.clearAllMocks();
  });

  it('findAll retorna unidades activas', async () => {
    mockRepo.find.mockResolvedValue([mockUnit]);
    const result = await service.findAll({});
    expect(result).toHaveLength(1);
  });

  it('findOne retorna unidad por id', async () => {
    mockRepo.findOne.mockResolvedValue(mockUnit);
    const result = await service.findOne('unit-uuid-1');
    expect(result.callSign).toBe('P-14');
  });

  it('findOne lanza NotFoundException si no existe', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
  });

  it('updateStatus cambia el estado de la unidad', async () => {
    const updatedUnit = { ...mockUnit, status: UnitStatus.EN_ROUTE };
    mockRepo.findOne.mockResolvedValue({ ...mockUnit });
    mockRepo.save.mockResolvedValue(updatedUnit);

    const result = await service.updateStatus('unit-uuid-1', UnitStatus.EN_ROUTE);
    expect(result.status).toBe(UnitStatus.EN_ROUTE);
  });

  it('findAvailableNearby retorna unidades disponibles', async () => {
    mockRepo.find.mockResolvedValue([mockUnit]);
    const result = await service.findAvailableNearby({ lat: 19.4, lng: -99.1 });
    expect(result).toHaveLength(1);
  });
});
