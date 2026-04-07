import { RedisCacheService } from './redis-cache.service';

describe('RedisCacheService', () => {
  let service: RedisCacheService;

  const mockRedis = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
  };

  beforeEach(() => {
    service = new RedisCacheService({ host: 'localhost', port: 6379 });
    // Replace real client with mock
    service['client'] = mockRedis as never;
    jest.clearAllMocks();
  });

  it('setUnitPosition guarda posición con TTL', async () => {
    await service.setUnitPosition('unit-1', { lat: 19.4, lng: -99.1 });

    expect(mockRedis.set).toHaveBeenCalledWith(
      'unit:unit-1:position',
      JSON.stringify({ lat: 19.4, lng: -99.1 }),
      'EX',
      60,
    );
  });

  it('getUnitPosition retorna posición si existe', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ lat: 19.4, lng: -99.1 }));

    const result = await service.getUnitPosition('unit-1');

    expect(result).toEqual({ lat: 19.4, lng: -99.1 });
  });

  it('getUnitPosition retorna null si no existe', async () => {
    mockRedis.get.mockResolvedValue(null);

    const result = await service.getUnitPosition('unit-1');

    expect(result).toBeNull();
  });

  it('clearUnitPosition elimina la clave', async () => {
    await service.clearUnitPosition('unit-1');

    expect(mockRedis.del).toHaveBeenCalledWith('unit:unit-1:position');
  });
});
