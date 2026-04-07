import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { SectorsService } from './sectors.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SectorEntity } from '../../entities/sector.entity';
import { NotFoundException } from '@nestjs/common';

describe('SectorsService', () => {
  let service: SectorsService;

  const mockSector: SectorEntity = {
    id: 'sector-uuid-1',
    name: 'Sector Norte',
    color: '#3B82F6',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SectorsService,
        { provide: getRepositoryToken(SectorEntity), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<SectorsService>(SectorsService);
    jest.clearAllMocks();
  });

  it('findAll retorna lista de sectores activos', async () => {
    mockRepo.find.mockResolvedValue([mockSector]);
    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(mockRepo.find).toHaveBeenCalledWith({ where: { isActive: true } });
  });

  it('findOne retorna sector por id', async () => {
    mockRepo.findOne.mockResolvedValue(mockSector);
    const result = await service.findOne('sector-uuid-1');
    expect(result.id).toBe('sector-uuid-1');
  });

  it('findOne lanza NotFoundException si no existe', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
  });

  it('create guarda y retorna el nuevo sector', async () => {
    mockRepo.create.mockReturnValue(mockSector);
    mockRepo.save.mockResolvedValue(mockSector);
    const result = await service.create({ name: 'Sector Norte' });
    expect(result.name).toBe('Sector Norte');
    expect(mockRepo.save).toHaveBeenCalled();
  });
});
