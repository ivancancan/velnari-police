import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { PatrolsService } from './patrols.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PatrolEntity, PatrolStatus } from '../../entities/patrol.entity';
import { UnitLocationHistoryEntity } from '../../entities/unit-location-history.entity';
import { NotFoundException } from '@nestjs/common';

describe('PatrolsService', () => {
  let service: PatrolsService;

  const now = new Date();
  const mockPatrol: PatrolEntity = {
    id: 'patrol-uuid-1',
    unitId: 'unit-uuid-1',
    sectorId: 'sector-uuid-1',
    status: PatrolStatus.ACTIVE,
    startAt: new Date(now.getTime() - 3600000),
    endAt: new Date(now.getTime() + 3600000),
    createdBy: 'user-uuid-1',
    createdAt: now,
    updatedAt: now,
  };

  const mockPatrolRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockHistoryRepo = {
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatrolsService,
        { provide: getRepositoryToken(PatrolEntity), useValue: mockPatrolRepo },
        { provide: getRepositoryToken(UnitLocationHistoryEntity), useValue: mockHistoryRepo },
      ],
    }).compile();
    service = module.get<PatrolsService>(PatrolsService);
    jest.clearAllMocks();
  });

  it('findActive returns active and scheduled patrols', async () => {
    mockPatrolRepo.find.mockResolvedValue([mockPatrol]);
    const result = await service.findActive();
    expect(result).toHaveLength(1);
  });

  it('create saves patrol', async () => {
    mockPatrolRepo.create.mockReturnValue(mockPatrol);
    mockPatrolRepo.save.mockResolvedValue(mockPatrol);
    const result = await service.create(
      { unitId: 'unit-uuid-1', sectorId: 'sector-uuid-1', startAt: mockPatrol.startAt.toISOString(), endAt: mockPatrol.endAt.toISOString() },
      'user-uuid-1',
    );
    expect(result.unitId).toBe('unit-uuid-1');
  });

  it('getCoverage throws NotFoundException for unknown patrol', async () => {
    mockPatrolRepo.findOne.mockResolvedValue(null);
    await expect(service.getCoverage('bad-id')).rejects.toThrow(NotFoundException);
  });

  it('getCoverage returns pings count from history', async () => {
    mockPatrolRepo.findOne.mockResolvedValue(mockPatrol);
    const mockQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(15),
    };
    mockHistoryRepo.createQueryBuilder.mockReturnValue(mockQb);
    const result = await service.getCoverage('patrol-uuid-1');
    expect(result.pings).toBe(15);
  });
});
