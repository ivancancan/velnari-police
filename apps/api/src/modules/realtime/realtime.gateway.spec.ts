import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  beforeEach(() => {
    gateway = new RealtimeGateway();
    // Inject mock server
    gateway['server'] = mockServer as never;
    jest.clearAllMocks();
  });

  it('emitUnitLocationChanged emite al room correcto', () => {
    gateway.emitUnitLocationChanged('sector-1', {
      unitId: 'unit-1',
      lat: 19.4,
      lng: -99.1,
      timestamp: new Date().toISOString(),
    });

    expect(mockServer.to).toHaveBeenCalledWith('sector:sector-1');
    expect(mockServer.emit).toHaveBeenCalledWith(
      'unit:location:changed',
      expect.objectContaining({ unitId: 'unit-1' }),
    );
  });

  it('emitUnitStatusChanged emite al room command', () => {
    gateway.emitUnitStatusChanged({
      unitId: 'unit-1',
      status: 'en_route',
      previousStatus: 'available',
    });

    expect(mockServer.to).toHaveBeenCalledWith('command');
    expect(mockServer.emit).toHaveBeenCalledWith(
      'unit:status:changed',
      expect.objectContaining({ unitId: 'unit-1', status: 'en_route' }),
    );
  });

  it('emitIncidentCreated emite al room command', () => {
    gateway.emitIncidentCreated({ id: 'inc-1', folio: 'IC-001' });

    expect(mockServer.to).toHaveBeenCalledWith('command');
    expect(mockServer.emit).toHaveBeenCalledWith(
      'incident:created',
      expect.objectContaining({ folio: 'IC-001' }),
    );
  });

  it('emitIncidentAssigned emite al room correcto', () => {
    gateway.emitIncidentAssigned('inc-1', 'unit-1');

    expect(mockServer.to).toHaveBeenCalledWith('incident:inc-1');
    expect(mockServer.emit).toHaveBeenCalledWith('incident:assigned', {
      incidentId: 'inc-1',
      unitId: 'unit-1',
    });
  });
});
