import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { UnitsService } from './units.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnitEntity } from '../../entities/unit.entity';
import { UnitLocationHistoryEntity } from '../../entities/unit-location-history.entity';
import { IncidentEntity } from '../../entities/incident.entity';
import { NotFoundException } from '@nestjs/common';
import { UnitStatus } from '@velnari/shared-types';
import { SectorsService } from '../sectors/sectors.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

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

  const mockHistoryRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockIncidentRepo = {
    find: jest.fn(),
  };

  const mockSectorsService = {
    findAllWithBoundary: jest.fn().mockResolvedValue([]),
    checkGeofences: jest.fn().mockResolvedValue({ entered: [], exited: [] }),
  };

  const mockRealtimeGateway = {
    emitUnitUpdate: jest.fn(),
    emitGeofenceAlert: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnitsService,
        { provide: getRepositoryToken(UnitEntity), useValue: mockRepo },
        { provide: getRepositoryToken(UnitLocationHistoryEntity), useValue: mockHistoryRepo },
        { provide: getRepositoryToken(IncidentEntity), useValue: mockIncidentRepo },
        { provide: SectorsService, useValue: mockSectorsService },
        { provide: RealtimeGateway, useValue: mockRealtimeGateway },
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
    const innerQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawAndEntities: jest.fn().mockResolvedValue({
        raw: [{ id: 'unit-uuid-1', distance_km: '0.3' }],
        entities: [mockUnit],
      }),
    };
    mockRepo.createQueryBuilder.mockReturnValue(innerQb);
    const result = await service.findAvailableNearby({ lat: 19.4, lng: -99.1 });
    expect(result).toHaveLength(1);
  });

  describe('updateLocation', () => {
    it('llama a createQueryBuilder para actualizar la ubicación y guardar historial', async () => {
      const qbUnit = { update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({}) };
      const qbHistory = { insert: jest.fn().mockReturnThis(), into: jest.fn().mockReturnThis(), values: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({}) };
      mockRepo.createQueryBuilder.mockReturnValue(qbUnit);
      mockHistoryRepo.createQueryBuilder.mockReturnValue(qbHistory);
      await service.updateLocation('unit-uuid-1', 19.4326, -99.1332);
      expect(qbUnit.execute).toHaveBeenCalled();
      expect(qbHistory.execute).toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('retorna puntos de historial en el rango dado', async () => {
      const point = { id: 'h-1', unitId: 'unit-uuid-1', lat: 19.4326, lng: -99.1332, recordedAt: new Date() };
      mockHistoryRepo.find.mockResolvedValue([point]);
      const from = new Date('2026-04-07T00:00:00Z');
      const to = new Date('2026-04-07T23:59:59Z');
      const result = await service.getHistory('unit-uuid-1', from, to);
      expect(result).toHaveLength(1);
      expect(mockHistoryRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ unitId: 'unit-uuid-1' }) }),
      );
    });
  });

  describe('getIncidentsByUnit', () => {
    it('retorna incidentes asignados a la unidad en el rango dado', async () => {
      const incident = { id: 'inc-1', folio: 'IC-001', assignedUnitId: 'unit-uuid-1', assignedAt: new Date() };
      mockIncidentRepo.find.mockResolvedValue([incident]);
      const from = new Date('2026-04-07T00:00:00Z');
      const to = new Date('2026-04-07T23:59:59Z');
      const result = await service.getIncidentsByUnit('unit-uuid-1', from, to);
      expect(result).toHaveLength(1);
    });
  });

  describe('getStats', () => {
    it('cuenta unidades por estado', async () => {
      mockRepo.find.mockResolvedValue([
        { ...mockUnit, status: UnitStatus.AVAILABLE },
        { ...mockUnit, id: 'u2', status: UnitStatus.EN_ROUTE },
        { ...mockUnit, id: 'u3', status: UnitStatus.ON_SCENE },
        { ...mockUnit, id: 'u4', status: UnitStatus.OUT_OF_SERVICE },
      ]);
      const stats = await service.getStats();
      expect(stats.total).toBe(4);
      expect(stats.available).toBe(1);
      expect(stats.enRoute).toBe(1);
      expect(stats.onScene).toBe(1);
      expect(stats.outOfService).toBe(1);
    });
  });

  describe('findAvailableNearby', () => {
    it('retorna unidades disponibles con distancia calculada', async () => {
      const mockQbResult = [
        { id: 'u1', callSign: 'P-01', status: UnitStatus.AVAILABLE, isActive: true, distance_km: '0.5' },
        { id: 'u2', callSign: 'P-02', status: UnitStatus.AVAILABLE, isActive: true, distance_km: '1.2' },
      ];
      const innerQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({
          raw: mockQbResult,
          entities: [
            { id: 'u1', callSign: 'P-01', status: UnitStatus.AVAILABLE, isActive: true },
            { id: 'u2', callSign: 'P-02', status: UnitStatus.AVAILABLE, isActive: true },
          ],
        }),
      };
      mockRepo.createQueryBuilder.mockReturnValue(innerQb);

      const result = await service.findAvailableNearby({ lat: 19.4326, lng: -99.1332 });
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('distanceKm');
      expect(result[0]!.distanceKm).toBe(0.5);
      expect(innerQb.orderBy).toHaveBeenCalled();
    });
  });
});
