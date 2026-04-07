import { useUnitsStore } from './units.store';
import { UnitStatus } from '@velnari/shared-types';
import type { Unit, UnitPosition } from '@/lib/types';

const mockUnit: Unit = {
  id: 'unit-1',
  callSign: 'P-14',
  status: UnitStatus.AVAILABLE,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  useUnitsStore.setState({ units: [], positions: {}, isLoading: false });
});

describe('useUnitsStore', () => {
  it('setUnits reemplaza la lista de unidades', () => {
    useUnitsStore.getState().setUnits([mockUnit]);
    expect(useUnitsStore.getState().units).toHaveLength(1);
    expect(useUnitsStore.getState().units[0]?.callSign).toBe('P-14');
  });

  it('updateUnit actualiza una unidad específica', () => {
    useUnitsStore.getState().setUnits([mockUnit]);
    const updated = { ...mockUnit, status: UnitStatus.EN_ROUTE };
    useUnitsStore.getState().updateUnit(updated);
    expect(useUnitsStore.getState().units[0]?.status).toBe(UnitStatus.EN_ROUTE);
  });

  it('updatePosition guarda posición por unitId', () => {
    const position: UnitPosition = {
      unitId: 'unit-1',
      lat: 19.43,
      lng: -99.13,
      timestamp: new Date().toISOString(),
    };
    useUnitsStore.getState().updatePosition(position);
    const stored = useUnitsStore.getState().positions['unit-1'];
    expect(stored?.lat).toBe(19.43);
  });
});
